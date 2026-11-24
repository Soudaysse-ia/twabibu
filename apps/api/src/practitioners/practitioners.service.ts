import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { addDaysToDateKey, searchKey, toDateKey } from '@twabibu/utils';
import { ApiException } from '../common/api-exception.js';
import { AvailabilityService } from '../availability/availability.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const PAGE_SIZE = 10;
const GRID_DAYS = 5;
const AROUND_ME_RADIUS_KM = 25;

const PAYMENT_LABELS: Record<string, string> = { CASH: 'Espèces', MVOLA: 'MVola', HURI: 'Huri Money', CARD: 'Carte bancaire', TRANSFER: 'Virement' };

const publicPractitioner = { isPublished: true, verificationStatus: 'VERIFIED', deletedAt: null } satisfies Prisma.PractitionerWhereInput;

const profileInclude = {
  speciality: true,
  organization: { select: { name: true, slug: true, type: true, phone: true } },
  practices: { include: { practice: { include: { locality: { include: { island: true } } } } } },
  agendas: {
    where: { isDefault: true },
    include: { motives: { where: { isActive: true, isOnline: true }, orderBy: { sortOrder: 'asc' } } },
  },
} satisfies Prisma.PractitionerInclude;

type ProfileRow = Prisma.PractitionerGetPayload<{ include: typeof profileInclude }>;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export interface SearchParams {
  q?: string;
  ou?: string;
  lat?: number;
  lng?: number;
  page: number;
  patientProfileId?: string | null;
  /** Has a free online slot within this many days (0 = today). */
  dispo?: number;
  langues?: string[];
  paiement?: string[];
  assurance?: string;
  nouveaux?: boolean;
  tri?: 'pertinence' | 'dispo' | 'distance';
}

