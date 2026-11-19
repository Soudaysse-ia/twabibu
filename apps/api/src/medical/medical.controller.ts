import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, PatientGuard } from '../auth/auth.guard.js';
import type { SessionUser } from '../auth/auth.types.js';
import { ApiException } from '../common/api-exception.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { MembershipContext } from '../pro/permissions.js';
import { CurrentMembership, ProGuard } from '../pro/pro.guard.js';
import { ConsentsService } from './consents.service.js';
import { MedicalService } from './medical.service.js';
import { PrescriptionsService } from './prescriptions.service.js';

const today = () => new Date().toISOString().slice(0, 10);
const pastDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => d >= '1900-01-01' && d <= today(), 'Invalid date');
const anyDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text = (max: number) => z.string().trim().max(max);

const Allergy = z.object({ substance: text(120).min(2), drugDci: text(120).optional(), reaction: text(200).optional(), severity: z.enum(['MILD', 'MODERATE', 'SEVERE']).default('MODERATE') });
const History = z.object({ type: z.enum(['MEDICAL', 'SURGICAL', 'FAMILY', 'OBSTETRIC', 'LIFESTYLE']), label: text(200).min(2), occurredOn: pastDate.optional(), details: text(2000).optional() });
const Treatment = z.object({ label: text(200).min(2), posology: text(300).min(2), startedOn: pastDate.optional() });
const Vaccination = z.object({ vaccine: text(120).min(2), givenOn: pastDate, lot: text(60).optional(), nextDueOn: anyDate.optional() });
const BloodGroup = z.object({ bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).nullable() });
const VITAL_RANGES = {
  WEIGHT_KG: [0.3, 400], HEIGHT_CM: [20, 250], SYSTOLIC_MMHG: [40, 300], DIASTOLIC_MMHG: [20, 200], HEART_RATE_BPM: [20, 250],
  TEMPERATURE_C: [30, 45], SPO2_PERCENT: [40, 100], GLYCEMIA_G_L: [0.2, 6], HEAD_CIRCUMFERENCE_CM: [20, 70],
} as const;
const Vital = z
  .object({ type: z.enum(Object.keys(VITAL_RANGES) as [keyof typeof VITAL_RANGES, ...(keyof typeof VITAL_RANGES)[]]), value: z.number() })
  .refine((v) => v.value >= VITAL_RANGES[v.type][0] && v.value <= VITAL_RANGES[v.type][1], 'Implausible value');
const Consultation = z.object({
  appointmentId: z.uuid().optional(),
  template: text(40).default('general'),
  sections: z.object({ reason: text(2000).optional(), history: text(5000).optional(), examination: text(5000).optional(), diagnosis: text(2000).optional(), plan: text(5000).optional() }),
  diagnoses: z.array(z.object({ label: text(200).min(2), code: text(10).optional() })).max(10).default([]),
  vitals: z.array(Vital).max(12).default([]),
  close: z.boolean().default(true),
});
const Line = z
  .object({
    drugId: z.uuid().optional(),
    freeText: text(200).optional(),
    posologyText: text(300).min(3),
    quantity: z.number().int().min(1).max(999).optional(),
    durationDays: z.number().int().min(1).max(365).optional(),
    substitutable: z.boolean().default(true),
  })
  .refine((l) => !!l.drugId !== !!l.freeText, 'A line is either a drug from the reference or free text');
const Check = z.object({ lines: z.array(Line).min(1).max(15) });
const Sign = Check.extend({ appointmentId: z.uuid().optional(), notes: text(300).optional(), allergyOverride: z.object({ justification: text(300) }).optional() });

