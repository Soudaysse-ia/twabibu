import { Injectable } from '@nestjs/common';
import { Prisma, type IslandCode, type SpecialityGroup } from '@prisma/client';
import { ApiException } from '../common/api-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminContext } from './admin.guard.js';
import { AuditService } from './audit.service.js';
import { drugFlags, drugSlug, isInComoros, localitySlug, motivesProblem, specialitySlug, type DefaultMotive } from './referential-rules.js';

export interface SpecialityInput {
  name: string;
  group: SpecialityGroup;
  canPrescribe: boolean;
  defaultMotives: DefaultMotive[];
  sortOrder?: number;
}

export interface LocalityInput {
  island: IslandCode;
  name: string;
  lat: number;
  lng: number;
  kind: string;
}

export interface DrugInput {
  dci: string;
  strength: string;
  form: string;
  route: string;
  brandNames: string[];
  atcCode?: string | null;
  prescriptionOnly: boolean;
  controlled: boolean;
  essential: boolean;
}

const dateOf = (key: string) => new Date(`${key}T00:00:00Z`);
const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/**
 * Reference data (SPEC-11 §5, ADR-019): the back-office owns it, the seed only creates what is missing.
 * Nothing in use is ever deleted (deactivated instead); every write is audited.
 */
@Injectable()
export class AdminReferentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private log(admin: AdminContext, action: string, entityType: string, entityId: string, changes: Prisma.InputJsonValue) {
    return this.audit.log({ actorUserId: admin.userId, action, entityType, entityId, ip: admin.ip, changes });
  }

  // ---- Specialities -------------------------------------------------------------------------------

  async specialities() {
    const rows = await this.prisma.speciality.findMany({
      include: { _count: { select: { practitioners: { where: { deletedAt: null, isPublished: true } } } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((s) => ({ id: s.id, name: s.name, slug: s.slug, group: s.group, canPrescribe: s.canPrescribe, defaultMotives: s.defaultMotives as unknown as DefaultMotive[], sortOrder: s.sortOrder, isActive: s.isActive, publishedPractitioners: s._count.practitioners }));
  }

  private checkMotives(motives: DefaultMotive[]) {
    const problem = motivesProblem(motives);
    if (problem) throw new ApiException('VALIDATION_FAILED', problem, { field: 'defaultMotives' });
    return motives.map((m) => ({ name: m.name.trim(), durationMinutes: m.durationMinutes }));
  }

  async createSpeciality(admin: AdminContext, input: SpecialityInput) {
    const slug = specialitySlug(input.name);
    if (slug.length < 2) throw new ApiException('VALIDATION_FAILED', 'Name too short', { field: 'name' });
    const motives = this.checkMotives(input.defaultMotives);
    const sortOrder = input.sortOrder ?? ((await this.prisma.speciality.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0) + 1;
    try {
      const s = await this.prisma.speciality.create({ data: { name: input.name.trim(), slug, group: input.group, canPrescribe: input.canPrescribe, defaultMotives: motives, sortOrder } });
      await this.log(admin, 'referential.speciality.created', 'Speciality', s.id, { name: s.name, slug });
      return (await this.specialities()).find((x) => x.id === s.id)!;
    } catch (e) {
      if (isUnique(e)) throw new ApiException('CONFLICT', `A speciality with the address « ${slug} » already exists`);
      throw e;
    }
  }

  /** The slug never changes. Deactivating is refused while published practitioners use the speciality. */
  async updateSpeciality(admin: AdminContext, id: string, input: Partial<SpecialityInput> & { isActive?: boolean }) {
    const s = await this.prisma.speciality.findUnique({ where: { id }, include: { _count: { select: { practitioners: { where: { deletedAt: null, isPublished: true } } } } } });
    if (!s) throw new ApiException('NOT_FOUND', 'Speciality not found');
    if (input.isActive === false && s.isActive && s._count.practitioners > 0) {
      throw new ApiException('CONFLICT', `${s._count.practitioners} published practitioner(s) use this speciality`);
    }
    const data: Prisma.SpecialityUpdateInput = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.group !== undefined ? { group: input.group } : {}),
      ...(input.canPrescribe !== undefined ? { canPrescribe: input.canPrescribe } : {}),
      ...(input.defaultMotives !== undefined ? { defaultMotives: this.checkMotives(input.defaultMotives) } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };
    await this.prisma.speciality.update({ where: { id }, data });
    await this.log(admin, 'referential.speciality.updated', 'Speciality', id, { before: { name: s.name, group: s.group, canPrescribe: s.canPrescribe, isActive: s.isActive }, after: input as Prisma.InputJsonValue });
    return (await this.specialities()).find((x) => x.id === id)!;
  }

  // ---- Localities ------------------------------------------------------------------------------------

  async localities(island?: string) {
    const rows = await this.prisma.locality.findMany({
      where: island ? { island: { slug: island } } : {},
      include: { island: true, _count: { select: { practices: true, patientProfiles: true } } },
      orderBy: [{ island: { name: 'asc' } }, { name: 'asc' }],
    });
    return rows.map((l) => ({ id: l.id, name: l.name, slug: l.slug, island: l.island.code, islandName: l.island.name, lat: l.lat, lng: l.lng, kind: l.kind, isActive: l.isActive, practices: l._count.practices, patients: l._count.patientProfiles }));
  }

  private checkPoint(lat: number, lng: number) {
    if (!isInComoros(lat, lng)) throw new ApiException('VALIDATION_FAILED', 'The point is outside the Comoros (latitude about -11.3 to -12.7, longitude 43.2 to 44.6)', { field: 'lat' });
  }

  /** A name shared by two islands gets the island in its slug (`mbeni-ndzuani`). */
  async createLocality(admin: AdminContext, input: LocalityInput) {
    this.checkPoint(input.lat, input.lng);
    const island = await this.prisma.island.findUniqueOrThrow({ where: { code: input.island } });
    const base = localitySlug(input.name);
    if (base.length < 2) throw new ApiException('VALIDATION_FAILED', 'Name too short', { field: 'name' });
    const taken = await this.prisma.locality.findUnique({ where: { slug: base } });
    if (taken?.islandId === island.id) throw new ApiException('CONFLICT', `${input.name} already exists on ${island.name}`);
    const slug = taken ? `${base}-${island.slug}` : base;
    try {
      const l = await this.prisma.locality.create({ data: { name: input.name.trim(), slug, islandId: island.id, lat: input.lat, lng: input.lng, kind: input.kind } });
      await this.log(admin, 'referential.locality.created', 'Locality', l.id, { name: l.name, slug, island: input.island });
      return (await this.localities()).find((x) => x.id === l.id)!;
    } catch (e) {
      if (isUnique(e)) throw new ApiException('CONFLICT', `A locality with the address « ${slug} » already exists`);
      throw e;
    }
  }

  async updateLocality(admin: AdminContext, id: string, input: Partial<Omit<LocalityInput, 'island'>> & { isActive?: boolean }) {
    const l = await this.prisma.locality.findUnique({ where: { id }, include: { _count: { select: { practices: true } } } });
    if (!l) throw new ApiException('NOT_FOUND', 'Locality not found');
    const lat = input.lat ?? l.lat;
    const lng = input.lng ?? l.lng;
    if (input.lat !== undefined || input.lng !== undefined) this.checkPoint(lat, lng);
    if (input.isActive === false && l.isActive && l._count.practices > 0) throw new ApiException('CONFLICT', `${l._count.practices} practice address(es) use this locality`);
    await this.prisma.locality.update({
      where: { id },
      data: { ...(input.name !== undefined ? { name: input.name.trim() } : {}), lat, lng, ...(input.kind !== undefined ? { kind: input.kind } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) },
    });
    await this.log(admin, 'referential.locality.updated', 'Locality', id, { before: { name: l.name, lat: l.lat, lng: l.lng, kind: l.kind, isActive: l.isActive }, after: input as Prisma.InputJsonValue });
    return (await this.localities()).find((x) => x.id === id)!;
  }

  // ---- Public holidays (read by the slot engine: no online slots on these days) ----------------------------

  async holidays(year: number) {
    const rows = await this.prisma.holiday.findMany({ where: { date: { gte: dateOf(`${year}-01-01`), lte: dateOf(`${year}-12-31`) } }, orderBy: { date: 'asc' } });
    return rows.map((h) => ({ date: h.date.toISOString().slice(0, 10), name: h.name, isEstimated: h.isEstimated }));
  }

  async createHoliday(admin: AdminContext, input: { date: string; name: string; isEstimated: boolean }) {
    try {
      await this.prisma.holiday.create({ data: { date: dateOf(input.date), name: input.name.trim(), isEstimated: input.isEstimated } });
    } catch (e) {
      if (isUnique(e)) throw new ApiException('CONFLICT', `There is already a holiday on ${input.date}`);
      throw e;
    }
    await this.log(admin, 'referential.holiday.created', 'Holiday', input.date, input);
    return this.holidays(Number(input.date.slice(0, 4)));
  }

  /** Moving an estimated Islamic holiday to its confirmed date is the common case: date, name and status change together. */
  async updateHoliday(admin: AdminContext, date: string, input: { date?: string; name?: string; isEstimated?: boolean }) {
    const h = await this.prisma.holiday.findUnique({ where: { date: dateOf(date) } });
    if (!h) throw new ApiException('NOT_FOUND', 'Holiday not found');
    const next = { date: dateOf(input.date ?? date), name: input.name?.trim() ?? h.name, isEstimated: input.isEstimated ?? h.isEstimated };
    try {
      await this.prisma.$transaction([this.prisma.holiday.delete({ where: { date: h.date } }), this.prisma.holiday.create({ data: next })]);
    } catch (e) {
      if (isUnique(e)) throw new ApiException('CONFLICT', `There is already a holiday on ${input.date}`);
      throw e;
    }
    await this.log(admin, 'referential.holiday.updated', 'Holiday', date, { before: { date, name: h.name, isEstimated: h.isEstimated }, after: input });
    return this.holidays(Number((input.date ?? date).slice(0, 4)));
  }

  async deleteHoliday(admin: AdminContext, date: string) {
    const h = await this.prisma.holiday.findUnique({ where: { date: dateOf(date) } });
    if (!h) throw new ApiException('NOT_FOUND', 'Holiday not found');
    await this.prisma.holiday.delete({ where: { date: h.date } });
    await this.log(admin, 'referential.holiday.deleted', 'Holiday', date, { name: h.name, isEstimated: h.isEstimated });
  }

  // ---- Drugs ---------------------------------------------------------------------------------------------------

  async drugs(q?: string) {
    const term = q?.trim();
    const rows = await this.prisma.drug.findMany({
      where: term ? { OR: [{ dci: { contains: term, mode: 'insensitive' } }, { brandNames: { has: term } }, { slug: { contains: term.toLowerCase() } }] } : {},
      include: { _count: { select: { pharmacyProducts: true, prescriptionLines: true } } },
      orderBy: [{ dci: 'asc' }, { strength: 'asc' }],
      take: 300,
    });
    return rows.map((d) => ({
      id: d.id, dci: d.dci, slug: d.slug, strength: d.strength, form: d.form, route: d.route, brandNames: d.brandNames, atcCode: d.atcCode,
      prescriptionOnly: d.prescriptionOnly, controlled: d.controlled, essential: d.essential, isActive: d.isActive,
      pharmacyProducts: d._count.pharmacyProducts, prescriptionLines: d._count.prescriptionLines,
    }));
  }

  async createDrug(admin: AdminContext, input: DrugInput) {
    const slug = drugSlug(input);
    try {
      const d = await this.prisma.drug.create({
        data: { slug, dci: input.dci.trim(), strength: input.strength.trim(), form: input.form.trim(), route: input.route, brandNames: [...new Set(input.brandNames.map((b) => b.trim()).filter(Boolean))], atcCode: input.atcCode?.trim() || null, essential: input.essential, ...drugFlags(input) },
      });
      await this.log(admin, 'referential.drug.created', 'Drug', d.id, { slug, ...drugFlags(input) });
      return (await this.drugs(d.dci)).find((x) => x.id === d.id)!;
    } catch (e) {
      if (isUnique(e)) throw new ApiException('CONFLICT', `${input.dci} ${input.strength} (${input.form}) already exists`);
      throw e;
    }
  }

  /**
   * DCI, strength and form define the drug (and its slug): to change them, create another drug and deactivate this one.
   * The prescription and controlled flags are copied to every pharmacy product linked to the drug (SPEC-15).
   */
  async updateDrug(admin: AdminContext, id: string, input: Partial<Omit<DrugInput, 'dci' | 'strength' | 'form'>> & { isActive?: boolean }) {
    const d = await this.prisma.drug.findUnique({ where: { id } });
    if (!d) throw new ApiException('NOT_FOUND', 'Drug not found');
    const flags = drugFlags({ prescriptionOnly: input.prescriptionOnly ?? d.prescriptionOnly, controlled: input.controlled ?? d.controlled });
    const [, products] = await this.prisma.$transaction([
      this.prisma.drug.update({
        where: { id },
        data: {
          ...flags,
          ...(input.route !== undefined ? { route: input.route } : {}),
          ...(input.brandNames !== undefined ? { brandNames: [...new Set(input.brandNames.map((b) => b.trim()).filter(Boolean))] } : {}),
          ...(input.atcCode !== undefined ? { atcCode: input.atcCode?.trim() || null } : {}),
          ...(input.essential !== undefined ? { essential: input.essential } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      }),
      this.prisma.pharmacyProduct.updateMany({ where: { drugId: id }, data: flags }),
    ]);
    await this.log(admin, 'referential.drug.updated', 'Drug', id, { before: { prescriptionOnly: d.prescriptionOnly, controlled: d.controlled, isActive: d.isActive }, after: input as Prisma.InputJsonValue, pharmacyProductsUpdated: products.count });
    return (await this.drugs(d.dci)).find((x) => x.id === id)!;
  }
}
