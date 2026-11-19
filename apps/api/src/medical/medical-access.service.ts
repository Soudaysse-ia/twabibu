import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { SessionUser } from '../auth/auth.types.js';
import { ApiException } from '../common/api-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MembershipContext } from '../pro/permissions.js';

export interface RecordContext {
  recordId: string;
  patientRecord: Prisma.PatientRecordGetPayload<object>;
  /** True when the patient has shared the whole record with this organisation. */
  shared: boolean;
  /** Prisma filter on `organizationId` for entries this organisation may read. */
  visibleWhere: { organizationId?: string };
}

/**
 * Who may open a medical record (SPEC-13 §Principes, ADR-012):
 * - only members linked to a practitioner (never a secretary, never the platform);
 * - one record per person, shared between practices only with the patient's consent;
 *   without consent, a practice sees only what it wrote itself;
 * - every read is logged in RecordAccessLog, which the patient can see.
 */
@Injectable()
export class MedicalAccessService {
  constructor(private readonly prisma: PrismaService) {}

  requireClinician(m: MembershipContext): void {
    if (!m.practitionerId) throw new ApiException('FORBIDDEN', 'The medical record is reserved to practitioners');
  }

  /** Finds (or creates) the medical record behind a practice's patient file. */
  async open(m: MembershipContext, patientRecordId: string): Promise<RecordContext> {
    this.requireClinician(m);
    const patientRecord = await this.prisma.patientRecord.findFirst({ where: { id: patientRecordId, organizationId: m.organizationId, deletedAt: null } });
    if (!patientRecord) throw new ApiException('NOT_FOUND', 'Patient not found');

    // The person: a relative of an account holder, the account holder, or someone without an account.
    const where: Prisma.MedicalRecordWhereUniqueInput = patientRecord.relativeId
      ? { relativeId: patientRecord.relativeId }
      : patientRecord.patientProfileId
        ? { patientProfileId: patientRecord.patientProfileId }
        : { patientRecordId: patientRecord.id };
    const record =
      (await this.prisma.medicalRecord.findUnique({ where })) ??
      (await this.prisma.medicalRecord.create({
        data: patientRecord.relativeId
          ? { relativeId: patientRecord.relativeId }
          : patientRecord.patientProfileId
            ? { patientProfileId: patientRecord.patientProfileId }
            : { patientRecordId: patientRecord.id },
      }));

    const personal = !!(patientRecord.relativeId || patientRecord.patientProfileId);
    const consent = personal
      ? await this.prisma.recordConsent.findFirst({ where: { recordId: record.id, organizationId: m.organizationId, revokedAt: null } })
      : null;
    // A record without an account belongs to this practice only: everything in it is visible here.
    const shared = !personal || !!consent;
    return { recordId: record.id, patientRecord, shared, visibleWhere: shared ? {} : { organizationId: m.organizationId } };
  }

  async log(ctx: RecordContext, user: SessionUser, m: MembershipContext, section: string): Promise<void> {
    await this.prisma.recordAccessLog.create({ data: { recordId: ctx.recordId, actorUserId: user.id, organizationId: m.organizationId, section } });
  }
}
