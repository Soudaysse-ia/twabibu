import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PracticeUpdate } from '@twabibu/contracts';
import { normalizePhone } from '@twabibu/utils';
import type { SessionUser } from '../auth/auth.types.js';
import { ApiException } from '../common/api-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { canManagePractice, type MembershipContext } from './permissions.js';
import { cleanAccessInfo, cleanOpeningHours } from './practice-rules.js';

const include = { locality: { include: { island: true } } } satisfies Prisma.PracticeInclude;
type Row = Prisma.PracticeGetPayload<{ include: typeof include }>;

/** JSON with sorted keys: PostgreSQL reorders the keys of stored JSON, which must not count as a change. */
const stable = (v: unknown): string =>
  JSON.stringify(v, (_, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : x,
  );

/** Places of consultation of the practice (SPEC-07 PRO-06): everyone in the practice reads them, managers edit them. */
@Injectable()
export class PracticeService {
  constructor(private readonly prisma: PrismaService) {}

  private view(p: Row) {
    return {
      id: p.id,
      name: p.name,
      addressLine: p.addressLine,
      locality: { id: p.locality.id, name: p.locality.name, island: p.locality.island.slug },
      phone: p.phone,
      position: p.lat !== null && p.lng !== null ? { lat: p.lat, lng: p.lng } : null,
      accessInfo: p.accessInfo,
      openingHours: p.openingHours,
    };
  }

  async list(m: MembershipContext) {
    const rows = await this.prisma.practice.findMany({
      where: { organizationId: m.organizationId },
      include,
      orderBy: { createdAt: 'asc' },
    });
    return { canEdit: canManagePractice(m), practices: rows.map((p) => this.view(p)) };
  }

  async update(
    m: MembershipContext,
    actor: SessionUser,
    practiceId: string,
    input: PracticeUpdate,
    ip?: string,
  ) {
    // Scoped to the practice: another practice's place reads as not found.
    const current = await this.prisma.practice.findFirst({
      where: { id: practiceId, organizationId: m.organizationId },
    });
    if (!current) throw new ApiException('NOT_FOUND', 'Practice not found');
    if (!canManagePractice(m)) throw new ApiException('FORBIDDEN', 'Owner or administrator only');

    const hours = cleanOpeningHours(input.openingHours);
    if (!hours.ok)
      throw new ApiException(
        'VALIDATION_FAILED',
        `Opening hours overlap or end before they start (${hours.day})`,
        { field: 'openingHours', day: hours.day },
      );
    const phone = input.phone ? normalizePhone(input.phone) : null;
    if (input.phone && !phone)
      throw new ApiException('VALIDATION_FAILED', 'Invalid phone number', { field: 'phone' });
    const locality = await this.prisma.locality.findFirst({
      where: { id: input.localityId, isActive: true },
    });
    if (!locality) throw new ApiException('VALIDATION_FAILED', 'Unknown locality', { field: 'localityId' });
    // No pin placed: the centre of the locality, as at sign-up, so the place still shows on the map.
    const position = input.position ?? { lat: locality.lat, lng: locality.lng };

    const data = {
      name: input.name,
      addressLine: input.addressLine,
      localityId: locality.id,
      phone,
      lat: position.lat,
      lng: position.lng,
      accessInfo: cleanAccessInfo(input.accessInfo),
      openingHours: hours.hours as Prisma.InputJsonValue,
    };
    const before: Record<string, unknown> = { ...current };
    const fields = Object.keys(data).filter(
      (k) => stable(before[k]) !== stable(data[k as keyof typeof data]),
    );
    const [updated] = await this.prisma.$transaction([
      this.prisma.practice.update({ where: { id: current.id }, data, include }),
      ...(fields.length
        ? [
            this.prisma.auditLog.create({
              data: {
                actorUserId: actor.id,
                organizationId: m.organizationId,
                action: 'practice.update',
                entityType: 'Practice',
                entityId: current.id,
                ip: ip ?? null,
                changes: { fields },
              },
            }),
          ]
        : []),
    ]);
    return this.view(updated);
  }
}
