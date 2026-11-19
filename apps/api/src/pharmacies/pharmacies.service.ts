import { Injectable } from '@nestjs/common';
import type { IslandCode, Prisma } from '@prisma/client';
import { addDaysToDateKey, toDateKey, zonedToUtc } from '@twabibu/utils';
import { ApiException } from '../common/api-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hoursOn, isOpenAt, onDutyAt, overlaps, placementActive, type DeliveryZone, type OpeningHours } from './pharmacy-rules.js';

const ISLAND_BY_SLUG: Record<string, IslandCode> = { ngazidja: 'NGAZIDJA', ndzuani: 'NDZUANI', mwali: 'MWALI' };

export const pharmacyInclude = {
  pharmacyProfile: { include: { dutySchedules: true, placements: true } },
  practices: { include: { locality: { include: { island: true } } }, take: 1, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrganizationInclude;

type PharmacyRow = Prisma.OrganizationGetPayload<{ include: typeof pharmacyInclude }>;

const PUBLIC_ORG: Prisma.OrganizationWhereInput = { type: 'PHARMACY', status: { not: 'SUSPENDED' }, pharmacyProfile: { isNot: null } };

/** Public pharmacy card: what a patient needs to choose and reach a pharmacy. No account required. */
export function pharmacyCard(o: PharmacyRow, at: Date, slot?: 'LOCALITY_TOP' | 'DUTY_PAGE' | 'DRUG_PAGE') {
  const practice = o.practices[0];
  const profile = o.pharmacyProfile!;
  const duty = profile.dutySchedules.filter((d) => onDutyAt(d, at)).sort((a, b) => +b.endsAt - +a.endsAt)[0];
  const island = practice?.locality.island;
  const partner = profile.placements.some((p) => placementActive(p, at) && (!slot || p.slot === slot) && (!island || p.island === island.code));
  return {
    id: o.id,
    slug: o.slug,
    name: o.name,
    phone: o.phone,
    address: practice?.addressLine ?? null,
    locality: practice ? { name: practice.locality.name, slug: practice.locality.slug } : null,
    island: island ? { code: island.code, name: island.name, slug: island.slug } : null,
    lat: practice?.lat ?? null,
    lng: practice?.lng ?? null,
    openNow: !!duty || isOpenAt(practice?.openingHours as OpeningHours, at),
    hoursToday: hoursOn(practice?.openingHours as OpeningHours, at),
    onDutyUntil: duty?.endsAt.toISOString() ?? null,
    partner,
    verified: !!profile.verifiedAt,
    delivers: profile.services.includes('DELIVERY') && (profile.deliveryZones as unknown as DeliveryZone[]).length > 0,
    services: profile.services,
    paymentMethods: profile.paymentMethods,
  };
}

export type PharmacyCard = ReturnType<typeof pharmacyCard>;

/** Partners first (always labelled), then open pharmacies, then by name. */
const byPartnerOpenName = (a: PharmacyCard, b: PharmacyCard) => +b.partner - +a.partner || +b.openNow - +a.openNow || a.name.localeCompare(b.name, 'fr');

@Injectable()
export class PharmaciesService {
  constructor(private readonly prisma: PrismaService) {}

  private islandCode(slug?: string): IslandCode | undefined {
    if (!slug) return undefined;
    const code = ISLAND_BY_SLUG[slug];
    if (!code) throw new ApiException('NOT_FOUND', 'Unknown island');
    return code;
  }

  /** Directory: every pharmacy of an island or a locality. */
  async list(params: { island?: string; locality?: string }) {
    const code = this.islandCode(params.island);
    const rows = await this.prisma.organization.findMany({
      where: {
        ...PUBLIC_ORG,
        practices: { some: { locality: { ...(params.locality ? { slug: params.locality } : {}), ...(code ? { island: { code } } : {}) } } },
      },
      include: pharmacyInclude,
    });
    const now = new Date();
    return rows.map((o) => pharmacyCard(o, now, 'LOCALITY_TOP')).sort(byPartnerOpenName);
  }

  /**
   * Duty pharmacies of an island for a local day (`date`) or the 7 days from it (`week`).
   * Source and last update are shown: the official calendar wins (SPEC-15 §7.5).
   */
  async onDuty(params: { island: string; date?: string; week?: boolean }) {
    const code = this.islandCode(params.island)!;
    const now = new Date();
    const day = params.date ?? toDateKey(now);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ApiException('VALIDATION_FAILED', 'Invalid date');
    const from = zonedToUtc(day, 0);
    const to = zonedToUtc(addDaysToDateKey(day, params.week ? 7 : 1), 0);
    const duties = await this.prisma.dutySchedule.findMany({
      where: { island: code, startsAt: { lt: to }, endsAt: { gt: from }, pharmacy: { organization: PUBLIC_ORG } },
      orderBy: { startsAt: 'asc' },
    });
    const orgs = await this.prisma.organization.findMany({ where: { id: { in: [...new Set(duties.map((d) => d.pharmacyId))] } }, include: pharmacyInclude });
    const island = await this.prisma.island.findUniqueOrThrow({ where: { code } });
    const partners = await this.prisma.organization.findMany({
      where: { ...PUBLIC_ORG, pharmacyProfile: { placements: { some: { slot: 'DUTY_PAGE', island: code, startsAt: { lte: now }, endsAt: { gt: now } } } } },
      include: pharmacyInclude,
    });
    return {
      island: { code, name: island.name, frenchName: island.frenchName, slug: island.slug },
      date: day,
      week: !!params.week,
      updatedAt: duties.reduce<Date | null>((max, d) => (!max || d.updatedAt > max ? d.updatedAt : max), null)?.toISOString() ?? null,
      duties: duties
        // A duty already over (last night's) is of no use to someone looking for an open pharmacy.
        .filter((d) => overlaps(d, from, to) && d.endsAt > now)
        .map((d) => {
          const org = orgs.find((o) => o.id === d.pharmacyId)!;
          return { id: d.id, startsAt: d.startsAt.toISOString(), endsAt: d.endsAt.toISOString(), zone: d.zone, source: d.source, onDutyNow: onDutyAt(d, now), pharmacy: pharmacyCard(org, now, 'DUTY_PAGE') };
        })
        .sort((a, b) => +b.onDutyNow - +a.onDutyNow || a.startsAt.localeCompare(b.startsAt)),
      // The partner box shows partners not already listed as on duty for the period.
      partners: partners.filter((o) => !duties.some((d) => d.pharmacyId === o.id && d.endsAt > now)).map((o) => pharmacyCard(o, now, 'DUTY_PAGE')),
    };
  }

  /** Public profile and catalogue. Prices are indicative and dated (SPEC-15 §7.2). */
  async profile(slug: string) {
    const o = await this.prisma.organization.findFirst({ where: { ...PUBLIC_ORG, slug }, include: pharmacyInclude });
    if (!o) throw new ApiException('NOT_FOUND', 'Pharmacy not found');
    const now = new Date();
    const profile = o.pharmacyProfile!;
    const zones = profile.deliveryZones as unknown as DeliveryZone[];
    const [products, localities] = await Promise.all([
      this.prisma.pharmacyProduct.findMany({ where: { pharmacyId: o.id }, include: { drug: { select: { slug: true, dci: true } } }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
      this.prisma.locality.findMany({ where: { id: { in: zones.map((z) => z.localityId) } } }),
    ]);
    const practice = o.practices[0];
    return {
      ...pharmacyCard(o, now),
      description: o.description,
      pharmacistName: profile.pharmacistName,
      openingHours: (practice?.openingHours ?? {}) as OpeningHours,
      deliveryZones: zones
        .map((z) => ({ localityId: z.localityId, locality: localities.find((l) => l.id === z.localityId)?.name ?? '', feeKmf: z.feeKmf }))
        .filter((z) => z.locality),
      upcomingDuties: profile.dutySchedules
        .filter((d) => d.endsAt > now)
        .sort((a, b) => +a.startsAt - +b.startsAt)
        .slice(0, 5)
        .map((d) => ({ startsAt: d.startsAt.toISOString(), endsAt: d.endsAt.toISOString() })),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        priceKmf: p.priceKmf,
        availability: p.availability,
        prescriptionOnly: p.prescriptionOnly,
        controlled: p.controlled,
        drug: p.drug,
        updatedAt: p.updatedAt.toISOString(),
      })),
    };
  }

  /** Drug page: who has it, at what price. No medical advice; partners labelled. */
  async drugAvailability(slug: string, island?: string) {
    const code = this.islandCode(island);
    const drug = await this.prisma.drug.findUnique({ where: { slug } });
    if (!drug || !drug.isActive) throw new ApiException('NOT_FOUND', 'Drug not found');
    const products = await this.prisma.pharmacyProduct.findMany({
      where: {
        drugId: drug.id,
        pharmacy: { organization: { ...PUBLIC_ORG, ...(code ? { practices: { some: { locality: { island: { code } } } } } : {}) } },
      },
      include: { pharmacy: { include: { organization: { include: pharmacyInclude } } } },
    });
    const now = new Date();
    const offers = products
      .map((p) => {
        const card = pharmacyCard(p.pharmacy.organization, now, 'DRUG_PAGE');
        // A prescription-only drug is never advertised: no partner placement on its page (SPEC-15 §5).
        return { productId: p.id, priceKmf: p.priceKmf, availability: p.availability, updatedAt: p.updatedAt.toISOString(), pharmacy: { ...card, partner: card.partner && !drug.prescriptionOnly } };
      })
      .sort((a, b) => +(a.availability === 'OUT_OF_STOCK') - +(b.availability === 'OUT_OF_STOCK') || +b.pharmacy.partner - +a.pharmacy.partner || a.priceKmf - b.priceKmf);
    return {
      drug: { slug: drug.slug, dci: drug.dci, strength: drug.strength, form: drug.form, brandNames: drug.brandNames, prescriptionOnly: drug.prescriptionOnly, controlled: drug.controlled, essential: drug.essential },
      offers,
      inStockCount: offers.filter((o) => o.availability !== 'OUT_OF_STOCK').length,
    };
  }
}
