import { Inject, Injectable } from '@nestjs/common';
import type { VitalType } from '@prisma/client';
import type { SessionUser } from '../auth/auth.types.js';
import { practitionerName } from '../booking/appointment-view.js';
import { ApiException } from '../common/api-exception.js';
import { FIELD_CRYPTO, FieldCrypto } from '../common/field-crypto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { MembershipContext } from '../pro/permissions.js';
import { MedicalAccessService, type RecordContext } from './medical-access.service.js';

export interface ConsultationSections {
  reason?: string;
  history?: string;
  examination?: string;
  diagnosis?: string;
  plan?: string;
}

const dateOnly = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const day = (v?: string | null) => (v ? new Date(`${v}T00:00:00Z`) : null);

/** Medical record of a patient, seen from a practice (SPEC-13). */
@Injectable()
export class MedicalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: MedicalAccessService,
    @Inject(FIELD_CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  private author(ctx: RecordContext, user: SessionUser, m: MembershipContext) {
    return { recordId: ctx.recordId, organizationId: m.organizationId, authorId: user.id };
  }

  /** Everything the practitioner needs on one screen, allergies first. */
  async synthesis(m: MembershipContext, user: SessionUser, patientRecordId: string) {
    const ctx = await this.access.open(m, patientRecordId);
    await this.access.log(ctx, user, m, 'synthesis');
    const where = { recordId: ctx.recordId, ...ctx.visibleWhere };
    const [record, allergies, history, treatments, vaccinations, vitals, consultations, prescriptions] = await Promise.all([
      this.prisma.medicalRecord.findUniqueOrThrow({ where: { id: ctx.recordId } }),
      this.prisma.allergy.findMany({ where: { ...where, resolvedAt: null }, orderBy: { notedAt: 'desc' } }),
      this.prisma.medicalHistoryItem.findMany({ where, orderBy: [{ type: 'asc' }, { occurredOn: 'desc' }] }),
      this.prisma.currentTreatment.findMany({ where: { ...where, status: 'ACTIVE' }, orderBy: { startedOn: 'desc' } }),
      this.prisma.vaccination.findMany({ where, orderBy: { givenOn: 'desc' } }),
      this.prisma.vital.findMany({ where, orderBy: { measuredAt: 'desc' }, take: 200 }),
      this.prisma.consultation.findMany({ where: { recordId: ctx.recordId, ...(ctx.shared ? {} : { organizationId: m.organizationId }) }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.prescription.findMany({
        where: { recordId: ctx.recordId, status: { not: 'DRAFT' }, ...(ctx.shared ? {} : { organizationId: m.organizationId }) },
        include: { lines: { orderBy: { sortOrder: 'asc' }, include: { drug: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    const practitionerIds = [...new Set(consultations.map((c) => c.practitionerId))];
    const practitioners = await this.prisma.practitioner.findMany({ where: { id: { in: practitionerIds } } });
    const nameOf = (id: string) => {
      const p = practitioners.find((x) => x.id === id);
      return p ? practitionerName(p) : 'Soignant';
    };
    const latest = new Map<VitalType, { value: number; measuredAt: string }>();
    for (const v of vitals) if (!latest.has(v.type)) latest.set(v.type, { value: v.value, measuredAt: v.measuredAt.toISOString() });
    const p = ctx.patientRecord;

    return {
      patient: {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        birthDate: dateOnly(p.birthDate),
        sex: p.sex,
        phone: p.phone,
        hasAccount: !!(p.patientProfileId || p.relativeId),
      },
      shared: ctx.shared,
      bloodGroup: record.bloodGroup,
      allergies: allergies.map((a) => ({ id: a.id, substance: a.substance, drugDci: a.drugDci, reaction: a.reaction, severity: a.severity, source: a.source, notedAt: a.notedAt.toISOString() })),
      history: history.map((h) => ({ id: h.id, type: h.type, label: h.label, occurredOn: dateOnly(h.occurredOn), details: h.detailsEncrypted ? this.crypto.decrypt(h.detailsEncrypted) : null })),
      treatments: treatments.map((t) => ({ id: t.id, label: t.label, posology: t.posology, startedOn: dateOnly(t.startedOn), endsOn: dateOnly(t.endsOn), fromPrescription: !!t.prescriptionId })),
      vaccinations: vaccinations.map((v) => ({ id: v.id, vaccine: v.vaccine, givenOn: dateOnly(v.givenOn), nextDueOn: dateOnly(v.nextDueOn) })),
      vitals: Object.fromEntries(latest),
      vitalSeries: vitals
        .filter((v) => v.type === 'WEIGHT_KG' || v.type === 'SYSTOLIC_MMHG' || v.type === 'DIASTOLIC_MMHG' || v.type === 'GLYCEMIA_G_L')
        .slice(0, 60)
        .map((v) => ({ type: v.type, value: v.value, measuredAt: v.measuredAt.toISOString() })),
      consultations: consultations.map((c) => {
        const sections = this.crypto.decryptJson<ConsultationSections>(c.sectionsEncrypted);
        return {
          id: c.id,
          createdAt: c.createdAt.toISOString(),
          practitioner: nameOf(c.practitionerId),
          mine: c.practitionerId === m.practitionerId,
          reason: sections.reason ?? null,
          diagnoses: c.diagnoses as { label: string; code?: string }[],
          closed: !!c.closedAt,
        };
      }),
      prescriptions: prescriptions.map((x) => ({
        id: x.id,
        status: x.status,
        signedAt: x.signedAt?.toISOString() ?? null,
        qrCode: x.qrCode,
        lines: x.lines.map((l) => ({ label: l.drug ? `${l.drug.dci} ${l.drug.strength} (${l.drug.form})` : (l.freeText ?? ''), posologyText: l.posologyText })),
      })),
    };
  }

  async addAllergy(m: MembershipContext, user: SessionUser, recordId: string, input: { substance: string; drugDci?: string; reaction?: string; severity: 'MILD' | 'MODERATE' | 'SEVERE' }) {
    const ctx = await this.access.open(m, recordId);
    await this.prisma.allergy.create({ data: { ...this.author(ctx, user, m), substance: input.substance, drugDci: input.drugDci ?? null, reaction: input.reaction ?? null, severity: input.severity, source: 'PRACTITIONER' } });
    return this.synthesis(m, user, recordId);
  }

  async resolveAllergy(m: MembershipContext, user: SessionUser, recordId: string, allergyId: string) {
    const ctx = await this.access.open(m, recordId);
    const updated = await this.prisma.allergy.updateMany({ where: { id: allergyId, recordId: ctx.recordId, organizationId: m.organizationId }, data: { resolvedAt: new Date() } });
    if (!updated.count) throw new ApiException('NOT_FOUND', 'Allergy not found');
    return this.synthesis(m, user, recordId);
  }

  async addHistory(m: MembershipContext, user: SessionUser, recordId: string, input: { type: 'MEDICAL' | 'SURGICAL' | 'FAMILY' | 'OBSTETRIC' | 'LIFESTYLE'; label: string; occurredOn?: string; details?: string }) {
    const ctx = await this.access.open(m, recordId);
    await this.prisma.medicalHistoryItem.create({
      data: { ...this.author(ctx, user, m), type: input.type, label: input.label, occurredOn: day(input.occurredOn), detailsEncrypted: input.details ? this.crypto.encrypt(input.details) : null, source: 'PRACTITIONER' },
    });
    return this.synthesis(m, user, recordId);
  }

  async addTreatment(m: MembershipContext, user: SessionUser, recordId: string, input: { label: string; posology: string; startedOn?: string }) {
    const ctx = await this.access.open(m, recordId);
    await this.prisma.currentTreatment.create({ data: { ...this.author(ctx, user, m), label: input.label, posology: input.posology, startedOn: day(input.startedOn) ?? new Date() } });
    return this.synthesis(m, user, recordId);
  }

  async stopTreatment(m: MembershipContext, user: SessionUser, recordId: string, treatmentId: string) {
    const ctx = await this.access.open(m, recordId);
    const updated = await this.prisma.currentTreatment.updateMany({ where: { id: treatmentId, recordId: ctx.recordId, ...ctx.visibleWhere }, data: { status: 'STOPPED', endsOn: new Date() } });
    if (!updated.count) throw new ApiException('NOT_FOUND', 'Treatment not found');
    return this.synthesis(m, user, recordId);
  }

  async addVaccination(m: MembershipContext, user: SessionUser, recordId: string, input: { vaccine: string; givenOn: string; lot?: string; nextDueOn?: string }) {
    const ctx = await this.access.open(m, recordId);
    await this.prisma.vaccination.create({ data: { ...this.author(ctx, user, m), vaccine: input.vaccine, givenOn: day(input.givenOn)!, lot: input.lot ?? null, nextDueOn: day(input.nextDueOn) } });
    return this.synthesis(m, user, recordId);
  }

  async setBloodGroup(m: MembershipContext, user: SessionUser, recordId: string, bloodGroup: string | null) {
    const ctx = await this.access.open(m, recordId);
    await this.prisma.medicalRecord.update({ where: { id: ctx.recordId }, data: { bloodGroup } });
    return this.synthesis(m, user, recordId);
  }

  async consultation(m: MembershipContext, user: SessionUser, recordId: string, consultationId: string) {
    const ctx = await this.access.open(m, recordId);
    const c = await this.prisma.consultation.findFirst({
      where: { id: consultationId, recordId: ctx.recordId, ...(ctx.shared ? {} : { organizationId: m.organizationId }) },
      include: { vitals: true },
    });
    if (!c) throw new ApiException('NOT_FOUND', 'Consultation not found');
    await this.access.log(ctx, user, m, 'consultation');
    const practitioner = await this.prisma.practitioner.findUnique({ where: { id: c.practitionerId } });
    return {
      id: c.id,
      createdAt: c.createdAt.toISOString(),
      practitioner: practitioner ? practitionerName(practitioner) : 'Soignant',
      sections: this.crypto.decryptJson<ConsultationSections>(c.sectionsEncrypted),
      diagnoses: c.diagnoses,
      vitals: c.vitals.map((v) => ({ type: v.type, value: v.value })),
      appointmentId: c.appointmentId,
    };
  }

  /** Writes the consultation note, its vital signs, and closes the appointment when asked (SPEC-13 §Règles 3). */
  async saveConsultation(
    m: MembershipContext,
    user: SessionUser,
    recordId: string,
    input: { appointmentId?: string; template: string; sections: ConsultationSections; diagnoses: { label: string; code?: string }[]; vitals: { type: VitalType; value: number }[]; close: boolean },
  ) {
    const ctx = await this.access.open(m, recordId);
    let appointmentId: string | null = null;
    if (input.appointmentId) {
      const appt = await this.prisma.appointment.findFirst({
        where: { id: input.appointmentId, patientRecordId: ctx.patientRecord.id, agenda: { practitionerId: m.practitionerId! } },
      });
      if (!appt) throw new ApiException('NOT_FOUND', 'Appointment not found in your agenda for this patient');
      appointmentId = appt.id;
    }
    const now = new Date();
    const consultation = await this.prisma.consultation.create({
      data: {
        recordId: ctx.recordId,
        appointmentId,
        practitionerId: m.practitionerId!,
        organizationId: m.organizationId,
        template: input.template,
        sectionsEncrypted: this.crypto.encryptJson(input.sections),
        diagnoses: input.diagnoses,
        closedAt: input.close ? now : null,
        vitals: { create: input.vitals.map((v) => ({ recordId: ctx.recordId, type: v.type, value: v.value, measuredAt: now, organizationId: m.organizationId, authorId: user.id })) },
      },
    });
    if (appointmentId && input.close) {
      const appt = await this.prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
      if (['CONFIRMED', 'ARRIVED', 'IN_CONSULTATION'].includes(appt.status)) {
        await this.prisma.appointment.update({
          where: { id: appointmentId },
          data: { status: 'DONE', events: { create: { type: 'STATUS_CHANGED', actorUserId: user.id, payload: { from: appt.status, to: 'DONE', by: 'consultation' } } } },
        });
      }
    }
    await this.prisma.auditLog.create({ data: { actorUserId: user.id, organizationId: m.organizationId, action: 'consultation.created', entityType: 'Consultation', entityId: consultation.id } });
    return { id: consultation.id };
  }
}
