import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PAYMENT_METHODS, type Education, type PractitionerProfileUpdate } from '@twabibu/contracts';
import type { SessionUser } from '../auth/auth.types.js';
import { ApiException } from '../common/api-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { canEditProfile, type MembershipContext } from './permissions.js';
import { changedFields, cleanProfile, type CleanProfile } from './profile-rules.js';

const include = {
  speciality: { select: { slug: true, name: true } },
  practices: { include: { practice: { select: { locality: { select: { slug: true } } } } }, take: 1 },
} satisfies Prisma.PractitionerInclude;
type Row = Prisma.PractitionerGetPayload<{ include: typeof include }>;

const editable = (p: Row): CleanProfile => ({
  bio: p.bio,
  acceptsNewPatients: p.acceptsNewPatients,
  expertises: p.expertises,
  languages: p.languages,
  paymentMethods: p.paymentMethods.filter((m): m is (typeof PAYMENT_METHODS)[number] =>
    (PAYMENT_METHODS as readonly string[]).includes(m),
  ),
  insurancesAccepted: p.insurancesAccepted,
  // Rebuilt field by field: PostgreSQL reorders JSON keys, which would make every save look like a change.
  educations: (Array.isArray(p.educations) ? (p.educations as unknown as Education[]) : []).map((e) => ({
    year: e.year,
    diploma: e.diploma,
    school: e.school,
  })),
});

/** Public profile written in Twabibu Pro (SPEC-07 PRO-07): presentation, tags, languages, payment, diplomas. */
@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  private view(p: Row) {
    const { insurancesAccepted, ...rest } = editable(p);
    const online = p.isPublished && p.verificationStatus === 'VERIFIED' && !p.deletedAt;
    return {
      id: p.id,
      displayName: [p.title, p.firstName, p.lastName].filter(Boolean).join(' '),
      speciality: p.speciality.name,
      licenseNumber: p.licenseNumber,
      verificationStatus: p.verificationStatus,
      // Relative: the profile lives on the same site as Twabibu Pro.
      publicUrl: online
        ? `/${p.speciality.slug}/${p.practices[0]?.practice.locality.slug ?? 'comores'}/${p.slug}`
        : null,
      profile: { ...rest, insurances: insurancesAccepted },
    };
  }

  /** The profiles this member may edit, and the choices offered. A secretary edits none. */
  async list(m: MembershipContext) {
    const rows = await this.prisma.practitioner.findMany({
      where: { organizationId: m.organizationId, deletedAt: null },
      include,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    const mine = rows.filter((p) => canEditProfile(m, p.id));
    if (!mine.length)
      throw new ApiException('FORBIDDEN', 'Only practitioners and managers edit public profiles');
    const [languages, insurances] = await Promise.all([
      this.prisma.language.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.insurance.findMany({ orderBy: { name: 'asc' }, select: { name: true } }),
    ]);
    return {
      practitioners: mine.map((p) => this.view(p)),
      options: {
        languages: languages.map((l) => ({ code: l.code, name: l.name })),
        paymentMethods: [...PAYMENT_METHODS],
        insurances: insurances.map((i) => i.name),
      },
    };
  }

  async update(
    m: MembershipContext,
    actor: SessionUser,
    practitionerId: string,
    input: PractitionerProfileUpdate,
    ip?: string,
  ) {
    // Scoped to the practice: another practice's practitioner reads as not found.
    const p = await this.prisma.practitioner.findFirst({
      where: { id: practitionerId, organizationId: m.organizationId, deletedAt: null },
      include,
    });
    if (!p) throw new ApiException('NOT_FOUND', 'Practitioner not found');
    if (!canEditProfile(m, p.id)) throw new ApiException('FORBIDDEN', 'You cannot edit this profile');

    const cleaned = cleanProfile(input, new Date().getUTCFullYear());
    if (!cleaned.ok) throw new ApiException('VALIDATION_FAILED', cleaned.reason, { field: 'educations' });
    const next = cleaned.profile;
    // Languages and insurances come from the referentials, so that search filters keep working.
    const [languages, insurances] = await Promise.all([
      this.prisma.language.count({ where: { code: { in: next.languages } } }),
      this.prisma.insurance.count({ where: { name: { in: next.insurancesAccepted } } }),
    ]);
    if (languages !== next.languages.length)
      throw new ApiException('VALIDATION_FAILED', 'Unknown language', { field: 'languages' });
    if (insurances !== next.insurancesAccepted.length)
      throw new ApiException('VALIDATION_FAILED', 'Unknown insurance', { field: 'insurances' });

    const fields = changedFields(editable(p), next);
    if (!fields.length) return this.view(p);
    const [updated] = await this.prisma.$transaction([
      this.prisma.practitioner.update({
        where: { id: p.id },
        data: { ...next, educations: next.educations as unknown as Prisma.InputJsonValue },
        include,
      }),
      // Field names only: the content is public anyway, and the log stays small.
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          organizationId: m.organizationId,
          action: 'practitioner.profile.update',
          entityType: 'Practitioner',
          entityId: p.id,
          ip: ip ?? null,
          changes: { fields },
        },
      }),
    ]);
    return this.view(updated);
  }
}
