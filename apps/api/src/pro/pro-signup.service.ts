import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { normalizePhone, slugify } from '@twabibu/utils';
import { AuthService } from '../auth/auth.service.js';
import { practitionerName } from '../booking/appointment-view.js';
import { ApiException } from '../common/api-exception.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { emailTemplates } from '../notifications/email-templates.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PractitionerSignup {
  signupToken: string;
  kind: 'INDEPENDENT' | 'FACILITY';
  specialityId: string;
  title: 'DR' | 'NONE';
  firstName: string;
  lastName: string;
  licenseNumber: string;
  phone: string;
  organizationName: string;
  addressLine: string;
  localityId: string;
  acceptTerms: true;
}

type Group = 'MEDICAL' | 'DENTAL' | 'MIDWIFERY' | 'PARAMEDICAL' | 'PHARMACY' | 'LAB' | 'WELLBEING';
/** Starter motives by speciality group (SPEC-07 §Inscription 2): editable later in « Réglages ». */
export const MOTIVE_TEMPLATES: Record<Group, { name: string; durationMinutes: number }[]> = {
  MEDICAL: [
    { name: 'Première consultation', durationMinutes: 30 },
    { name: 'Consultation de suivi', durationMinutes: 20 },
  ],
  DENTAL: [
    { name: 'Première consultation dentaire', durationMinutes: 30 },
    { name: 'Détartrage', durationMinutes: 30 },
    { name: 'Soins dentaires', durationMinutes: 45 },
  ],
  MIDWIFERY: [
    { name: 'Consultation de suivi de grossesse', durationMinutes: 30 },
    { name: 'Consultation après l’accouchement', durationMinutes: 30 },
  ],
  PARAMEDICAL: [
    { name: 'Première séance', durationMinutes: 45 },
    { name: 'Séance de suivi', durationMinutes: 30 },
  ],
  PHARMACY: [{ name: 'Entretien', durationMinutes: 20 }],
  LAB: [{ name: 'Prélèvement', durationMinutes: 15 }],
  WELLBEING: [
    { name: 'Première séance', durationMinutes: 45 },
    { name: 'Séance de suivi', durationMinutes: 30 },
  ],
};

/**
 * Practitioner sign-up (SPEC-07, PRO-01). One transaction creates the account, the practice (PENDING), the practitioner
 * (PENDING verification, not published), the place, the OWNER membership, a default agenda and starter motives.
 * The practitioner can set everything up at once; patients only see the profile after the back-office validates it.
 */
@Injectable()
export class ProSignupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async signup(
    input: PractitionerSignup,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ sessionToken: string; organizationId: string }> {
    const email = await this.auth.signupEmail(input.signupToken);
    const phone = normalizePhone(input.phone);
    if (!phone) throw new ApiException('VALIDATION_FAILED', 'Invalid phone number', { field: 'phone' });
    const [speciality, locality] = await Promise.all([
      this.prisma.speciality.findFirst({ where: { id: input.specialityId, isActive: true } }),
      this.prisma.locality.findFirst({ where: { id: input.localityId, isActive: true } }),
    ]);
    if (!speciality)
      throw new ApiException('VALIDATION_FAILED', 'Unknown speciality', { field: 'specialityId' });
    if (!locality) throw new ApiException('VALIDATION_FAILED', 'Unknown locality', { field: 'localityId' });

    const title = input.title === 'DR' ? 'Dr' : null;
    const name = practitionerName({ title, firstName: input.firstName, lastName: input.lastName });
    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, emailVerifiedAt: new Date(), kind: 'PROFESSIONAL', lastLoginAt: new Date() },
      });
      const organization = await tx.organization.create({
        data: {
          name: input.organizationName,
          slug: await uniqueSlug(tx, 'organization', slugify(input.organizationName) || 'cabinet'),
          type: input.kind === 'INDEPENDENT' ? 'SOLO_PRACTICE' : 'HEALTH_CENTER',
          status: 'PENDING',
          phone,
          email,
        },
      });
      const practitioner = await tx.practitioner.create({
        data: {
          organizationId: organization.id,
          slug: await uniqueSlug(
            tx,
            'practitioner',
            slugify(`${input.firstName} ${input.lastName}`) || 'soignant',
          ),
          title,
          firstName: input.firstName,
          lastName: input.lastName,
          specialityId: speciality.id,
          licenseNumber: input.licenseNumber,
          canPrescribe: speciality.canPrescribe,
          languages: ['fr'],
          // Patients pay at the practice, almost always in cash: the practitioner adds mobile money in their profile if they take it.
          paymentMethods: ['CASH'],
          verificationStatus: 'PENDING',
          isPublished: false,
        },
      });
      const practice = await tx.practice.create({
        data: {
          organizationId: organization.id,
          name: input.organizationName,
          addressLine: input.addressLine,
          localityId: locality.id,
          lat: locality.lat,
          lng: locality.lng,
          phone,
        },
      });
      await tx.practitionerPractice.create({
        data: { practitionerId: practitioner.id, practiceId: practice.id },
      });
      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'OWNER',
          practitionerId: practitioner.id,
          acceptedAt: new Date(),
        },
      });
      await tx.agenda.create({
        data: {
          practitionerId: practitioner.id,
          practiceId: practice.id,
          name,
          isDefault: true,
          motives: {
            create: MOTIVE_TEMPLATES[speciality.group as Group].map((m, i) => ({ ...m, sortOrder: i })),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          organizationId: organization.id,
          action: 'practitioner.signup',
          entityType: 'Practitioner',
          entityId: practitioner.id,
          ip: meta.ip ?? null,
          changes: { speciality: speciality.name, kind: input.kind },
        },
      });
      return { userId: user.id, organizationId: organization.id };
    });

    await this.notifications.sendEmail({
      to: email,
      email: emailTemplates.proWelcome({ name, url: `${this.config.APP_URL}/pro/app` }),
      template: 'proWelcome',
    });
    const sessionToken = await this.auth.completeSignup(input.signupToken, created.userId, meta);
    return { sessionToken, organizationId: created.organizationId };
  }
}

/** `amina-said`, then `amina-said-2`, `amina-said-3`… */
async function uniqueSlug(
  tx: Prisma.TransactionClient,
  table: 'organization' | 'practitioner',
  base: string,
): Promise<string> {
  const taken = new Set(
    (table === 'organization'
      ? await tx.organization.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })
      : await tx.practitioner.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })
    ).map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}
