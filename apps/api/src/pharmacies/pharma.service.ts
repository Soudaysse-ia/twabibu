import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type OrderStatus, type ProductAvailability } from '@prisma/client';
import { addDaysToDateKey, normalizePhone, toDateKey, zonedToUtc } from '@twabibu/utils';
import { practitionerName } from '../booking/appointment-view.js';
import { ApiException } from '../common/api-exception.js';
import { emailTemplates } from '../notifications/email-templates.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { orderInclude, orderView, type ShareResponse } from './order-view.js';
import { OrdersService } from './orders.service.js';
import { isPharmacist, type PharmaMembership } from './pharma.guard.js';
import { nextStatuses, onDutyAt, placementActive, type DeliveryZone } from './pharmacy-rules.js';

export interface RespondInput {
  lines: { lineId: string; status: 'AVAILABLE' | 'SUBSTITUTE' | 'UNAVAILABLE'; productId?: string; productName?: string; unitPriceKmf?: number; quantity: number }[];
  readyInMinutes?: number;
  message?: string;
}

export interface ProductInput {
  drugId?: string;
  name?: string;
  category: 'medication' | 'parapharmacy' | 'equipment';
  priceKmf: number;
  availability: ProductAvailability;
}

const CATEGORY_LABELS: Record<string, ProductInput['category']> = { medicament: 'medication', parapharmacie: 'parapharmacy', materiel: 'equipment' };
const AVAILABILITY_LABELS: Record<string, ProductAvailability> = { 'en stock': 'IN_STOCK', faible: 'LOW', rupture: 'OUT_OF_STOCK', 'sur commande': 'ON_ORDER' };

const requirePharmacist = (m: PharmaMembership) => {
  if (!isPharmacist(m)) throw new ApiException('FORBIDDEN', 'Pharmacist only');
};

