import { Injectable } from '@nestjs/common';
import { normalizePhone } from '@twabibu/utils';
import type { SessionUser } from '../auth/auth.types.js';
import { appointmentInclude, toPatientView } from '../booking/appointment-view.js';
import { ApiException } from '../common/api-exception.js';
import { AppointmentMessagesService } from '../notifications/appointment-messages.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: AppointmentMessagesService,
  ) {}

  /** Only reminders can be switched off: confirmations and cancellations always go out (SPEC-08 §Règles 4). */
  async preferences(user: SessionUser) {
    const p = await this.prisma.notificationPreference.findUnique({ where: { userId: user.id } });
    return { reminders: !(p?.reminderOptOut ?? false) };
  }

  async updatePreferences(user: SessionUser, input: { reminders: boolean }) {
    await this.prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: { reminderOptOut: !input.reminders },
      create: { userId: user.id, reminderOptOut: !input.reminders, sms: false },
    });
    return this.preferences(user);
  }

  async me(user: SessionUser) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { patientProfile: { include: { relatives: { orderBy: { createdAt: 'asc' } } } } },
    });
    const p = u.patientProfile;
    return {
      id: u.id,
      kind: u.kind,
      phone: u.phone,
      email: u.email,
      profile: p && {
        civility: p.civility,
        firstName: p.firstName,
        lastName: p.lastName,
        birthDate: p.birthDate.toISOString().slice(0, 10),
      },
      relatives: (p?.relatives ?? []).map((r) => ({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        birthDate: r.birthDate.toISOString().slice(0, 10),
        relationship: r.relationship,
        phone: r.phone,
      })),
    };
  }

  async addRelative(user: SessionUser, input: RelativeInput) {
    const r = await this.prisma.relative.create({ data: { patientProfileId: user.patientProfileId!, ...this.relativeData(input) } });
    return relativeView(r);
  }

  /** Only the account holder's own relatives: anything else is a 404 (IDOR). */
  async updateRelative(user: SessionUser, id: string, input: RelativeInput) {
    await this.ownRelative(user, id);
    const r = await this.prisma.relative.update({ where: { id }, data: this.relativeData(input) });
    return relativeView(r);
  }

  /**
   * SPEC-04: a relative can be removed only without upcoming appointments. Past appointments keep the name copied on the
   * practice's patient record, and a medical record kept by a practice is not deleted with the relative.
   */
  async removeRelative(user: SessionUser, id: string) {
    await this.ownRelative(user, id);
    const upcoming = await this.prisma.appointment.count({
      where: { patientProfileId: user.patientProfileId!, relativeId: id, endsAt: { gte: new Date() }, status: { in: ['CONFIRMED', 'PENDING_VALIDATION', 'ARRIVED', 'IN_CONSULTATION'] } },
    });
    if (upcoming) throw new ApiException('CONFLICT', 'Relative has upcoming appointments', { upcoming });
    await this.prisma.relative.delete({ where: { id } });
  }

  private async ownRelative(user: SessionUser, id: string) {
    const r = await this.prisma.relative.findFirst({ where: { id, patientProfileId: user.patientProfileId! } });
    if (!r) throw new ApiException('NOT_FOUND', 'Relative not found');
    return r;
  }

  private relativeData(input: RelativeInput) {
    let phone: string | null = null;
    if (input.phone) {
      phone = normalizePhone(input.phone);
      if (!phone) throw new ApiException('VALIDATION_FAILED', 'Invalid phone number', { field: 'phone' });
    }
    return { firstName: input.firstName, lastName: input.lastName, relationship: input.relationship, birthDate: new Date(`${input.birthDate}T00:00:00Z`), phone };
  }

  async profile(user: SessionUser) {
    const p = await this.prisma.patientProfile.findUniqueOrThrow({ where: { id: user.patientProfileId! }, include: { locality: { include: { island: true } } } });
    return {
      civility: p.civility,
      firstName: p.firstName,
      lastName: p.lastName,
      birthDate: p.birthDate.toISOString().slice(0, 10),
      addressLine: p.addressLine,
      localityId: p.localityId,
      locality: p.locality && { id: p.locality.id, name: p.locality.name, island: p.locality.island.code },
      insurance: p.insurance,
      email: user.email,
      phone: user.phone,
    };
  }

  /** SPEC-04 « Mon profil »: a name change is written to the audit log (before / after, no medical data). */
  async updateProfile(user: SessionUser, input: ProfileInput) {
    const before = await this.prisma.patientProfile.findUniqueOrThrow({ where: { id: user.patientProfileId! } });
    if (input.localityId && !(await this.prisma.locality.findFirst({ where: { id: input.localityId, isActive: true } }))) {
      throw new ApiException('VALIDATION_FAILED', 'Unknown locality', { field: 'localityId' });
    }
    await this.prisma.patientProfile.update({
      where: { id: before.id },
      data: {
        civility: input.civility,
        firstName: input.firstName,
        lastName: input.lastName,
        birthDate: new Date(`${input.birthDate}T00:00:00Z`),
        addressLine: input.addressLine || null,
        localityId: input.localityId,
        insurance: input.insurance || null,
      },
    });
    const changed = (['firstName', 'lastName'] as const).filter((k) => before[k] !== input[k]);
    if (changed.length || before.birthDate.toISOString().slice(0, 10) !== input.birthDate) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: 'patient.identity.update',
          entityType: 'PatientProfile',
          entityId: before.id,
          changes: {
            before: { firstName: before.firstName, lastName: before.lastName, birthDate: before.birthDate.toISOString().slice(0, 10) },
            after: { firstName: input.firstName, lastName: input.lastName, birthDate: input.birthDate },
          },
        },
      });
    }
    return this.profile(user);
  }

  async sessions(user: SessionUser) {
    const rows = await this.prisma.session.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((s) => ({ id: s.id, device: describeDevice(s.userAgent), createdAt: s.createdAt.toISOString(), current: s.id === user.sessionId }));
  }

  async revokeSession(user: SessionUser, id: string) {
    const s = await this.prisma.session.findFirst({ where: { id, userId: user.id, revokedAt: null } });
    if (!s) throw new ApiException('NOT_FOUND', 'Session not found');
    await this.prisma.session.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async revokeOtherSessions(user: SessionUser) {
    const { count } = await this.prisma.session.updateMany({ where: { userId: user.id, revokedAt: null, id: { not: user.sessionId } }, data: { revokedAt: new Date() } });
    return { revoked: count };
  }

  async appointments(user: SessionUser, scope: 'upcoming' | 'past') {
    const now = new Date();
    const rows = await this.prisma.appointment.findMany({
      where: {
        patientProfileId: user.patientProfileId!,
        ...(scope === 'upcoming'
          ? { endsAt: { gte: now }, status: { in: ['CONFIRMED', 'PENDING_VALIDATION', 'ARRIVED', 'IN_CONSULTATION'] } }
          : { OR: [{ endsAt: { lt: now } }, { status: { in: ['CANCELLED_BY_PATIENT', 'CANCELLED_BY_PRACTICE', 'DONE', 'NO_SHOW'] } }] }),
      },
      include: appointmentInclude,
      orderBy: { startsAt: scope === 'upcoming' ? 'asc' : 'desc' },
      take: 50,
    });
    return rows.map((a) => toPatientView(a, now));
  }

  async cancel(user: SessionUser, appointmentId: string) {
    const a = await this.prisma.appointment.findFirst({ where: { id: appointmentId, patientProfileId: user.patientProfileId! }, include: appointmentInclude });
    if (!a) throw new ApiException('NOT_FOUND', 'Appointment not found');
    const view = toPatientView(a);
    if (!view.cancellation.allowed) {
      if (a.status !== 'CONFIRMED' && a.status !== 'PENDING_VALIDATION') throw new ApiException('CONFLICT', 'Appointment cannot be cancelled');
      throw new ApiException('CANCELLATION_DEADLINE_PASSED', 'Online cancellation deadline passed', { practicePhone: a.agenda.practice.phone });
    }
    await this.prisma.appointment.update({
      where: { id: a.id },
      data: {
        status: 'CANCELLED_BY_PATIENT',
        cancelledAt: new Date(),
        cancellationReason: 'Annulé en ligne par le patient',
        events: { create: { type: 'CANCELLED', actorUserId: user.id, payload: { by: 'PATIENT' } } },
      },
    });
    await this.messages.send(a.id, 'cancelledByPatient');
    const updated = await this.prisma.appointment.findUniqueOrThrow({ where: { id: a.id }, include: appointmentInclude });
    return toPatientView(updated);
  }
}

type RelativeInput = { firstName: string; lastName: string; birthDate: string; relationship: string; phone?: string };
type ProfileInput = { civility: string | null; firstName: string; lastName: string; birthDate: string; addressLine: string | null; localityId: string | null; insurance: string | null };

function relativeView(r: { id: string; firstName: string; lastName: string; birthDate: Date; relationship: string; phone: string | null }) {
  return { id: r.id, firstName: r.firstName, lastName: r.lastName, birthDate: r.birthDate.toISOString().slice(0, 10), relationship: r.relationship, phone: r.phone };
}

/** A readable device label from the user agent, without storing anything new (« Chrome sur Android »). */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Appareil inconnu';
  const ua = userAgent;
  const os = /iPhone|iPad/.test(ua) ? 'iPhone ou iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : null;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Expo|okhttp|Dalvik/.test(ua) ? 'Application Twabibu' : null;
  if (browser && os) return `${browser} sur ${os}`;
  return browser ?? os ?? 'Appareil inconnu';
}
