import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { searchKey } from '@twabibu/utils';
import type { SessionUser } from '../auth/auth.types.js';
import { practitionerName } from '../booking/appointment-view.js';
import { ApiException } from '../common/api-exception.js';
import { sha256 } from '../common/crypto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MembershipContext } from '../pro/permissions.js';
import { allergyMatches, sharesComponent } from './drug-rules.js';
import { MedicalAccessService } from './medical-access.service.js';

export interface PrescriptionLineInput {
  drugId?: string;
  freeText?: string;
  posologyText: string;
  quantity?: number;
  durationDays?: number;
  substitutable: boolean;
}

export interface Alert {
  type: 'ALLERGY' | 'DUPLICATE_LINE' | 'ALREADY_TREATED' | 'CONTROLLED';
  lineIndex: number;
  message: string;
  blocking: boolean;
}

const VALIDITY_DAYS = 90;
const QR_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function qrCode(): string {
  return [...randomBytes(10)].map((b) => QR_ALPHABET[b % QR_ALPHABET.length]).join('');
}

const prescriptionInclude = {
  lines: { orderBy: { sortOrder: 'asc' }, include: { drug: true } },
  record: true,
} satisfies Prisma.PrescriptionInclude;

/** Digital prescription (SPEC-14): rule-based alerts, signature, verification code. */
@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MedicalAccessService,
  ) {}

  async searchDrugs(q: string) {
    const term = searchKey(q);
    if (term.length < 2) return [];
    const rows = await this.prisma.$queryRaw<{ id: string; dci: string; brandNames: string[]; form: string; strength: string; prescriptionOnly: boolean; controlled: boolean }[]>`
      SELECT id, dci, "brandNames", form, strength, "prescriptionOnly", controlled FROM "Drug"
      WHERE "isActive" AND (unaccent(lower(dci)) LIKE ${`%${term}%`} OR EXISTS (SELECT 1 FROM unnest("brandNames") b WHERE unaccent(lower(b)) LIKE ${`%${term}%`}))
      ORDER BY (unaccent(lower(dci)) LIKE ${`${term}%`}) DESC, dci, strength LIMIT 15`;
    return rows.map((d) => ({ ...d, label: `${d.dci} ${d.strength} (${d.form})` }));
  }

  /** Alerts for a draft prescription. Only an allergy blocks; the others inform. */
  async check(m: MembershipContext, recordId: string, lines: PrescriptionLineInput[]): Promise<Alert[]> {
    const ctx = await this.access.open(m, recordId);
    // Allergies are always checked against the whole record, whoever wrote them: safety first.
    const [allergies, treatments, drugs] = await Promise.all([
      this.prisma.allergy.findMany({ where: { recordId: ctx.recordId, resolvedAt: null } }),
      this.prisma.currentTreatment.findMany({ where: { recordId: ctx.recordId, status: 'ACTIVE' }, include: { drug: true } }),
      this.prisma.drug.findMany({ where: { id: { in: lines.map((l) => l.drugId).filter((x): x is string => !!x) } } }),
    ]);
    const alerts: Alert[] = [];
    lines.forEach((line, i) => {
      const drug = drugs.find((d) => d.id === line.drugId);
      if (!drug) return;
      for (const a of allergies) {
        if (allergyMatches(a, drug.dci)) alerts.push({ type: 'ALLERGY', lineIndex: i, blocking: true, message: `Allergie connue : ${a.substance}${a.reaction ? ` (${a.reaction})` : ''}.` });
      }
      lines.slice(0, i).forEach((other, j) => {
        const otherDrug = drugs.find((d) => d.id === other.drugId);
        if (otherDrug && sharesComponent(otherDrug.dci, drug.dci)) alerts.push({ type: 'DUPLICATE_LINE', lineIndex: i, blocking: false, message: `Même principe actif que la ligne ${j + 1}.` });
      });
      for (const t of treatments) {
        if (t.drug && sharesComponent(t.drug.dci, drug.dci)) alerts.push({ type: 'ALREADY_TREATED', lineIndex: i, blocking: false, message: `Déjà en traitement : ${t.label}.` });
      }
      if (drug.controlled) alerts.push({ type: 'CONTROLLED', lineIndex: i, blocking: false, message: 'Médicament contrôlé : durée limitée, jamais délivrable en ligne.' });
    });
    return alerts;
  }

  async sign(
    m: MembershipContext,
    user: SessionUser,
    recordId: string,
    input: { lines: PrescriptionLineInput[]; appointmentId?: string; notes?: string; allergyOverride?: { justification: string } },
  ) {
    const practitioner = await this.prisma.practitioner.findUnique({ where: { id: m.practitionerId ?? '' } });
    if (!practitioner || !practitioner.canPrescribe || practitioner.verificationStatus !== 'VERIFIED') {
      throw new ApiException('PRESCRIBER_NOT_ALLOWED', 'Only verified practitioners allowed to prescribe can sign');
    }
    const ctx = await this.access.open(m, recordId);
    const alerts = await this.check(m, recordId, input.lines);
    const blocking = alerts.filter((a) => a.blocking);
    if (blocking.length && !(input.allergyOverride && input.allergyOverride.justification.trim().length >= 5)) {
      throw new ApiException('ALLERGY_CONFLICT', 'Allergy conflict', { alerts: blocking });
    }
    const drugs = await this.prisma.drug.findMany({ where: { id: { in: input.lines.map((l) => l.drugId).filter((x): x is string => !!x) } } });
    // A drug withdrawn from the reference by the back-office can no longer be prescribed.
    for (const l of input.lines) if (l.drugId && !drugs.some((d) => d.id === l.drugId && d.isActive)) throw new ApiException('VALIDATION_FAILED', 'Unknown or withdrawn drug');
    let appointmentId: string | null = null;
    if (input.appointmentId) {
      const appt = await this.prisma.appointment.findFirst({ where: { id: input.appointmentId, patientRecordId: ctx.patientRecord.id, agenda: { practitioner: { organizationId: m.organizationId } } } });
      if (!appt) throw new ApiException('NOT_FOUND', 'Appointment not found');
      appointmentId = appt.id;
    }

    const signedAt = new Date();
    const lines = input.lines.map((l, i) => {
      const drug = drugs.find((d) => d.id === l.drugId);
      return {
        drugId: drug?.id ?? null,
        freeText: drug ? null : (l.freeText ?? null),
        strength: drug?.strength ?? null,
        form: drug?.form ?? null,
        posology: {},
        posologyText: l.posologyText,
        quantity: l.quantity ?? null,
        durationDays: l.durationDays ?? null,
        substitutable: l.substitutable,
        sortOrder: i,
      };
    });
    // The hash freezes what was signed: any later change would be detectable.
    const contentHash = sha256(JSON.stringify({ recordId: ctx.recordId, practitionerId: practitioner.id, signedAt: signedAt.toISOString(), lines }));
    const prescription = await this.prisma.prescription.create({
      data: {
        recordId: ctx.recordId,
        practitionerId: practitioner.id,
        organizationId: m.organizationId,
        appointmentId,
        type: 'MEDICATION',
        status: 'SIGNED',
        signedAt,
        contentHash,
        qrCode: qrCode(),
        expiresAt: new Date(signedAt.getTime() + VALIDITY_DAYS * 86_400_000),
        notes: input.notes ?? null,
        lines: { create: lines },
      },
    });
    // Signed medicines become current treatments in the record (SPEC-14 §Cycle de vie).
    const today = new Date(`${signedAt.toISOString().slice(0, 10)}T00:00:00Z`);
    for (const l of lines) {
      const drug = drugs.find((d) => d.id === l.drugId);
      if (!drug) continue;
      await this.prisma.currentTreatment.create({
        data: {
          recordId: ctx.recordId,
          organizationId: m.organizationId,
          authorId: user.id,
          drugId: drug.id,
          label: `${drug.dci} ${drug.strength}`,
          posology: l.posologyText,
          startedOn: today,
          endsOn: l.durationDays ? new Date(today.getTime() + l.durationDays * 86_400_000) : null,
          prescriptionId: prescription.id,
        },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        organizationId: m.organizationId,
        action: blocking.length ? 'prescription.signed_with_allergy_override' : 'prescription.signed',
        entityType: 'Prescription',
        entityId: prescription.id,
        changes: blocking.length ? { justification: input.allergyOverride!.justification } : undefined,
      },
    });
    return { id: prescription.id, qrCode: prescription.qrCode, alerts };
  }

  /** Everything needed to print the prescription. */
  async document(where: Prisma.PrescriptionWhereInput) {
    const p = await this.prisma.prescription.findFirst({ where: { ...where, status: { not: 'DRAFT' } }, include: prescriptionInclude });
    if (!p) throw new ApiException('NOT_FOUND', 'Prescription not found');
    const practitioner = await this.prisma.practitioner.findUniqueOrThrow({
      where: { id: p.practitionerId },
      include: { speciality: true, organization: true, practices: { include: { practice: { include: { locality: { include: { island: true } } } } }, take: 1 } },
    });
    const person = p.record.relativeId
      ? await this.prisma.relative.findUnique({ where: { id: p.record.relativeId } })
      : p.record.patientProfileId
        ? await this.prisma.patientProfile.findUnique({ where: { id: p.record.patientProfileId } })
        : await this.prisma.patientRecord.findUnique({ where: { id: p.record.patientRecordId ?? '' } });
    const practice = practitioner.practices[0]?.practice;
    return {
      id: p.id,
      status: p.status,
      signedAt: p.signedAt?.toISOString() ?? null,
      expiresAt: p.expiresAt?.toISOString() ?? null,
      qrCode: p.qrCode,
      contentHash: p.contentHash,
      notes: p.notes,
      prescriber: {
        name: practitionerName(practitioner),
        speciality: practitioner.speciality.name,
        licenseNumber: practitioner.licenseNumber,
        organization: practitioner.organization.name,
        address: practice ? `${practice.addressLine}, ${practice.locality.name} (${practice.locality.island.name})` : null,
        phone: practice?.phone ?? practitioner.organization.phone,
      },
      patient: person
        ? { firstName: person.firstName, lastName: person.lastName, birthDate: person.birthDate ? person.birthDate.toISOString().slice(0, 10) : null }
        : null,
      lines: p.lines.map((l) => ({
        label: l.drug ? `${l.drug.dci} ${l.drug.strength}` : (l.freeText ?? ''),
        form: l.drug?.form ?? l.form,
        brandNames: l.drug?.brandNames ?? [],
        posologyText: l.posologyText,
        quantity: l.quantity,
        durationDays: l.durationDays,
        substitutable: l.substitutable,
      })),
    };
  }

  async forPractice(m: MembershipContext, prescriptionId: string) {
    this.access.requireClinician(m);
    return this.document({ id: prescriptionId, organizationId: m.organizationId });
  }

  /** Public check behind the QR code: validity and prescriber only, never the medicines or the patient. */
  async verify(code: string) {
    const p = await this.prisma.prescription.findUnique({ where: { qrCode: code }, include: { dispensations: { orderBy: { dispensedAt: 'desc' }, take: 1 } } });
    if (!p || p.status === 'DRAFT') throw new ApiException('NOT_FOUND', 'Unknown prescription');
    const practitioner = await this.prisma.practitioner.findUniqueOrThrow({ where: { id: p.practitionerId }, include: { speciality: true, organization: true } });
    const expired = !!p.expiresAt && p.expiresAt < new Date();
    return {
      code,
      valid: !expired && p.status !== 'CANCELLED',
      status: expired && p.status === 'SIGNED' ? 'EXPIRED' : p.status,
      signedAt: p.signedAt?.toISOString() ?? null,
      expiresAt: p.expiresAt?.toISOString() ?? null,
      prescriber: { name: practitionerName(practitioner), speciality: practitioner.speciality.name, organization: practitioner.organization.name, verified: practitioner.verificationStatus === 'VERIFIED' },
      lastDispensedAt: p.dispensations[0]?.dispensedAt.toISOString() ?? null,
    };
  }

  /** Prescriptions of the signed-in patient and of their relatives. */
  async forPatient(user: SessionUser) {
    const profileId = user.patientProfileId!;
    const relatives = await this.prisma.relative.findMany({ where: { patientProfileId: profileId }, select: { id: true } });
    const records = await this.prisma.medicalRecord.findMany({ where: { OR: [{ patientProfileId: profileId }, { relativeId: { in: relatives.map((r) => r.id) } }] }, select: { id: true } });
    const list = await this.prisma.prescription.findMany({
      where: { recordId: { in: records.map((r) => r.id) }, status: { not: 'DRAFT' } },
      include: { lines: { orderBy: { sortOrder: 'asc' }, include: { drug: true } } },
      orderBy: { signedAt: 'desc' },
    });
    const ids = [...new Set(list.map((p) => p.practitionerId))];
    const practitioners = await this.prisma.practitioner.findMany({ where: { id: { in: ids } } });
    return list.map((p) => ({
      id: p.id,
      status: p.status,
      signedAt: p.signedAt?.toISOString() ?? null,
      expiresAt: p.expiresAt?.toISOString() ?? null,
      qrCode: p.qrCode,
      prescriber: practitionerName(practitioners.find((x) => x.id === p.practitionerId) ?? { title: null, firstName: '', lastName: 'Soignant' }),
      lines: p.lines.map((l) => ({ label: l.drug ? `${l.drug.dci} ${l.drug.strength}` : (l.freeText ?? ''), posologyText: l.posologyText })),
    }));
  }

  async forPatientDocument(user: SessionUser, prescriptionId: string) {
    const mine = (await this.forPatient(user)).some((p) => p.id === prescriptionId);
    if (!mine) throw new ApiException('NOT_FOUND', 'Prescription not found');
    return this.document({ id: prescriptionId });
  }
}
