import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthGuard, CurrentUser } from '../auth/auth.guard.js';
import type { AuthedRequest, SessionUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminPharmaciesService } from './admin-pharmacies.service.js';
import { AdminReferentialsService } from './admin-referentials.service.js';
import { AdminAreaRequired, AdminGuard, CurrentAdmin, type AdminContext } from './admin.guard.js';
import { AdminService, CHECKLIST } from './admin.service.js';
import { DRUG_ROUTES, LOCALITY_KINDS } from './referential-rules.js';

const text = (max: number) => z.string().trim().max(max);
/** A real calendar day: 2031-02-31 is refused, not silently moved to March. */
const isCalendarDay = (d: string) => {
  const t = Date.parse(`${d}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d;
};
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isCalendarDay, 'Invalid date');
const Code = z.object({ code: z.string().regex(/^\d{6}$/) });
const Decision = z.object({
  decision: z.enum(['VERIFIED', 'CHANGES_REQUESTED', 'REJECTED']),
  message: text(1000).optional(),
  checklist: z.object(Object.fromEntries(CHECKLIST.map((k) => [k, z.boolean().optional()]))).optional(),
});
const StructureStatus = z.object({ suspend: z.boolean(), reason: text(500).min(5) });
const PharmacyVerify = z.object({ verified: z.boolean(), message: text(500).optional() });
const Duty = z.object({ pharmacyId: z.uuid(), startsAt: text(16), endsAt: text(16), source: text(80).min(2) });
const DutyImport = z.object({ csv: z.string().max(200_000), source: text(80).min(2) });
const Placement = z.object({
  pharmacyId: z.uuid(),
  slot: z.enum(['LOCALITY_TOP', 'DUTY_PAGE', 'DRUG_PAGE']),
  island: z.enum(['NGAZIDJA', 'NDZUANI', 'MWALI']),
  startsOn: dateKey,
  endsOn: dateKey,
  priceKmf: z.number().int().min(0).max(100_000_000),
});
const AuditQuery = z.object({ actor: text(120).optional(), entityType: text(60).optional(), action: text(60).optional(), from: dateKey.optional(), to: dateKey.optional() });
const Flag = z.object({ enabled: z.boolean() });
const name = text(80).min(2);
const Motive = z.object({ name: text(80), durationMinutes: z.number().int() });
const Speciality = z.object({
  name,
  group: z.enum(['MEDICAL', 'DENTAL', 'MIDWIFERY', 'PARAMEDICAL', 'PHARMACY', 'LAB', 'WELLBEING']),
  canPrescribe: z.boolean(),
  defaultMotives: z.array(Motive).max(10),
  sortOrder: z.number().int().min(0).max(999).optional(),
});
const SpecialityPatch = Speciality.partial().extend({ isActive: z.boolean().optional() });
const Locality = z.object({ island: z.enum(['NGAZIDJA', 'NDZUANI', 'MWALI']), name, lat: z.number().finite(), lng: z.number().finite(), kind: z.enum(LOCALITY_KINDS) });
const LocalityPatch = Locality.omit({ island: true }).partial().extend({ isActive: z.boolean().optional() });
const Holiday = z.object({ date: dateKey, name, isEstimated: z.boolean() });
const HolidayPatch = Holiday.partial();
const Drug = z.object({
  dci: text(120).min(2),
  strength: text(60).min(1),
  form: text(80).min(2),
  route: z.enum(DRUG_ROUTES),
  brandNames: z.array(text(60)).max(20),
  atcCode: z.string().trim().regex(/^[A-Z]\d{2}[A-Z]{2}\d{2}$/).nullable().optional(),
  prescriptionOnly: z.boolean(),
  controlled: z.boolean(),
  essential: z.boolean(),
});
const DrugPatch = Drug.omit({ dci: true, strength: true, form: true }).partial().extend({ isActive: z.boolean().optional() });

/** Sign-in step 2 (TOTP). Reachable with an e-mail session only: the AdminGuard needs it done. */
@ApiExcludeController()
@Controller('v1/admin/auth')
@UseGuards(AuthGuard)
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Get('me')
  me(@CurrentUser() u: SessionUser) {
    return this.auth.me(u);
  }

  @Post('mfa/setup')
  @HttpCode(200)
  setup(@CurrentUser() u: SessionUser) {
    return this.auth.setup(u);
  }

  @Post('mfa/verify')
  @HttpCode(200)
  verify(@CurrentUser() u: SessionUser, @Body(new ZodValidationPipe(Code)) body: z.infer<typeof Code>, @Req() req: AuthedRequest) {
    return this.auth.verify(u, body.code, req.ip ?? null);
  }
}

@ApiExcludeController()
@Controller('v1/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly pharmacies: AdminPharmaciesService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('verifications')
  @AdminAreaRequired('verification')
  queue() {
    return this.admin.verificationQueue();
  }

  @Get('practitioners/:id')
  @AdminAreaRequired('verification')
  practitioner(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.practitionerFile(id);
  }

  @Post('practitioners/:id/decision')
  @HttpCode(200)
  @AdminAreaRequired('verification')
  decide(@CurrentAdmin() a: AdminContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(Decision)) body: z.infer<typeof Decision>) {
    return this.admin.decide(a, id, body);
  }

  @Get('structures')
  @AdminAreaRequired('structures')
  structures(@Query('q') q?: string, @Query('type') type?: string) {
    return this.admin.structures(q?.slice(0, 80), type && /^[A-Z_]+$/.test(type) ? type : undefined);
  }

  @Get('structures/:id')
  @AdminAreaRequired('structures')
  structure(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.structure(id);
  }

  @Post('structures/:id/status')
  @HttpCode(200)
  @AdminAreaRequired('verification')
  structureStatus(@CurrentAdmin() a: AdminContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(StructureStatus)) body: z.infer<typeof StructureStatus>) {
    return this.admin.setStructureStatus(a, id, body);
  }

  @Get('patients')
  @AdminAreaRequired('patients')
  patients(@Query('q') q = '') {
    return this.admin.patients(String(q).slice(0, 120));
  }

  @Get('patients/:id')
  @AdminAreaRequired('patients')
  patient(@CurrentAdmin() a: AdminContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.patient(a, id);
  }

  @Post('patients/:id/revoke-sessions')
  @HttpCode(200)
  @AdminAreaRequired('patients')
  revoke(@CurrentAdmin() a: AdminContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.revokeSessions(a, id);
  }

  @Get('notifications')
  @AdminAreaRequired('notifications')
  notifications(@Query('status') status?: string, @Query('channel') channel?: string, @Query('q') q?: string, @Query('template') template?: string) {
    const ok = (v?: string) => (v && /^[A-Za-z_]+$/.test(v) ? v : undefined);
    return this.admin.notificationLog({ status: ok(status), channel: ok(channel), template: ok(template), q: q?.slice(0, 120) });
  }

  @Post('notifications/:id/resend')
  @HttpCode(200)
  @AdminAreaRequired('notifications')
  resend(@CurrentAdmin() a: AdminContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.admin.resend(a, id);
  }

  @Get('audit')
  @AdminAreaRequired('audit')
  audit(@Query(new ZodValidationPipe(AuditQuery)) q: z.infer<typeof AuditQuery>) {
    return this.admin.auditLog(q);
  }

  @Get('audit.csv')
  @AdminAreaRequired('audit')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="journal-audit.csv"')
  auditCsv(@Query(new ZodValidationPipe(AuditQuery)) q: z.infer<typeof AuditQuery>) {
    return this.admin.auditCsv(q);
  }

  @Get('flags')
  @AdminAreaRequired('flags')
  flags() {
    return this.admin.flags();
  }

  @Put('flags/:key')
  @AdminAreaRequired('flags')
  setFlag(@CurrentAdmin() a: AdminContext, @Param('key') key: string, @Body(new ZodValidationPipe(Flag)) body: z.infer<typeof Flag>) {
    return this.admin.setFlag(a, key, body.enabled);
  }

  // Pharmacies

  @Get('pharmacies')
  @AdminAreaRequired('pharmacies')
  pharmacyList() {
    return this.pharmacies.list();
  }

  @Post('pharmacies/:id/verification')
  @HttpCode(200)
  @AdminAreaRequired('pharmacies')
  pharmacyVerify(@CurrentAdmin() a: AdminContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(PharmacyVerify)) body: z.infer<typeof PharmacyVerify>) {
    return this.pharmacies.setVerified(a, id, body);
  }

  @Get('duties')
  @AdminAreaRequired('pharmacies')
  duties(@Query('island') island = 'ngazidja', @Query('from') from?: string) {
    return this.pharmacies.duties(island, from);
  }

  @Post('duties')
  @AdminAreaRequired('pharmacies')
  addDuty(@CurrentAdmin() a: AdminContext, @Body(new ZodValidationPipe(Duty)) body: z.infer<typeof Duty>) {
    return this.pharmacies.addDuty(a, body);
  }

  @Post('duties/import')
  @HttpCode(200)
  @AdminAreaRequired('pharmacies')
  importDuties(@CurrentAdmin() a: AdminContext, @Body(new ZodValidationPipe(DutyImport)) body: z.infer<typeof DutyImport>) {
    return this.pharmacies.importDuties(a, body.csv, body.source);
  }

  @Delete('duties/:id')
  @HttpCode(204)
  @AdminAreaRequired('pharmacies')
  deleteDuty(@CurrentAdmin() a: AdminContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.pharmacies.deleteDuty(a, id);
  }

  @Get('placements')
  @AdminAreaRequired('placements')
  placements() {
    return this.pharmacies.placements();
  }

  @Post('placements')
  @AdminAreaRequired('placements')
  addPlacement(@CurrentAdmin() a: AdminContext, @Body(new ZodValidationPipe(Placement)) body: z.infer<typeof Placement>) {
    return this.pharmacies.addPlacement(a, body);
  }

  @Post('placements/:id/end')
  @HttpCode(200)
  @AdminAreaRequired('placements')
  endPlacement(@CurrentAdmin() a: AdminContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.pharmacies.endPlacement(a, id);
  }
}

/** Reference data (SPEC-11 §5, ADR-019). Changes show on the site within a minute (directory cache: 60 s). */
@ApiExcludeController()
@Controller('v1/admin/referentials')
@UseGuards(AdminGuard)
@AdminAreaRequired('referentials')
export class AdminReferentialsController {
  constructor(private readonly refs: AdminReferentialsService) {}

  @Get('specialities')
  specialities() {
    return this.refs.specialities();
  }

  @Post('specialities')
  createSpeciality(@CurrentAdmin() a: AdminContext, @Body(new ZodValidationPipe(Speciality)) body: z.infer<typeof Speciality>) {
    return this.refs.createSpeciality(a, body);
  }

  @Patch('specialities/:id')
  updateSpeciality(@CurrentAdmin() a: AdminContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(SpecialityPatch)) body: z.infer<typeof SpecialityPatch>) {
    return this.refs.updateSpeciality(a, id, body);
  }

  @Get('localities')
  localities(@Query('island') island?: string) {
    return this.refs.localities(island && /^[a-z]+$/.test(island) ? island : undefined);
  }

  @Post('localities')
  createLocality(@CurrentAdmin() a: AdminContext, @Body(new ZodValidationPipe(Locality)) body: z.infer<typeof Locality>) {
    return this.refs.createLocality(a, body);
  }

  @Patch('localities/:id')
  updateLocality(@CurrentAdmin() a: AdminContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(LocalityPatch)) body: z.infer<typeof LocalityPatch>) {
    return this.refs.updateLocality(a, id, body);
  }

  @Get('holidays')
  holidays(@Query('year') year?: string) {
    const y = Number(year);
    return this.refs.holidays(Number.isInteger(y) && y >= 2020 && y <= 2100 ? y : new Date().getFullYear());
  }

  @Post('holidays')
  createHoliday(@CurrentAdmin() a: AdminContext, @Body(new ZodValidationPipe(Holiday)) body: z.infer<typeof Holiday>) {
    return this.refs.createHoliday(a, body);
  }

  @Patch('holidays/:date')
  updateHoliday(@CurrentAdmin() a: AdminContext, @Param('date', new ZodValidationPipe(dateKey)) date: string, @Body(new ZodValidationPipe(HolidayPatch)) body: z.infer<typeof HolidayPatch>) {
    return this.refs.updateHoliday(a, date, body);
  }

  @Delete('holidays/:date')
  @HttpCode(204)
  deleteHoliday(@CurrentAdmin() a: AdminContext, @Param('date', new ZodValidationPipe(dateKey)) date: string) {
    return this.refs.deleteHoliday(a, date);
  }

  @Get('drugs')
  drugs(@Query('q') q?: string) {
    return this.refs.drugs(q?.slice(0, 60));
  }

  @Post('drugs')
  createDrug(@CurrentAdmin() a: AdminContext, @Body(new ZodValidationPipe(Drug)) body: z.infer<typeof Drug>) {
    return this.refs.createDrug(a, body);
  }

  @Patch('drugs/:id')
  updateDrug(@CurrentAdmin() a: AdminContext, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(DrugPatch)) body: z.infer<typeof DrugPatch>) {
    return this.refs.updateDrug(a, id, body);
  }
}
