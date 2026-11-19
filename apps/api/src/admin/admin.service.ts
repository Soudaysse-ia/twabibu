import { Inject, Injectable } from '@nestjs/common';
import type { NotificationChannel, NotificationStatus, OrganizationType, Prisma } from '@prisma/client';
import { addDaysToDateKey, toDateKey, zonedToUtc } from '@twabibu/utils';
import { practitionerName } from '../booking/appointment-view.js';
import { ApiException } from '../common/api-exception.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { emailTemplates } from '../notifications/email-templates.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { orderReference } from '../pharmacies/order-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminContext } from './admin.guard.js';
import { AuditService } from './audit.service.js';

/** Checklist the verifier ticks before publishing a practitioner (SPEC-11 §2). */
export const CHECKLIST = ['documentsReadable', 'nameMatches', 'licenseValid', 'confirmationCall'] as const;

/** Who did it: e-mail, « compte supprimé » for a removed account, « système » for automatic actions. */
const actorLabel = (actors: Map<string, string>, id: string | null) => (id ? (actors.get(id) ?? 'compte supprimé') : 'système');

const day = (offset: number) => zonedToUtc(addDaysToDateKey(toDateKey(new Date()), offset), 0);

/**
 * Back-office (SPEC-11). Rules: every write is audited with its actor; no medical table is ever read here
 * (no Consultation, Allergy, Prescription content, ClinicalNote); appointment motives are not shown either.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // ---- Dashboard ---------------------------------------------------------------------------------

  async dashboard() {
    const [today, tomorrow, last7, last30] = [day(0), day(1), day(-7), day(-30)];
    const [practitioners, pharmacies, apptToday, appt7, appt30, online30, notif, newPatients, openReports, orders7] = await Promise.all([
      this.prisma.practitioner.groupBy({ by: ['verificationStatus'], where: { deletedAt: null }, _count: true }),
      this.prisma.pharmacyProfile.findMany({ select: { verifiedAt: true } }),
      this.prisma.appointment.count({ where: { startsAt: { gte: today, lt: tomorrow }, status: { notIn: ['CANCELLED_BY_PATIENT', 'CANCELLED_BY_PRACTICE'] } } }),
      this.prisma.appointment.count({ where: { createdAt: { gte: last7 } } }),
      this.prisma.appointment.count({ where: { createdAt: { gte: last30 } } }),
      this.prisma.appointment.count({ where: { createdAt: { gte: last30 }, source: 'ONLINE' } }),
      this.prisma.notification.groupBy({ by: ['channel', 'status'], where: { createdAt: { gte: last30 } }, _count: true, _sum: { costKmf: true } }),
      this.prisma.patientProfile.count({ where: { createdAt: { gte: last7 } } }),
      this.prisma.report.count({ where: { status: { not: 'CLOSED' } } }),
      this.prisma.order.count({ where: { createdAt: { gte: last7 } } }),
    ]);
    const count = (s: string) => practitioners.find((p) => p.verificationStatus === s)?._count ?? 0;
    const sum = (f: (n: (typeof notif)[number]) => boolean) => notif.filter(f).reduce((s, n) => s + n._count, 0);
    return {
      practitioners: { verified: count('VERIFIED'), pending: count('PENDING') + count('CHANGES_REQUESTED'), rejected: count('REJECTED') },
      pharmacies: { verified: pharmacies.filter((p) => p.verifiedAt).length, pending: pharmacies.filter((p) => !p.verifiedAt).length },
      appointments: { today: apptToday, last7Days: appt7, last30Days: appt30, onlineShare: appt30 ? Math.round((online30 / appt30) * 100) : 0 },
      notifications: {
        emails30Days: sum((n) => n.channel === 'EMAIL'),
        sms30Days: sum((n) => n.channel === 'SMS'),
        failed30Days: sum((n) => n.status === 'FAILED'),
        smsCostKmf: Math.round(notif.filter((n) => n.channel === 'SMS').reduce((s, n) => s + (n._sum.costKmf ?? 0), 0)),
      },
      newPatients7Days: newPatients,
      openReports,
      orders7Days: orders7,
    };
  }

  // ---- Verification queue -------------------------------------------------------------------------

  async verificationQueue() {
    const rows = await this.prisma.practitioner.findMany({
      where: { deletedAt: null, verificationStatus: { in: ['PENDING', 'CHANGES_REQUESTED'] } },
      include: { speciality: true, organization: true, verificationDocuments: true },
      orderBy: { updatedAt: 'asc' },
    });
    return rows.map((p) => ({
      id: p.id,
      name: practitionerName(p),
      speciality: p.speciality.name,
      organization: p.organization.name,
      status: p.verificationStatus,
      documents: p.verificationDocuments.length,
      waitingSince: p.updatedAt.toISOString(),
    }));
  }

  async practitionerFile(id: string) {
    const p = await this.prisma.practitioner.findUnique({
      where: { id },
      include: { speciality: true, organization: true, verificationDocuments: { orderBy: { createdAt: 'asc' } }, membership: { include: { user: { select: { email: true } } } }, practices: { include: { practice: { include: { locality: true } } } } },
    });
    if (!p || p.deletedAt) throw new ApiException('NOT_FOUND', 'Practitioner not found');
    const history = await this.prisma.auditLog.findMany({ where: { entityType: 'Practitioner', entityId: id }, orderBy: { createdAt: 'desc' }, take: 30 });
    const actors = await this.actorEmails(history.map((h) => h.actorUserId));
    return {
      id: p.id,
      name: practitionerName(p),
      firstName: p.firstName,
      lastName: p.lastName,
      speciality: p.speciality.name,
      licenseNumber: p.licenseNumber,
      canPrescribe: p.canPrescribe,
      status: p.verificationStatus,
      verifiedAt: p.verifiedAt?.toISOString() ?? null,
      isPublished: p.isPublished,
      slug: p.slug,
      email: p.membership?.user.email ?? null,
      organization: { id: p.organization.id, name: p.organization.name, status: p.organization.status },
      practices: p.practices.map((x) => `${x.practice.name}, ${x.practice.addressLine}, ${x.practice.locality.name}`),
      // Files are stored encrypted in object storage; the viewer opens them by key (not available on a dev machine).
      documents: p.verificationDocuments.map((d) => ({ id: d.id, type: d.type, status: d.status, reviewNote: d.reviewNote, createdAt: d.createdAt.toISOString() })),
      checklist: CHECKLIST,
      history: history.map((h) => ({ action: h.action, at: h.createdAt.toISOString(), by: actorLabel(actors, h.actorUserId), changes: h.changes })),
    };
  }

  private async actorEmails(ids: (string | null)[]) {
    const users = await this.prisma.user.findMany({ where: { id: { in: ids.filter((x): x is string => !!x) } }, select: { id: true, email: true } });
    return new Map(users.map((u) => [u.id, u.email ?? u.id]));
  }

  /** Validate (all checklist items ticked), ask for more (message) or refuse (reason). The practitioner is told by e-mail. */
  async decide(admin: AdminContext, id: string, input: { decision: 'VERIFIED' | 'CHANGES_REQUESTED' | 'REJECTED'; message?: string; checklist?: Partial<Record<(typeof CHECKLIST)[number], boolean>> }) {
    const p = await this.prisma.practitioner.findUnique({ where: { id }, include: { membership: { include: { user: true } } } });
    if (!p || p.deletedAt) throw new ApiException('NOT_FOUND', 'Practitioner not found');
    if (input.decision === 'VERIFIED' && !CHECKLIST.every((k) => input.checklist?.[k])) throw new ApiException('VALIDATION_FAILED', 'Tick every checklist item', { field: 'checklist' });
    if (input.decision !== 'VERIFIED' && (input.message?.trim().length ?? 0) < 5) throw new ApiException('VALIDATION_FAILED', 'A message is required', { field: 'message' });
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.practitioner.update({
        where: { id },
        data:
          input.decision === 'VERIFIED'
            ? { verificationStatus: 'VERIFIED', verifiedAt: now, isPublished: true }
            : { verificationStatus: input.decision, ...(input.decision === 'REJECTED' ? { isPublished: false, verifiedAt: null } : {}) },
      }),
      this.prisma.verificationDocument.updateMany({ where: { practitionerId: id, status: { in: ['PENDING', 'UNVERIFIED', 'CHANGES_REQUESTED'] } }, data: { status: input.decision, reviewedById: admin.userId, reviewNote: input.message ?? null } }),
      // A practice created by an online sign-up waits for its first validated practitioner.
      ...(input.decision === 'VERIFIED' ? [this.prisma.organization.updateMany({ where: { id: p.organizationId, status: 'PENDING' }, data: { status: 'ACTIVE' } })] : []),
    ]);
    await this.audit.log({
      actorUserId: admin.userId,
      action: `practitioner.${input.decision.toLowerCase()}`,
      entityType: 'Practitioner',
      entityId: id,
      organizationId: p.organizationId,
      ip: admin.ip,
      changes: { from: p.verificationStatus, to: input.decision, message: input.message ?? null, checklist: input.checklist ?? null },
    });
    const email = p.membership?.user.email;
    if (email) {
      await this.notifications.sendEmail({
        to: email,
        userId: p.membership!.userId,
        template: 'verificationDecision',
        email: emailTemplates.verificationDecision({ name: practitionerName(p), decision: input.decision, message: input.message, url: `${this.config.APP_URL}/pro/connexion` }),
      });
    }
    return this.practitionerFile(id);
  }

  // ---- Structures -----------------------------------------------------------------------------------

  async structures(q?: string, type?: string) {
    const rows = await this.prisma.organization.findMany({
      where: { ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}), ...(type ? { type: type as OrganizationType } : {}) },
      include: { _count: { select: { practitioners: true, memberships: true } }, practices: { include: { locality: { include: { island: true } } }, take: 1 }, pharmacyProfile: { select: { verifiedAt: true } } },
      orderBy: { name: 'asc' },
      take: 100,
    });
    return rows.map((o) => ({
      id: o.id,
      name: o.name,
      type: o.type,
      status: o.status,
      locality: o.practices[0] ? `${o.practices[0].locality.name} (${o.practices[0].locality.island.name})` : null,
      practitioners: o._count.practitioners,
      members: o._count.memberships,
      pharmacyVerified: o.pharmacyProfile ? !!o.pharmacyProfile.verifiedAt : null,
    }));
  }

  async structure(id: string) {
    const o = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        practitioners: { where: { deletedAt: null }, include: { speciality: true }, orderBy: { lastName: 'asc' } },
        memberships: { include: { user: { select: { email: true, status: true, lastLoginAt: true } } }, orderBy: { createdAt: 'asc' } },
        practices: { include: { locality: true } },
        pharmacyProfile: true,
      },
    });
    if (!o) throw new ApiException('NOT_FOUND', 'Organization not found');
    const history = await this.prisma.auditLog.findMany({ where: { OR: [{ entityType: 'Organization', entityId: id }, { organizationId: id, actorUserId: { not: null }, action: { startsWith: 'pharmacy.' } }] }, orderBy: { createdAt: 'desc' }, take: 30 });
    const actors = await this.actorEmails(history.map((h) => h.actorUserId));
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      type: o.type,
      status: o.status,
      phone: o.phone,
      email: o.email,
      createdAt: o.createdAt.toISOString(),
      pharmacy: o.pharmacyProfile ? { verifiedAt: o.pharmacyProfile.verifiedAt?.toISOString() ?? null, licenseNumber: o.pharmacyProfile.licenseNumber, pharmacistName: o.pharmacyProfile.pharmacistName } : null,
      practices: o.practices.map((p) => ({ id: p.id, name: p.name, address: `${p.addressLine}, ${p.locality.name}` })),
      practitioners: o.practitioners.map((p) => ({ id: p.id, name: practitionerName(p), speciality: p.speciality.name, status: p.verificationStatus, isPublished: p.isPublished })),
      members: o.memberships.map((m) => ({ email: m.user.email, role: m.role, status: m.user.status, lastLoginAt: m.user.lastLoginAt?.toISOString() ?? null })),
      history: history.map((h) => ({ action: h.action, at: h.createdAt.toISOString(), by: actorLabel(actors, h.actorUserId), changes: h.changes })),
    };
  }

  /**
   * Suspension: the structure disappears at once (its practitioners are unpublished) and its members lose
   * access (guards refuse SUSPENDED). Reactivation republishes the verified practitioners that were online.
   */
  async setStructureStatus(admin: AdminContext, id: string, input: { suspend: boolean; reason: string }) {
    const o = await this.prisma.organization.findUnique({ where: { id }, include: { practitioners: { where: { deletedAt: null } }, memberships: { include: { user: true } } } });
    if (!o) throw new ApiException('NOT_FOUND', 'Organization not found');
    if (input.suspend === (o.status === 'SUSPENDED')) throw new ApiException('CONFLICT', input.suspend ? 'Already suspended' : 'Not suspended');
    if (input.suspend) {
      const online = o.practitioners.filter((p) => p.isPublished).map((p) => p.id);
      await this.prisma.$transaction([
        this.prisma.organization.update({ where: { id }, data: { status: 'SUSPENDED' } }),
        this.prisma.practitioner.updateMany({ where: { id: { in: online } }, data: { isPublished: false } }),
      ]);
      await this.audit.log({ actorUserId: admin.userId, action: 'organization.suspended', entityType: 'Organization', entityId: id, organizationId: id, ip: admin.ip, changes: { reason: input.reason, unpublished: online } });
    } else {
      const last = await this.prisma.auditLog.findFirst({ where: { entityType: 'Organization', entityId: id, action: 'organization.suspended' }, orderBy: { createdAt: 'desc' } });
      const ids = ((last?.changes as { unpublished?: string[] } | null)?.unpublished ?? []).filter((pid) => o.practitioners.some((p) => p.id === pid && p.verificationStatus === 'VERIFIED'));
      await this.prisma.$transaction([
        this.prisma.organization.update({ where: { id }, data: { status: 'ACTIVE' } }),
        this.prisma.practitioner.updateMany({ where: { id: { in: ids } }, data: { isPublished: true } }),
      ]);
      await this.audit.log({ actorUserId: admin.userId, action: 'organization.reactivated', entityType: 'Organization', entityId: id, organizationId: id, ip: admin.ip, changes: { reason: input.reason, republished: ids } });
    }
    const owner = o.memberships.find((m) => m.role === 'OWNER')?.user.email ?? o.email;
    if (owner) {
      await this.notifications.sendEmail({
        to: owner,
        template: 'verificationDecision',
        email: emailTemplates.verificationDecision({ name: o.name, decision: input.suspend ? 'SUSPENDED' : 'REACTIVATED', message: input.reason, url: `${this.config.APP_URL}/${o.type === 'PHARMACY' ? 'pharma' : 'pro'}/connexion` }),
      });
    }
    return this.structure(id);
  }

  // ---- Patient support (never medical data) -------------------------------------------------------------

  async patients(q: string) {
    const term = q.trim();
    if (term.length < 2) return [];
    const rows = await this.prisma.patientProfile.findMany({
      where: { OR: [{ user: { email: { contains: term, mode: 'insensitive' } } }, { lastName: { contains: term, mode: 'insensitive' } }, { firstName: { contains: term, mode: 'insensitive' } }] },
      include: { user: { select: { email: true, status: true, createdAt: true } } },
      orderBy: { lastName: 'asc' },
      take: 50,
    });
    return rows.map((p) => ({ id: p.id, name: `${p.firstName} ${p.lastName}`, email: p.user.email, status: p.user.status, createdAt: p.user.createdAt.toISOString() }));
  }

  async patient(admin: AdminContext, id: string) {
    const p = await this.prisma.patientProfile.findUnique({ where: { id }, include: { user: true, relatives: true } });
    if (!p) throw new ApiException('NOT_FOUND', 'Patient not found');
    const [appointments, notifications, orders, sessions] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { OR: [{ patientProfileId: id }, { relativeId: { in: p.relatives.map((r) => r.id) } }] },
        include: { agenda: { include: { practitioner: true } } },
        orderBy: { startsAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.findMany({ where: { OR: [{ userId: p.userId }, { recipient: p.user.email ?? '—' }] }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.order.findMany({ where: { patientProfileId: id }, include: { pharmacy: { include: { organization: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.session.count({ where: { userId: p.userId, revokedAt: null, expiresAt: { gt: new Date() } } }),
    ]);
    await this.audit.log({ actorUserId: admin.userId, action: 'patient.support_viewed', entityType: 'PatientProfile', entityId: id, ip: admin.ip });
    return {
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      birthDate: p.birthDate.toISOString().slice(0, 10),
      email: p.user.email,
      status: p.user.status,
      createdAt: p.user.createdAt.toISOString(),
      lastLoginAt: p.user.lastLoginAt?.toISOString() ?? null,
      activeSessions: sessions,
      relatives: p.relatives.map((r) => ({ name: `${r.firstName} ${r.lastName}`, relationship: r.relationship })),
      // No motive: it can reveal a condition (CLAUDE.md, données de santé).
      appointments: appointments.map((a) => ({ id: a.id, startsAt: a.startsAt.toISOString(), status: a.status, source: a.source, practitioner: practitionerName(a.agenda.practitioner) })),
      notifications: notifications.map((n) => ({ id: n.id, channel: n.channel, template: n.template, status: n.status, error: n.error, createdAt: n.createdAt.toISOString() })),
      orders: orders.map((o) => ({ id: o.id, reference: orderReference(o.id), pharmacy: o.pharmacy.organization.name, status: o.status, createdAt: o.createdAt.toISOString() })),
    };
  }

  /** Signs the patient out everywhere (lost phone, suspicious access). */
  async revokeSessions(admin: AdminContext, id: string) {
    const p = await this.prisma.patientProfile.findUnique({ where: { id } });
    if (!p) throw new ApiException('NOT_FOUND', 'Patient not found');
    const done = await this.prisma.session.updateMany({ where: { userId: p.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log({ actorUserId: admin.userId, action: 'patient.sessions_revoked', entityType: 'PatientProfile', entityId: id, ip: admin.ip, changes: { count: done.count } });
    return { revoked: done.count };
  }

  // ---- Notifications log -------------------------------------------------------------------------------

  async notificationLog(f: { status?: string; channel?: string; q?: string; template?: string }) {
    const rows = await this.prisma.notification.findMany({
      where: {
        ...(f.status ? { status: f.status as NotificationStatus } : {}),
        ...(f.channel ? { channel: f.channel as NotificationChannel } : {}),
        ...(f.template ? { template: f.template } : {}),
        ...(f.q ? { recipient: { contains: f.q, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    // The content is never shown: it may hold a sign-in code.
    return rows.map((n) => ({ id: n.id, channel: n.channel, recipient: n.recipient, template: n.template, status: n.status, provider: n.provider, error: n.error, createdAt: n.createdAt.toISOString(), sentAt: n.sentAt?.toISOString() ?? null, resendable: n.status === 'FAILED' && n.template !== 'otp' }));
  }

  async resend(admin: AdminContext, id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) throw new ApiException('NOT_FOUND', 'Notification not found');
    if (n.status !== 'FAILED' || n.template === 'otp') throw new ApiException('CONFLICT', 'Only failed messages (not sign-in codes) can be sent again');
    await this.notifications.requeue(id);
    await this.audit.log({ actorUserId: admin.userId, action: 'notification.resent', entityType: 'Notification', entityId: id, ip: admin.ip });
    return { status: 'QUEUED' };
  }

  // ---- Audit log --------------------------------------------------------------------------------------------

  async auditLog(f: { actor?: string; entityType?: string; action?: string; from?: string; to?: string }) {
    const actorIds = f.actor ? (await this.prisma.user.findMany({ where: { email: { contains: f.actor, mode: 'insensitive' } }, select: { id: true } })).map((u) => u.id) : null;
    const where: Prisma.AuditLogWhereInput = {
      ...(actorIds ? { actorUserId: { in: actorIds } } : {}),
      ...(f.entityType ? { entityType: f.entityType } : {}),
      ...(f.action ? { action: { startsWith: f.action } } : {}),
      ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: zonedToUtc(f.from, 0) } : {}), ...(f.to ? { lt: zonedToUtc(addDaysToDateKey(f.to, 1), 0) } : {}) } } : {}),
    };
    const rows = await this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 });
    const actors = await this.actorEmails(rows.map((r) => r.actorUserId));
    return rows.map((r) => ({ id: r.id, at: r.createdAt.toISOString(), actor: actorLabel(actors, r.actorUserId), action: r.action, entityType: r.entityType, entityId: r.entityId, ip: r.ip, changes: r.changes }));
  }

  async auditCsv(f: Parameters<AdminService['auditLog']>[0]) {
    const rows = await this.auditLog(f);
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return ['date;acteur;action;entité;identifiant;ip;détails', ...rows.map((r) => [r.at, r.actor, r.action, r.entityType, r.entityId, r.ip, JSON.stringify(r.changes ?? '')].map(cell).join(';'))].join('\n');
  }

  // ---- Feature flags -------------------------------------------------------------------------------------------

  flags() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  async setFlag(admin: AdminContext, key: string, enabled: boolean) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!flag) throw new ApiException('NOT_FOUND', 'Unknown flag');
    await this.prisma.featureFlag.update({ where: { key }, data: { enabled } });
    await this.audit.log({ actorUserId: admin.userId, action: 'flag.changed', entityType: 'FeatureFlag', entityId: null, ip: admin.ip, changes: { key, from: flag.enabled, to: enabled } });
    return this.flags();
  }
}
