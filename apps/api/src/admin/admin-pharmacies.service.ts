import { Inject, Injectable } from '@nestjs/common';
import type { IslandCode, PlacementSlot } from '@prisma/client';
import { addDaysToDateKey, toDateKey, zonedToUtc } from '@twabibu/utils';
import { ApiException } from '../common/api-exception.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { emailTemplates } from '../notifications/email-templates.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminContext } from './admin.guard.js';
import { AuditService } from './audit.service.js';

/** Sponsored inventory is limited per island and slot (SPEC-15 §5). */
export const PLACEMENTS_PER_ISLAND = 3;

const ISLAND: Record<string, IslandCode> = { ngazidja: 'NGAZIDJA', ndzuani: 'NDZUANI', mwali: 'MWALI' };

/** `2026-11-20 19:30` (Comoros time) → UTC instant, or null. */
export function parseLocal(value: string): Date | null {
  const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, date, h, min] = m;
  if (+h! > 23 || +min! > 59) return null;
  return zonedToUtc(date!, +h! * 60 + +min!);
}

/** Back-office side of the pharmacy module: verification, official duty calendar, sponsored placements. */
@Injectable()
export class AdminPharmaciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private async pharmacy(id: string) {
    const o = await this.prisma.organization.findUnique({ where: { id }, include: { pharmacyProfile: true, memberships: { where: { role: 'OWNER' }, include: { user: true } } } });
    if (!o || o.type !== 'PHARMACY' || !o.pharmacyProfile) throw new ApiException('NOT_FOUND', 'Pharmacy not found');
    return o;
  }

  async list() {
    const rows = await this.prisma.organization.findMany({
      where: { type: 'PHARMACY' },
      include: { pharmacyProfile: true, practices: { include: { locality: { include: { island: true } } }, take: 1 } },
      orderBy: { name: 'asc' },
    });
    return rows
      .map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        status: o.status,
        verifiedAt: o.pharmacyProfile?.verifiedAt?.toISOString() ?? null,
        licenseNumber: o.pharmacyProfile?.licenseNumber ?? null,
        locality: o.practices[0]?.locality.name ?? null,
        island: o.practices[0]?.locality.island.code ?? null,
      }))
      .sort((a, b) => +!!a.verifiedAt - +!!b.verifiedAt || a.name.localeCompare(b.name, 'fr'));
  }

  /** Verified pharmacies take orders and prescriptions; withdrawing it closes both (SPEC-15 §7.1). */
  async setVerified(admin: AdminContext, id: string, input: { verified: boolean; message?: string }) {
    const o = await this.pharmacy(id);
    if (input.verified === !!o.pharmacyProfile!.verifiedAt) throw new ApiException('CONFLICT', input.verified ? 'Already verified' : 'Not verified');
    if (!input.verified && (input.message?.trim().length ?? 0) < 5) throw new ApiException('VALIDATION_FAILED', 'A reason is required', { field: 'message' });
    await this.prisma.pharmacyProfile.update({ where: { organizationId: id }, data: { verifiedAt: input.verified ? new Date() : null } });
    await this.audit.log({ actorUserId: admin.userId, action: input.verified ? 'pharmacy.verified' : 'pharmacy.unverified', entityType: 'Organization', entityId: id, organizationId: id, ip: admin.ip, changes: { message: input.message ?? null } });
    const to = o.memberships[0]?.user.email ?? o.email;
    if (to) {
      await this.notifications.sendEmail({
        to,
        template: 'verificationDecision',
        email: emailTemplates.verificationDecision({ name: o.name, decision: input.verified ? 'VERIFIED' : 'REJECTED', message: input.message, url: `${this.config.APP_URL}/pharma/connexion` }),
      });
    }
    return (await this.list()).find((p) => p.id === id)!;
  }

  // ---- Official duty calendar --------------------------------------------------------------------

  async duties(island: string, from?: string) {
    const code = ISLAND[island];
    if (!code) throw new ApiException('NOT_FOUND', 'Unknown island');
    const start = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : toDateKey(new Date());
    const rows = await this.prisma.dutySchedule.findMany({
      where: { island: code, endsAt: { gt: zonedToUtc(start, 0) }, startsAt: { lt: zonedToUtc(addDaysToDateKey(start, 14), 0) } },
      include: { pharmacy: { include: { organization: { select: { name: true } } } } },
      orderBy: { startsAt: 'asc' },
    });
    return rows.map((d) => ({ id: d.id, pharmacyId: d.pharmacyId, pharmacy: d.pharmacy.organization.name, startsAt: d.startsAt.toISOString(), endsAt: d.endsAt.toISOString(), source: d.source, zone: d.zone, updatedAt: d.updatedAt.toISOString() }));
  }

  private async checkDuty(pharmacyId: string, startsAt: Date, endsAt: Date) {
    if (endsAt <= startsAt) throw new ApiException('VALIDATION_FAILED', 'The end must come after the start');
    if (endsAt.getTime() - startsAt.getTime() > 7 * 24 * 3600 * 1000) throw new ApiException('VALIDATION_FAILED', 'A duty lasts 7 days at most');
    const o = await this.prisma.organization.findUnique({ where: { id: pharmacyId }, include: { practices: { include: { locality: { include: { island: true } } }, take: 1 } } });
    if (!o || o.type !== 'PHARMACY') throw new ApiException('VALIDATION_FAILED', 'Unknown pharmacy');
    const island = o.practices[0]?.locality.island.code;
    if (!island) throw new ApiException('VALIDATION_FAILED', 'Pharmacy without address');
    const overlap = await this.prisma.dutySchedule.findFirst({ where: { pharmacyId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
    if (overlap) throw new ApiException('CONFLICT', 'This pharmacy already has a duty at that time');
    return island;
  }

  async addDuty(admin: AdminContext, input: { pharmacyId: string; startsAt: string; endsAt: string; source: string }) {
    const startsAt = parseLocal(input.startsAt);
    const endsAt = parseLocal(input.endsAt);
    if (!startsAt || !endsAt) throw new ApiException('VALIDATION_FAILED', 'Dates as YYYY-MM-DD HH:MM');
    const island = await this.checkDuty(input.pharmacyId, startsAt, endsAt);
    const d = await this.prisma.dutySchedule.create({ data: { pharmacyId: input.pharmacyId, island, startsAt, endsAt, source: input.source } });
    await this.audit.log({ actorUserId: admin.userId, action: 'duty.created', entityType: 'DutySchedule', entityId: d.id, organizationId: input.pharmacyId, ip: admin.ip, changes: { startsAt: input.startsAt, endsAt: input.endsAt, source: input.source } });
    return { id: d.id };
  }

  async deleteDuty(admin: AdminContext, id: string) {
    const d = await this.prisma.dutySchedule.findUnique({ where: { id } });
    if (!d) throw new ApiException('NOT_FOUND', 'Duty not found');
    await this.prisma.dutySchedule.delete({ where: { id } });
    await this.audit.log({ actorUserId: admin.userId, action: 'duty.deleted', entityType: 'DutySchedule', entityId: id, organizationId: d.pharmacyId, ip: admin.ip, changes: { startsAt: d.startsAt.toISOString(), endsAt: d.endsAt.toISOString(), source: d.source } });
  }

  /**
   * CSV from the official calendar: `pharmacie (slug) ; début ; fin` with local times `2026-11-20 19:30`.
   * Every line is checked; nothing is written if one line is wrong (the calendar must stay whole).
   */
  async importDuties(admin: AdminContext, csv: string, source: string) {
    const rows = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // Header line: the one without any date in it.
    if (rows[0] && !/\d{4}-\d{2}-\d{2}/.test(rows[0])) rows.shift();
    const slugs = await this.prisma.organization.findMany({ where: { type: 'PHARMACY' }, select: { id: true, slug: true } });
    const errors: { line: number; message: string }[] = [];
    const parsed: { pharmacyId: string; startsAt: Date; endsAt: Date; line: number }[] = [];
    rows.slice(0, 1000).forEach((row, i) => {
      const [slug = '', a = '', b = ''] = row.split(row.includes(';') ? ';' : ',').map((c) => c.trim());
      const pharmacy = slugs.find((s) => s.slug === slug);
      const startsAt = parseLocal(a);
      const endsAt = parseLocal(b);
      if (!pharmacy) errors.push({ line: i + 2, message: `Pharmacie inconnue : ${slug}` });
      else if (!startsAt || !endsAt) errors.push({ line: i + 2, message: 'Dates attendues au format AAAA-MM-JJ HH:MM' });
      else parsed.push({ pharmacyId: pharmacy.id, startsAt, endsAt, line: i + 2 });
    });
    const data = [];
    for (const p of parsed) {
      try {
        const island = await this.checkDuty(p.pharmacyId, p.startsAt, p.endsAt);
        if (parsed.some((q) => q !== p && q.pharmacyId === p.pharmacyId && q.startsAt < p.endsAt && q.endsAt > p.startsAt)) throw new ApiException('CONFLICT', 'overlap');
        data.push({ pharmacyId: p.pharmacyId, island, startsAt: p.startsAt, endsAt: p.endsAt, source });
      } catch (error) {
        errors.push({ line: p.line, message: error instanceof ApiException && error.code === 'CONFLICT' ? 'Chevauche une autre garde de cette pharmacie' : 'Garde invalide (fin avant début ou plus de 7 jours)' });
      }
    }
    if (errors.length) return { created: 0, errors: errors.sort((x, y) => x.line - y.line) };
    await this.prisma.dutySchedule.createMany({ data });
    await this.audit.log({ actorUserId: admin.userId, action: 'duty.imported', entityType: 'DutySchedule', ip: admin.ip, changes: { count: data.length, source } });
    return { created: data.length, errors: [] };
  }

  // ---- Sponsored placements -------------------------------------------------------------------------

  async placements() {
    const rows = await this.prisma.sponsoredPlacement.findMany({
      where: { endsAt: { gt: new Date(Date.now() - 31 * 24 * 3600 * 1000) } },
      include: { pharmacy: { include: { organization: { select: { name: true } } } } },
      orderBy: [{ island: 'asc' }, { slot: 'asc' }, { startsAt: 'asc' }],
    });
    const now = new Date();
    return rows.map((p) => ({ id: p.id, pharmacyId: p.pharmacyId, pharmacy: p.pharmacy.organization.name, slot: p.slot, island: p.island, startsAt: p.startsAt.toISOString(), endsAt: p.endsAt.toISOString(), priceKmf: p.priceKmf, active: p.startsAt <= now && now < p.endsAt }));
  }

  async addPlacement(admin: AdminContext, input: { pharmacyId: string; slot: PlacementSlot; island: IslandCode; startsOn: string; endsOn: string; priceKmf: number }) {
    const o = await this.pharmacy(input.pharmacyId);
    if (!o.pharmacyProfile!.verifiedAt) throw new ApiException('PHARMACY_NOT_VERIFIED', 'Only verified pharmacies can be sponsored');
    const startsAt = zonedToUtc(input.startsOn, 0);
    const endsAt = zonedToUtc(addDaysToDateKey(input.endsOn, 1), 0);
    if (endsAt <= startsAt) throw new ApiException('VALIDATION_FAILED', 'The end must come after the start');
    const taken = await this.prisma.sponsoredPlacement.findMany({ where: { slot: input.slot, island: input.island, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
    if (taken.some((p) => p.pharmacyId === input.pharmacyId)) throw new ApiException('CONFLICT', 'This pharmacy already holds this slot then');
    if (taken.length >= PLACEMENTS_PER_ISLAND) throw new ApiException('CONFLICT', `No slot left: ${PLACEMENTS_PER_ISLAND} per island`);
    const p = await this.prisma.sponsoredPlacement.create({ data: { pharmacyId: input.pharmacyId, slot: input.slot, island: input.island, startsAt, endsAt, priceKmf: input.priceKmf } });
    await this.audit.log({ actorUserId: admin.userId, action: 'placement.created', entityType: 'SponsoredPlacement', entityId: p.id, organizationId: input.pharmacyId, ip: admin.ip, changes: { ...input } });
    return { id: p.id };
  }

  /** Ends a placement now (it disappears from the site at once). Past placements are kept for invoicing. */
  async endPlacement(admin: AdminContext, id: string) {
    const p = await this.prisma.sponsoredPlacement.findUnique({ where: { id } });
    if (!p) throw new ApiException('NOT_FOUND', 'Placement not found');
    const now = new Date();
    if (p.endsAt <= now) throw new ApiException('CONFLICT', 'Already over');
    await this.prisma.sponsoredPlacement.update({ where: { id }, data: { endsAt: p.startsAt > now ? p.startsAt : now } });
    await this.audit.log({ actorUserId: admin.userId, action: 'placement.ended', entityType: 'SponsoredPlacement', entityId: id, organizationId: p.pharmacyId, ip: admin.ip, changes: { previousEnd: p.endsAt.toISOString() } });
  }
}
