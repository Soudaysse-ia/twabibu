import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { canManagePractice, type MembershipContext } from './permissions.js';
import { setupSteps, type PlaceFacts, type PractitionerFacts } from './setup-rules.js';

/** Same pin as the town centre, to the metre: sign-up copies the locality coordinates exactly. */
const SAME = 1e-5;

/** « Votre cabinet est prêt à X % » on the Pro home (SPEC-07 PRO-02). Reads settings only, never patient data. */
@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  async progress(m: MembershipContext) {
    const manager = canManagePractice(m);
    // A secretary sets nothing up here: no checklist.
    if (!manager && !m.practitionerId) return { percent: null, steps: [] };

    // The practitioner's own setup; for the direction without an agenda of its own, every practitioner's.
    const practitioners = await this.prisma.practitioner.findMany({
      where: {
        organizationId: m.organizationId,
        deletedAt: null,
        ...(m.practitionerId ? { id: m.practitionerId } : {}),
      },
      select: {
        verificationStatus: true,
        bio: true,
        agendas: {
          where: { isDefault: true },
          select: {
            motives: { where: { isActive: true }, select: { isOnline: true, priceKmf: true } },
            _count: { select: { availabilityRules: true } },
          },
        },
      },
    });
    const facts: PractitionerFacts[] = practitioners.map((p) => {
      const agenda = p.agendas[0];
      const motives = agenda?.motives ?? [];
      return {
        verificationStatus: p.verificationStatus,
        activeMotives: motives.length,
        onlineMotivesWithoutPrice: motives.filter((x) => x.isOnline && x.priceKmf === null).length,
        availabilityRules: agenda?._count.availabilityRules ?? 0,
        hasBio: !!p.bio?.trim(),
      };
    });

    let places: PlaceFacts[] | null = null;
    if (manager) {
      const rows = await this.prisma.practice.findMany({
        where: { organizationId: m.organizationId },
        select: {
          addressLine: true,
          lat: true,
          lng: true,
          openingHours: true,
          locality: { select: { lat: true, lng: true } },
        },
      });
      places = rows.map((p) => ({
        hasAddress: p.addressLine.trim().length >= 3,
        pinAtLocalityCentre:
          p.lat === null ||
          p.lng === null ||
          (Math.abs(p.lat - p.locality.lat) < SAME && Math.abs(p.lng - p.locality.lng) < SAME),
        openDays: Object.values((p.openingHours ?? {}) as Record<string, unknown[]>).filter(
          (r) => Array.isArray(r) && r.length > 0,
        ).length,
      }));
    }
    return setupSteps({ practitioners: facts, places });
  }
}