/** Twabibu Pharma (SPEC-15 §6): the pharmacy's own workspace. Every query is scoped to `m.organizationId`. */
@Injectable()
export class PharmaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async me(userId: string) {
    const rows = await this.prisma.membership.findMany({
      where: { userId, role: { in: ['OWNER', 'ADMIN', 'PHARMACIST', 'PHARMACY_STAFF'] }, organization: { type: 'PHARMACY', status: { not: 'SUSPENDED' } } },
      include: { organization: { include: { pharmacyProfile: { select: { verifiedAt: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({ organizationId: m.organizationId, organizationName: m.organization.name, slug: m.organization.slug, role: m.role, verified: !!m.organization.pharmacyProfile?.verifiedAt }));
  }

  async dashboard(m: PharmaMembership) {
    const now = new Date();
    const today = zonedToUtc(toDateKey(now), 0);
    const [inbox, open, todayOrders, duties, placements] = await Promise.all([
      this.prisma.prescriptionShare.count({ where: { pharmacyId: m.organizationId, status: 'SENT' } }),
      this.prisma.order.groupBy({ by: ['status'], where: { pharmacyId: m.organizationId, status: { notIn: ['DELIVERED', 'CANCELLED'] } }, _count: true }),
      this.prisma.order.findMany({ where: { pharmacyId: m.organizationId, createdAt: { gte: today }, status: { not: 'CANCELLED' } }, select: { subtotalKmf: true, deliveryFeeKmf: true } }),
      this.prisma.dutySchedule.findMany({ where: { pharmacyId: m.organizationId, endsAt: { gt: now } }, orderBy: { startsAt: 'asc' }, take: 3 }),
      this.prisma.sponsoredPlacement.findMany({ where: { pharmacyId: m.organizationId, endsAt: { gt: now } }, orderBy: { startsAt: 'asc' } }),
    ]);
    return {
      verified: m.verified,
      prescriptionsWaiting: inbox,
      openOrders: Object.fromEntries(open.map((g) => [g.status, g._count])) as Partial<Record<OrderStatus, number>>,
      todayOrders: todayOrders.length,
      todayRevenueKmf: todayOrders.reduce((s, o) => s + o.subtotalKmf + o.deliveryFeeKmf, 0),
      duties: duties.map((d) => ({ startsAt: d.startsAt.toISOString(), endsAt: d.endsAt.toISOString(), onDutyNow: onDutyAt(d, now), source: d.source })),
      placements: placements.map((p) => ({ slot: p.slot, island: p.island, startsAt: p.startsAt.toISOString(), endsAt: p.endsAt.toISOString(), active: placementActive(p, now) })),
    };
  }

  // ---- Prescriptions received -------------------------------------------------------------

  private async patientName(recordId: string): Promise<{ name: string; birthDate: string | null }> {
    const r = await this.prisma.medicalRecord.findUniqueOrThrow({ where: { id: recordId } });
    const person = r.patientProfileId
      ? await this.prisma.patientProfile.findUnique({ where: { id: r.patientProfileId } })
      : r.relativeId
        ? await this.prisma.relative.findUnique({ where: { id: r.relativeId } })
        : r.patientRecordId
          ? await this.prisma.patientRecord.findUnique({ where: { id: r.patientRecordId } })
          : null;
    return { name: person ? `${person.firstName} ${person.lastName}` : 'Patient', birthDate: person?.birthDate?.toISOString().slice(0, 10) ?? null };
  }

  /** Inbox. Reading a prescription is a read of the patient's record: logged like any clinical read. */
  async inbox(m: PharmaMembership, status?: string) {
    const where: Prisma.PrescriptionShareWhereInput = { pharmacyId: m.organizationId, ...(status === 'open' ? { status: { in: ['SENT', 'ANSWERED'] } } : status === 'done' ? { status: { in: ['ACCEPTED', 'DECLINED'] } } : {}) };
    const rows = await this.prisma.prescriptionShare.findMany({
      where,
      include: { prescription: { include: { lines: { orderBy: { sortOrder: 'asc' }, include: { drug: true } } } } },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
    const practitioners = await this.prisma.practitioner.findMany({ where: { id: { in: rows.map((r) => r.prescription.practitionerId) } } });
    const out = [];
    for (const r of rows) {
      const p = r.prescription;
      const prescriber = practitioners.find((x) => x.id === p.practitionerId);
      out.push({
        id: r.id,
        status: r.status,
        sentAt: r.sentAt.toISOString(),
        answeredAt: r.answeredAt?.toISOString() ?? null,
        response: (r.response as ShareResponse | null) ?? null,
        prescription: {
          id: p.id,
          code: p.qrCode,
          status: p.status,
          signedAt: p.signedAt?.toISOString() ?? null,
          expiresAt: p.expiresAt?.toISOString() ?? null,
          prescriber: prescriber ? practitionerName(prescriber) : 'Soignant',
          notes: p.notes,
          lines: p.lines.map((l) => ({
            id: l.id,
            label: l.drug ? `${l.drug.dci} ${l.drug.strength} (${l.drug.form})` : (l.freeText ?? ''),
            drugId: l.drugId,
            posologyText: l.posologyText,
            quantity: l.quantity,
            durationDays: l.durationDays,
            substitutable: l.substitutable,
            controlled: !!l.drug?.controlled,
          })),
        },
        patient: await this.patientName(p.recordId),
      });
    }
    // One log line per person, pharmacy member and 12 hours: the inbox refreshes itself every few seconds.
    const recordIds = [...new Set(rows.map((r) => r.prescription.recordId))];
    if (recordIds.length) {
      const recent = await this.prisma.recordAccessLog.findMany({
        where: { recordId: { in: recordIds }, actorUserId: m.userId, organizationId: m.organizationId, section: 'prescription-pharmacy', createdAt: { gt: new Date(Date.now() - 12 * 3600 * 1000) } },
        select: { recordId: true },
      });
      const logged = new Set(recent.map((r) => r.recordId));
      const fresh = recordIds.filter((id) => !logged.has(id));
      if (fresh.length) await this.prisma.recordAccessLog.createMany({ data: fresh.map((recordId) => ({ recordId, actorUserId: m.userId, organizationId: m.organizationId, section: 'prescription-pharmacy' })) });
    }
    return out;
  }

  /** The pharmacist answers line by line: available, substitute (only if allowed), unavailable. */
  async respond(m: PharmaMembership, shareId: string, input: RespondInput) {
    requirePharmacist(m);
    const share = await this.prisma.prescriptionShare.findFirst({
      where: { id: shareId, pharmacyId: m.organizationId },
      include: { prescription: { include: { lines: { include: { drug: true } } } } },
    });
    if (!share) throw new ApiException('NOT_FOUND', 'Request not found');
    if (share.status !== 'SENT' && share.status !== 'ANSWERED') throw new ApiException('CONFLICT', 'The patient already decided');
    const lines = share.prescription.lines;
    if (input.lines.length !== lines.length || new Set(input.lines.map((l) => l.lineId)).size !== lines.length) {
      throw new ApiException('VALIDATION_FAILED', 'Answer every line once');
    }
    const productIds = input.lines.map((l) => l.productId).filter((id): id is string => !!id);
    const products = await this.prisma.pharmacyProduct.findMany({ where: { id: { in: productIds }, pharmacyId: m.organizationId } });
    if (products.length !== new Set(productIds).size) throw new ApiException('VALIDATION_FAILED', 'Unknown product');
    const answered: ShareResponse['lines'] = input.lines.map((a) => {
      const line = lines.find((l) => l.id === a.lineId);
      if (!line) throw new ApiException('VALIDATION_FAILED', 'Unknown prescription line');
      const label = line.drug ? `${line.drug.dci} ${line.drug.strength}` : (line.freeText ?? '');
      if (a.status === 'SUBSTITUTE' && !line.substitutable) throw new ApiException('VALIDATION_FAILED', 'The prescriber did not allow substitution', { lineId: a.lineId });
      if (a.status === 'UNAVAILABLE') return { lineId: a.lineId, label, status: a.status, productId: null, productName: null, unitPriceKmf: null, quantity: a.quantity, controlled: !!line.drug?.controlled };
      const product = a.productId ? products.find((p) => p.id === a.productId)! : null;
      const price = product?.priceKmf ?? a.unitPriceKmf;
      if (price === undefined || price === null) throw new ApiException('VALIDATION_FAILED', 'Price required', { lineId: a.lineId });
      return {
        lineId: a.lineId,
        label,
        status: a.status,
        productId: product?.id ?? null,
        productName: product?.name ?? a.productName ?? label,
        unitPriceKmf: price,
        quantity: a.quantity,
        controlled: !!line.drug?.controlled || !!product?.controlled,
      };
    });
    const response: ShareResponse = {
      lines: answered,
      readyInMinutes: input.readyInMinutes ?? null,
      message: input.message ?? null,
      totalKmf: answered.reduce((s, l) => s + (l.unitPriceKmf ?? 0) * l.quantity, 0),
    };
    await this.prisma.prescriptionShare.update({ where: { id: share.id }, data: { status: 'ANSWERED', response: response as unknown as Prisma.InputJsonValue, answeredAt: new Date() } });
    await this.notifyAnswer(share.prescription.recordId, m.organizationId);
    return response;
  }

  private async notifyAnswer(recordId: string, pharmacyId: string) {
    const record = await this.prisma.medicalRecord.findUniqueOrThrow({ where: { id: recordId } });
    const owner = record.patientProfileId
      ? await this.prisma.patientProfile.findUnique({ where: { id: record.patientProfileId }, include: { user: true } })
      : record.relativeId
        ? (await this.prisma.relative.findUnique({ where: { id: record.relativeId }, include: { patientProfile: { include: { user: true } } } }))?.patientProfile
        : null;
    if (!owner?.user.email) return;
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: pharmacyId } });
    await this.notifications.sendEmail({
      to: owner.user.email,
      userId: owner.userId,
      template: 'prescriptionAnswered',
      email: emailTemplates.prescriptionAnswered({ firstName: owner.firstName, pharmacyName: org.name, url: `${this.config.APP_URL}/mon-compte/ordonnances` }),
    });
  }

  // ---- Orders --------------------------------------------------------------------------------

  async orderList(m: PharmaMembership, scope?: string) {
    const since = zonedToUtc(addDaysToDateKey(toDateKey(new Date()), -7), 0);
    const rows = await this.prisma.order.findMany({
      where: { pharmacyId: m.organizationId, ...(scope === 'all' ? {} : { OR: [{ status: { notIn: ['DELIVERED', 'CANCELLED'] } }, { updatedAt: { gte: since } }] }) },
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return Promise.all(rows.map(async (o) => ({ ...orderView(o), next: nextStatuses(o.status, o.mode), patient: await this.orderPatient(o.patientProfileId) })));
  }

  private async orderPatient(profileId: string | null) {
    if (!profileId) return null;
    const p = await this.prisma.patientProfile.findUnique({ where: { id: profileId } });
    return p ? { name: `${p.firstName} ${p.lastName}` } : null;
  }

  async order(m: PharmaMembership, id: string) {
    const o = await this.prisma.order.findFirst({ where: { id, pharmacyId: m.organizationId }, include: orderInclude });
    if (!o) throw new ApiException('NOT_FOUND', 'Order not found');
    return { ...orderView(o), next: nextStatuses(o.status, o.mode), patient: await this.orderPatient(o.patientProfileId) };
  }

  /** Moves an order one step. Delivering an order made from a prescription records the dispensation. */
  async setStatus(m: PharmaMembership, id: string, input: { status: OrderStatus; courier?: { name: string; phone: string }; note?: string }) {
    const o = await this.prisma.order.findFirst({ where: { id, pharmacyId: m.organizationId } });
    if (!o) throw new ApiException('NOT_FOUND', 'Order not found');
    if (!nextStatuses(o.status, o.mode).includes(input.status)) throw new ApiException('ORDER_STATUS_INVALID', `Cannot go from ${o.status} to ${input.status}`);
    let courier: Prisma.InputJsonValue | undefined;
    if (input.status === 'OUT_FOR_DELIVERY') {
      const phone = input.courier ? normalizePhone(input.courier.phone) : null;
      if (!input.courier || !phone) throw new ApiException('VALIDATION_FAILED', 'Courier name and phone required', { field: 'courier' });
      courier = { name: input.courier.name, phone };
    }
    if (input.status === 'DELIVERED' && o.prescriptionId) requirePharmacist(m);
    const moved = await this.prisma.order.updateMany({ where: { id, status: o.status }, data: { status: input.status, ...(courier ? { courier } : {}) } });
    if (!moved.count) throw new ApiException('ORDER_STATUS_INVALID', 'Order changed meanwhile');
    await this.prisma.orderEvent.create({ data: { orderId: id, status: input.status, actorUserId: m.userId, note: input.note ?? null } });
    if (input.status === 'DELIVERED' && o.prescriptionId) await this.dispense(m, o.prescriptionId);
    if (input.status === 'CANCELLED' && o.prescriptionId) {
      await this.prisma.prescriptionShare.updateMany({ where: { prescriptionId: o.prescriptionId, pharmacyId: m.organizationId, status: 'ACCEPTED' }, data: { status: 'DECLINED' } });
    }
    const full = await this.prisma.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
    await this.orders.notifyPatient(full);
    return this.order(m, id);
  }

  /** Dispensation (SPEC-14 RX-05): visible to the prescriber and the patient on the prescription. */
  private async dispense(m: PharmaMembership, prescriptionId: string) {
    const share = await this.prisma.prescriptionShare.findUnique({ where: { prescriptionId_pharmacyId: { prescriptionId, pharmacyId: m.organizationId } } });
    const response = share?.response as ShareResponse | null;
    const given = (response?.lines ?? []).filter((l) => l.status !== 'UNAVAILABLE');
    const p = await this.prisma.prescription.findUniqueOrThrow({ where: { id: prescriptionId }, include: { lines: true, dispensations: true } });
    const already = new Set(p.dispensations.flatMap((d) => (d.lines as { lineId: string }[]).map((l) => l.lineId)));
    await this.prisma.dispensation.create({
      data: {
        prescriptionId,
        pharmacyId: m.organizationId,
        dispensedById: m.userId,
        lines: given.map((l) => ({ lineId: l.lineId, quantity: l.quantity, substitutedBy: l.status === 'SUBSTITUTE' ? l.productName : null })),
      },
    });
    given.forEach((l) => already.add(l.lineId));
    const complete = p.lines.every((l) => already.has(l.id));
    await this.prisma.prescription.update({ where: { id: prescriptionId }, data: { status: complete ? 'DISPENSED' : 'PARTIALLY_DISPENSED' } });
  }

  // ---- Catalogue -------------------------------------------------------------------------------

  async products(m: PharmaMembership, q?: string) {
    const rows = await this.prisma.pharmacyProduct.findMany({
      where: { pharmacyId: m.organizationId, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
      include: { drug: { select: { slug: true, dci: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return rows.map((p) => ({ id: p.id, name: p.name, category: p.category, priceKmf: p.priceKmf, availability: p.availability, prescriptionOnly: p.prescriptionOnly, controlled: p.controlled, drugId: p.drugId, drug: p.drug, updatedAt: p.updatedAt.toISOString() }));
  }

  /** A product tied to the reference inherits its prescription and controlled flags: the pharmacy cannot lift them. */
  private async productData(input: ProductInput) {
    if (input.drugId) {
      const drug = await this.prisma.drug.findUnique({ where: { id: input.drugId } });
      if (!drug || !drug.isActive) throw new ApiException('VALIDATION_FAILED', 'Unknown or withdrawn drug');
      return { drugId: drug.id, name: input.name?.trim() || `${drug.dci} ${drug.strength} (${drug.form})`, category: 'medication', prescriptionOnly: drug.prescriptionOnly, controlled: drug.controlled };
    }
    if (!input.name?.trim()) throw new ApiException('VALIDATION_FAILED', 'Name required');
    // Free products (parapharmacy, equipment) are sold without prescription; medicines must come from the reference.
    if (input.category === 'medication') throw new ApiException('VALIDATION_FAILED', 'A medicine must be chosen in the reference', { field: 'drugId' });
    return { drugId: null, name: input.name.trim(), category: input.category, prescriptionOnly: false, controlled: false };
  }

  async createProduct(m: PharmaMembership, input: ProductInput) {
    requirePharmacist(m);
    const data = await this.productData(input);
    if (data.drugId && (await this.prisma.pharmacyProduct.findFirst({ where: { pharmacyId: m.organizationId, drugId: data.drugId } }))) {
      throw new ApiException('CONFLICT', 'Already in the catalogue');
    }
    const p = await this.prisma.pharmacyProduct.create({ data: { ...data, pharmacyId: m.organizationId, priceKmf: input.priceKmf, availability: input.availability } });
    return (await this.products(m)).find((x) => x.id === p.id)!;
  }

  /** Staff may update stock; prices and names are for pharmacists. */
  async updateProduct(m: PharmaMembership, id: string, input: { priceKmf?: number; availability?: ProductAvailability; name?: string }) {
    const p = await this.prisma.pharmacyProduct.findFirst({ where: { id, pharmacyId: m.organizationId } });
    if (!p) throw new ApiException('NOT_FOUND', 'Product not found');
    if ((input.priceKmf !== undefined || input.name !== undefined) && !isPharmacist(m)) throw new ApiException('FORBIDDEN', 'Pharmacist only');
    await this.prisma.pharmacyProduct.update({ where: { id }, data: { priceKmf: input.priceKmf, availability: input.availability, name: input.name?.trim() || undefined } });
    return (await this.products(m)).find((x) => x.id === id)!;
  }

  async deleteProduct(m: PharmaMembership, id: string) {
    requirePharmacist(m);
    const p = await this.prisma.pharmacyProduct.findFirst({ where: { id, pharmacyId: m.organizationId }, include: { _count: { select: { orderLines: true } } } });
    if (!p) throw new ApiException('NOT_FOUND', 'Product not found');
    // Ordered products stay for the order history: mark them out of stock instead.
    if (p._count.orderLines) throw new ApiException('CONFLICT', 'Product already ordered: mark it out of stock');
    await this.prisma.pharmacyProduct.delete({ where: { id } });
  }

  /**
   * CSV import (`;` or `,`): nom ; prix ; disponibilité ; catégorie ; médicament (slug du référentiel, facultatif).
   * Existing lines (same reference drug or same name) are updated. Returns a line-by-line report.
   */
  async importProducts(m: PharmaMembership, csv: string) {
    requirePharmacist(m);
    const rows = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (rows[0] && /^nom\s*[;,]/i.test(rows[0])) rows.shift();
    const report = { created: 0, updated: 0, errors: [] as { line: number; message: string }[] };
    const drugs = await this.prisma.drug.findMany({ where: { isActive: true }, select: { id: true, slug: true } });
    for (const [i, row] of rows.slice(0, 2000).entries()) {
      const line = i + 2;
      const [name = '', price = '', availability = 'en stock', category = '', drugSlug = ''] = row.split(row.includes(';') ? ';' : ',').map((c) => c.trim());
      const priceKmf = Number(price.replace(/\s/g, ''));
      const avail = AVAILABILITY_LABELS[availability.toLowerCase()] ?? (availability ? null : 'IN_STOCK');
      const drug = drugSlug ? drugs.find((d) => d.slug === drugSlug) : undefined;
      if (!Number.isInteger(priceKmf) || priceKmf < 0 || priceKmf > 10_000_000) report.errors.push({ line, message: 'Prix invalide' });
      else if (!avail) report.errors.push({ line, message: 'Disponibilité inconnue (en stock, faible, rupture, sur commande)' });
      else if (drugSlug && !drug) report.errors.push({ line, message: 'Médicament absent du référentiel' });
      else {
        try {
          const data = await this.productData({ drugId: drug?.id, name, category: CATEGORY_LABELS[category.toLowerCase()] ?? (drug ? 'medication' : 'parapharmacy'), priceKmf, availability: avail });
          const existing = await this.prisma.pharmacyProduct.findFirst({ where: { pharmacyId: m.organizationId, ...(data.drugId ? { drugId: data.drugId } : { name: { equals: data.name, mode: 'insensitive' } }) } });
          if (existing) {
            await this.prisma.pharmacyProduct.update({ where: { id: existing.id }, data: { priceKmf, availability: avail } });
            report.updated++;
          } else {
            await this.prisma.pharmacyProduct.create({ data: { ...data, pharmacyId: m.organizationId, priceKmf, availability: avail } });
            report.created++;
          }
        } catch (error) {
          report.errors.push({ line, message: error instanceof ApiException ? 'Ligne incomplète : un médicament doit venir du référentiel' : 'Ligne illisible' });
        }
      }
    }
    return report;
  }

  // ---- Duty and profile ----------------------------------------------------------------------

  async duties(m: PharmaMembership) {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const rows = await this.prisma.dutySchedule.findMany({ where: { pharmacyId: m.organizationId, endsAt: { gt: since } }, orderBy: { startsAt: 'asc' } });
    const now = new Date();
    return rows.map((d) => ({ id: d.id, startsAt: d.startsAt.toISOString(), endsAt: d.endsAt.toISOString(), source: d.source, onDutyNow: onDutyAt(d, now), past: d.endsAt <= now, updatedAt: d.updatedAt.toISOString() }));
  }

  async profile(m: PharmaMembership) {
    const o = await this.prisma.organization.findUniqueOrThrow({ where: { id: m.organizationId }, include: { pharmacyProfile: true } });
    const zones = o.pharmacyProfile!.deliveryZones as unknown as DeliveryZone[];
    const localities = await this.prisma.locality.findMany({ where: { id: { in: zones.map((z) => z.localityId) } } });
    return {
      name: o.name,
      slug: o.slug,
      phone: o.phone,
      email: o.email,
      description: o.description,
      verified: !!o.pharmacyProfile!.verifiedAt,
      services: o.pharmacyProfile!.services,
      paymentMethods: o.pharmacyProfile!.paymentMethods,
      deliveryZones: zones.map((z) => ({ ...z, locality: localities.find((l) => l.id === z.localityId)?.name ?? '' })),
    };
  }

  async updateProfile(m: PharmaMembership, input: { phone?: string; description?: string; services?: string[]; paymentMethods?: string[]; deliveryZones?: DeliveryZone[] }) {
    if (m.role !== 'OWNER' && m.role !== 'ADMIN' && m.role !== 'PHARMACIST') throw new ApiException('FORBIDDEN', 'Pharmacist only');
    let phone: string | undefined;
    if (input.phone !== undefined) {
      phone = normalizePhone(input.phone) ?? undefined;
      if (!phone) throw new ApiException('VALIDATION_FAILED', 'Invalid phone number', { field: 'phone' });
    }
    if (input.deliveryZones) {
      const ids = input.deliveryZones.map((z) => z.localityId);
      if (new Set(ids).size !== ids.length) throw new ApiException('VALIDATION_FAILED', 'Duplicate locality');
      if ((await this.prisma.locality.count({ where: { id: { in: ids } } })) !== ids.length) throw new ApiException('VALIDATION_FAILED', 'Unknown locality');
    }
    await this.prisma.organization.update({
      where: { id: m.organizationId },
      data: {
        phone,
        description: input.description,
        pharmacyProfile: {
          update: {
            services: input.services,
            paymentMethods: input.paymentMethods,
            deliveryZones: input.deliveryZones ? (input.deliveryZones as unknown as Prisma.InputJsonValue) : undefined,
          },
        },
      },
    });
    return this.profile(m);
  }
}