@Injectable()
export class PractitionersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  private displayName(p: { title: string | null; firstName: string; lastName: string }): string {
    return [p.title, p.firstName, p.lastName].filter(Boolean).join(' ');
  }

  private mainPractice(p: ProfileRow) {
    return p.practices[0]?.practice ?? null;
  }

  private profileUrl(p: ProfileRow): string {
    const practice = this.mainPractice(p);
    return `/${p.speciality.slug}/${practice?.locality.slug ?? 'comores'}/${p.slug}`;
  }

  /**
   * Everything search engines may list (SPEC-01 §10, SEARCH-08): each public profile, and each « speciality × place »
   * page that has at least one result, for a locality or a whole island. Same visibility rule as the search itself.
   */
  async sitemap() {
    const rows = await this.prisma.practitioner.findMany({
      where: publicPractitioner,
      select: {
        slug: true,
        updatedAt: true,
        speciality: { select: { slug: true, name: true } },
        practices: { select: { practice: { select: { locality: { select: { slug: true, name: true, island: { select: { slug: true, name: true } } } } } } } },
      },
      orderBy: { slug: 'asc' },
    });
    const pages = new Map<string, { url: string; speciality: string; place: string; kind: 'LOCALITY' | 'ISLAND'; count: number }>();
    const practitioners = rows.map((p) => {
      const places = new Map<string, { slug: string; name: string; kind: 'LOCALITY' | 'ISLAND' }>();
      for (const { practice } of p.practices) {
        places.set(practice.locality.slug, { slug: practice.locality.slug, name: practice.locality.name, kind: 'LOCALITY' });
        places.set(practice.locality.island.slug, { slug: practice.locality.island.slug, name: practice.locality.island.name, kind: 'ISLAND' });
      }
      // Counted once per practitioner and place, even with two practices in the same town.
      for (const place of places.values()) {
        const url = `/${p.speciality.slug}/${place.slug}`;
        const page = pages.get(url) ?? { url, speciality: p.speciality.name, place: place.name, kind: place.kind, count: 0 };
        page.count += 1;
        pages.set(url, page);
      }
      const main = p.practices[0]?.practice.locality.slug ?? 'comores';
      return { url: `/${p.speciality.slug}/${main}/${p.slug}`, updatedAt: p.updatedAt };
    });
    return { practitioners, pages: [...pages.values()].sort((a, b) => a.url.localeCompare(b.url)) };
  }

  /**
   * « Signaler un problème avec ce profil » (SPEC-02, PROFILE-06): stored for the back-office queue (ADMIN-07).
   * Only public profiles can be reported. The honeypot drops robots silently; the reporter is kept only when signed in.
   */
  async report(slug: string, input: { reason: string; details?: string; website?: string }, reporterId: string | null): Promise<void> {
    if (input.website && input.website.trim()) return;
    const practitioner = await this.prisma.practitioner.findFirst({ where: { slug, ...publicPractitioner }, select: { id: true } });
    if (!practitioner) throw new ApiException('NOT_FOUND', 'Practitioner not found');
    await this.prisma.report.create({ data: { entityType: 'Practitioner', entityId: practitioner.id, reason: input.reason, details: input.details || null, reporterId } });
  }

  /** Public profile (SPEC-02). Only verified, published practitioners are ever returned. */
  async profile(slug: string) {
    const p = await this.prisma.practitioner.findFirst({ where: { slug, ...publicPractitioner }, include: profileInclude });
    if (!p) throw new ApiException('NOT_FOUND', 'Practitioner not found');
    const languages = await this.prisma.language.findMany({ where: { code: { in: p.languages } } });
    const agenda = p.agendas[0] ?? null;
    const prices = agenda?.motives.map((m) => m.priceKmf).filter((v): v is number => v !== null) ?? [];
    return {
      id: p.id,
      slug: p.slug,
      url: this.profileUrl(p),
      title: p.title,
      firstName: p.firstName,
      lastName: p.lastName,
      displayName: this.displayName(p),
      initials: `${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase(),
      photoUrl: p.photoUrl,
      bio: p.bio,
      verified: p.verificationStatus === 'VERIFIED',
      acceptsNewPatients: p.acceptsNewPatients,
      speciality: { slug: p.speciality.slug, name: p.speciality.name },
      languages: p.languages.map((code) => ({ code, name: languages.find((l) => l.code === code)?.name ?? code })),
      expertises: p.expertises,
      paymentMethods: p.paymentMethods.map((m) => PAYMENT_LABELS[m] ?? m),
      insurances: p.insurancesAccepted,
      educations: p.educations,
      organization: p.organization,
      practices: p.practices.map(({ practice: pr }) => ({
        id: pr.id,
        name: pr.name,
        addressLine: pr.addressLine,
        locality: { slug: pr.locality.slug, name: pr.locality.name },
        island: { slug: pr.locality.island.slug, name: pr.locality.island.name, frenchName: pr.locality.island.frenchName },
        lat: pr.lat,
        lng: pr.lng,
        phone: pr.phone,
        accessInfo: pr.accessInfo,
        openingHours: pr.openingHours,
      })),
      agenda: agenda && {
        id: agenda.id,
        practiceId: agenda.practiceId,
        onlineBookingEnabled: agenda.onlineBookingEnabled,
        requiresValidation: agenda.requiresValidation,
        bookingHorizonDays: agenda.bookingHorizonDays,
        motives: agenda.motives.map((m) => ({
          id: m.id,
          name: m.name,
          durationMinutes: m.durationMinutes,
          priceKmf: m.priceKmf,
          instructions: m.instructions,
          newPatientsAllowed: m.newPatientsAllowed,
          cancellationDeadlineHours: m.cancellationDeadlineHours,
        })),
      },
      priceFromKmf: prices.length ? Math.min(...prices) : null,
    };
  }

  /** Slots of one motive between two local dates (max 14 days per call). */
  async availabilities(slug: string, motiveId: string, from: string, to: string, ctx: { patientProfileId?: string | null; bookingSessionId?: string }) {
    const motive = await this.prisma.motive.findFirst({
      where: { id: motiveId, isActive: true, agenda: { practitioner: { slug, ...publicPractitioner } } },
      select: { agendaId: true },
    });
    if (!motive) throw new ApiException('NOT_FOUND', 'Motive not found for this practitioner');
    const result = await this.availability.days(motive.agendaId, motiveId, from, to, { source: 'ONLINE', ...ctx });
    if (!result) throw new ApiException('NOT_FOUND', 'Agenda not found');
    return {
      agendaId: motive.agendaId,
      reason: result.reason,
      days: result.days.map((d) => ({ date: d.date, slots: d.slots.map((s) => ({ startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() })) })),
    };
  }

  /** Search results with the 5-day availability grid (SPEC-01). */
  async search(params: SearchParams) {
    const where: Prisma.PractitionerWhereInput[] = [publicPractitioner];
    const q = params.q?.trim() ?? '';
    if (q.startsWith('soignant:')) {
      where.push({ slug: q.slice('soignant:'.length) });
    } else if (q) {
      const speciality = await this.prisma.speciality.findUnique({ where: { slug: q } });
      if (speciality) where.push({ specialityId: speciality.id });
      else {
        const term = searchKey(q);
        where.push({
          OR: [
            { lastName: { contains: term, mode: 'insensitive' } },
            { firstName: { contains: term, mode: 'insensitive' } },
            { speciality: { name: { contains: q, mode: 'insensitive' } } },
            { speciality: { slug: { contains: term.replace(/\s+/g, '-') } } },
          ],
        });
      }
    }

    let origin: { lat: number; lng: number } | null = null;
    const ou = params.ou?.trim() ?? '';
    if (ou === 'autour-de-moi' && params.lat !== undefined && params.lng !== undefined) {
      origin = { lat: params.lat, lng: params.lng };
    } else if (ou) {
      const island = await this.prisma.island.findUnique({ where: { slug: ou } });
      if (island) where.push({ practices: { some: { practice: { locality: { islandId: island.id } } } } });
      else {
        const locality = await this.prisma.locality.findUnique({ where: { slug: ou } });
        if (locality) where.push({ practices: { some: { practice: { localityId: locality.id } } } });
        else where.push({ practices: { some: { practice: { locality: { name: { contains: ou, mode: 'insensitive' } } } } } });
      }
    }

    let rows = await this.prisma.practitioner.findMany({ where: { AND: where }, include: profileInclude, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] });
    const distances = new Map<string, number>();
    if (origin) {
      for (const p of rows) {
        const pr = this.mainPractice(p);
        const point = pr && (pr.lat !== null && pr.lng !== null ? { lat: pr.lat, lng: pr.lng } : { lat: pr.locality.lat, lng: pr.locality.lng });
        if (point) distances.set(p.id, haversineKm(origin, point));
      }
      rows = rows.filter((p) => (distances.get(p.id) ?? Infinity) <= AROUND_ME_RADIUS_KM).sort((a, b) => distances.get(a.id)! - distances.get(b.id)!);
    }

    // Filter options come from the results before filtering, so a choice never empties its own list (SPEC-01 §7).
    const languageCodes = [...new Set(rows.flatMap((p) => p.languages))];
    const languageNames = await this.prisma.language.findMany({ where: { code: { in: languageCodes } } });
    const facets = {
      languages: languageCodes.map((code) => ({ code, name: languageNames.find((l) => l.code === code)?.name ?? code })).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      paymentMethods: [...new Set(rows.flatMap((p) => p.paymentMethods))].map((code) => ({ code, name: PAYMENT_LABELS[code] ?? code })),
      insurances: [...new Set(rows.flatMap((p) => p.insurancesAccepted))].sort((a, b) => a.localeCompare(b, 'fr')),
    };
    if (params.langues?.length) rows = rows.filter((p) => params.langues!.some((l) => p.languages.includes(l)));
    if (params.paiement?.length) rows = rows.filter((p) => params.paiement!.some((m) => p.paymentMethods.includes(m)));
    if (params.assurance) rows = rows.filter((p) => p.insurancesAccepted.includes(params.assurance!));
    if (params.nouveaux) rows = rows.filter((p) => p.acceptsNewPatients);

    // Availability filter and sort need each practitioner's first online slot (computed once).
    const firstSlots = new Map<string, number>();
    if (params.dispo !== undefined || params.tri === 'dispo') {
      const horizon = params.dispo ?? 60;
      await Promise.all(
        rows.map(async (p) => {
          const agenda = p.agendas[0];
          const motive = agenda?.motives.find((m) => m.newPatientsAllowed) ?? agenda?.motives[0];
          if (!agenda || !motive) return;
          const first = await this.availability.firstSlot(agenda.id, motive.id, Math.min(horizon, agenda.bookingHorizonDays), { source: 'ONLINE', patientProfileId: params.patientProfileId });
          if (first) firstSlots.set(p.id, first.getTime());
        }),
      );
      if (params.dispo !== undefined) rows = rows.filter((p) => firstSlots.has(p.id));
      if (params.tri === 'dispo') rows = [...rows].sort((a, b) => (firstSlots.get(a.id) ?? Infinity) - (firstSlots.get(b.id) ?? Infinity));
    }
    if (params.tri === 'distance' && origin) rows = [...rows].sort((a, b) => (distances.get(a.id) ?? Infinity) - (distances.get(b.id) ?? Infinity));

    const total = rows.length;
    const page = rows.slice((params.page - 1) * PAGE_SIZE, params.page * PAGE_SIZE);
    const today = toDateKey(new Date());
    const items = await Promise.all(
      page.map(async (p) => {
        const agenda = p.agendas[0];
        const motive = agenda?.motives.find((m) => m.newPatientsAllowed) ?? agenda?.motives[0];
        const practice = this.mainPractice(p);
        let days: { date: string; slots: string[] }[] = [];
        let reason: string | null = agenda ? null : 'NO_ONLINE_AGENDA';
        let nextAvailabilityAt: string | null = null;
        if (agenda && motive) {
          const ctx = { source: 'ONLINE' as const, patientProfileId: params.patientProfileId };
          const grid = await this.availability.days(agenda.id, motive.id, today, addDaysToDateKey(today, GRID_DAYS - 1), ctx);
          reason = grid?.reason ?? null;
          days = Array.from({ length: GRID_DAYS }, (_, i) => {
            const date = addDaysToDateKey(today, i);
            const found = grid?.days.find((d) => d.date === date);
            return { date, slots: (found?.slots ?? []).map((s) => s.startsAt.toISOString()) };
          });
          if (!reason && days.every((d) => d.slots.length === 0)) {
            nextAvailabilityAt = (await this.availability.firstSlot(agenda.id, motive.id, agenda.bookingHorizonDays, ctx))?.toISOString() ?? null;
          }
        } else if (agenda) reason = 'NO_ONLINE_MOTIVE';
        const prices = agenda?.motives.map((m) => m.priceKmf).filter((v): v is number => v !== null) ?? [];
        return {
          id: p.id,
          slug: p.slug,
          url: this.profileUrl(p),
          displayName: this.displayName(p),
          initials: `${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase(),
          photoUrl: p.photoUrl,
          verified: true,
          acceptsNewPatients: p.acceptsNewPatients,
          speciality: { slug: p.speciality.slug, name: p.speciality.name },
          practice: practice && {
            addressLine: practice.addressLine,
            locality: practice.locality.name,
            island: practice.locality.island.name,
            distanceKm: distances.has(p.id) ? Math.round(distances.get(p.id)! * 10) / 10 : null,
            // Map position: the practice, or its locality when the practice has no coordinates.
            lat: practice.lat ?? practice.locality.lat,
            lng: practice.lng ?? practice.locality.lng,
          },
          languages: p.languages,
          priceFromKmf: prices.length ? Math.min(...prices) : null,
          motiveId: motive?.id ?? null,
          days,
          reason,
          nextAvailabilityAt,
        };
      }),
    );
    return { items, total, page: params.page, pageSize: PAGE_SIZE, facets };
  }
}