@ApiTags('medical')
@Controller('v1/pro/orgs/:orgId/patients/:recordId/record')
@UseGuards(ProGuard)
export class MedicalController {
  constructor(
    private readonly medical: MedicalService,
    private readonly prescriptions: PrescriptionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Synthèse du dossier médical (praticiens uniquement, lecture journalisée).' })
  synthesis(@CurrentMembership() m: MembershipContext, @CurrentUser() u: SessionUser, @Param('recordId', new ParseUUIDPipe()) id: string) {
    return this.medical.synthesis(m, u, id);
  }

  @Post('allergies')
  @HttpCode(201)
  addAllergy(@CurrentMembership() m: MembershipContext, @CurrentUser() u: SessionUser, @Param('recordId', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(Allergy)) b: z.infer<typeof Allergy>) {
    return this.medical.addAllergy(m, u, id, b);
  }

  @Post('allergies/:allergyId/resolve')
  @HttpCode(200)
  resolveAllergy(@CurrentMembership() m: MembershipContext, @CurrentUser() u: SessionUser, @Param('recordId', new ParseUUIDPipe()) id: string, @Param('allergyId', new ParseUUIDPipe()) allergyId: string) {
    return this.medical.resolveAllergy(m, u, id, allergyId);
  }

  @Post('history')
  @HttpCode(201)
  addHistory(@CurrentMembership() m: MembershipContext, @CurrentUser() u: SessionUser, @Param('recordId', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(History)) b: z.infer<typeof History>) {
    return this.medical.addHistory(m, u, id, b);
  }

  @Post('treatments')
  @HttpCode(201)
  addTreatment(@CurrentMembership() m: MembershipContext, @CurrentUser() u: SessionUser, @Param('recordId', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(Treatment)) b: z.infer<typeof Treatment>) {
    return this.medical.addTreatment(m, u, id, b);
  }

  @Post('treatments/:treatmentId/stop')
  @HttpCode(200)
  stopTreatment(@CurrentMembership() m: MembershipContext, @CurrentUser() u: SessionUser, @Param('recordId', new ParseUUIDPipe()) id: string, @Param('treatmentId', new ParseUUIDPipe()) tid: string) {
    return this.medical.stopTreatment(m, u, id, tid);
  }

  @Post('vaccinations')
  @HttpCode(201)
  addVaccination(@CurrentMembership() m: MembershipContext, @CurrentUser() u: SessionUser, @Param('recordId', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(Vaccination)) b: z.infer<typeof Vaccination>) {
    return this.medical.addVaccination(m, u, id, b);
  }

  @Put('blood-group')
  bloodGroup(@CurrentMembership() m: MembershipContext, @CurrentUser() u: SessionUser, @Param('recordId', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(BloodGroup)) b: z.infer<typeof BloodGroup>) {
    return this.medical.setBloodGroup(m, u, id, b.bloodGroup);
  }

  @Get('consultations/:consultationId')
  consultation(@CurrentMembership() m: MembershipContext, @CurrentUser() u: SessionUser, @Param('recordId', new ParseUUIDPipe()) id: string, @Param('consultationId', new ParseUUIDPipe()) cid: string) {
    return this.medical.consultation(m, u, id, cid);
  }

  @Post('consultations')
  @HttpCode(201)
  @ApiOperation({ summary: 'Enregistre la consultation (chiffrée), ses constantes, et clôt le rendez-vous.' })
  saveConsultation(@CurrentMembership() m: MembershipContext, @CurrentUser() u: SessionUser, @Param('recordId', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(Consultation)) b: z.infer<typeof Consultation>) {
    return this.medical.saveConsultation(m, u, id, b);
  }

  @Post('prescriptions/check')
  @HttpCode(200)
  @ApiOperation({ summary: 'Alertes d’une ordonnance en cours de rédaction (allergie, doublon, traitement en cours).' })
  check(@CurrentMembership() m: MembershipContext, @Param('recordId', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(Check)) b: z.infer<typeof Check>) {
    return this.prescriptions.check(m, id, b.lines);
  }

  @Post('prescriptions')
  @HttpCode(201)
  @ApiOperation({ summary: 'Signe l’ordonnance. Une allergie bloque sauf justification.' })
  sign(@CurrentMembership() m: MembershipContext, @CurrentUser() u: SessionUser, @Param('recordId', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(Sign)) b: z.infer<typeof Sign>) {
    return this.prescriptions.sign(m, u, id, b);
  }
}

@ApiTags('medical')
@Controller('v1/pro/orgs/:orgId/prescriptions')
@UseGuards(ProGuard)
export class PracticePrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Get(':id')
  document(@CurrentMembership() m: MembershipContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.prescriptions.forPractice(m, id);
  }
}

@ApiTags('medical')
@Controller('v1')
export class PublicMedicalController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Get('directory/drugs')
  @ApiOperation({ summary: 'Recherche dans le référentiel des médicaments (DCI ou nom commercial).' })
  drugs(@Query('q') q = '') {
    return this.prescriptions.searchDrugs(String(q).slice(0, 60));
  }

  @Get('o/:code')
  @ApiOperation({ summary: 'Vérification publique d’une ordonnance (QR code) : validité et prescripteur, sans détail médical.' })
  verify(@Param('code') code: string) {
    if (!/^[A-Z2-9]{10}$/.test(code)) throw new ApiException('NOT_FOUND', 'Unknown prescription');
    return this.prescriptions.verify(code);
  }
}

@ApiTags('me')
@Controller('v1/me')
@UseGuards(PatientGuard)
export class PatientMedicalController {
  constructor(
    private readonly prescriptions: PrescriptionsService,
    private readonly consents: ConsentsService,
  ) {}

  @Get('prescriptions')
  list(@CurrentUser() u: SessionUser) {
    return this.prescriptions.forPatient(u);
  }

  @Get('prescriptions/:id')
  document(@CurrentUser() u: SessionUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.prescriptions.forPatientDocument(u, id);
  }

  @Get('record/consents')
  @ApiOperation({ summary: 'Cabinets avec lesquels le patient partage tout son dossier.' })
  consentList(@CurrentUser() u: SessionUser) {
    return this.consents.list(u);
  }

  @Post('record/consents/:organizationId')
  @HttpCode(200)
  grant(@CurrentUser() u: SessionUser, @Param('organizationId', new ParseUUIDPipe()) orgId: string) {
    return this.consents.grant(u, orgId);
  }

  @Delete('record/consents/:organizationId')
  revoke(@CurrentUser() u: SessionUser, @Param('organizationId', new ParseUUIDPipe()) orgId: string) {
    return this.consents.revoke(u, orgId);
  }

  @Get('record/access-log')
  @ApiOperation({ summary: 'Qui a consulté mon dossier, quand.' })
  accessLog(@CurrentUser() u: SessionUser) {
    return this.consents.accessLog(u);
  }
}
