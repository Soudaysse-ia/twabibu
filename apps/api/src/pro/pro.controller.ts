import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { dateKeySchema } from '@twabibu/contracts';
import { addDaysToDateKey } from '@twabibu/utils';
import { AuthGuard, CurrentUser } from '../auth/auth.guard.js';
import type { SessionUser } from '../auth/auth.types.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { MembershipContext } from './permissions.js';
import { CurrentMembership, ProGuard } from './pro.guard.js';
import { PracticeOverviewService } from './practice-overview.service.js';
import { ProService } from './pro.service.js';
import { SettingsService } from './settings.service.js';

const isoDate = z.iso.datetime().transform((v) => new Date(v));
const today = () => new Date().toISOString().slice(0, 10);

const EventsQuery = z
  .object({
    from: dateKeySchema,
    to: dateKeySchema,
    agendaIds: z.string().optional().transform((v) => (v ? v.split(',').filter(Boolean) : [])),
  })
  .refine((v) => v.from <= v.to && v.to <= addDaysToDateKey(v.from, 31), 'At most 31 days');

const CreateAppointment = z
  .object({
    agendaId: z.uuid(),
    motiveId: z.uuid(),
    startsAt: isoDate,
    patientRecordId: z.uuid().optional(),
    newPatient: z
      .object({
        firstName: z.string().trim().min(1).max(60),
        lastName: z.string().trim().min(1).max(60),
        email: z.string().trim().toLowerCase().pipe(z.email().max(254)).optional().or(z.literal('').transform(() => undefined)),
        phone: z.string().trim().max(30).optional().or(z.literal('').transform(() => undefined)),
        birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => d >= '1900-01-01' && d <= today()).optional().or(z.literal('').transform(() => undefined)),
      })
      .optional(),
    notes: z.string().trim().max(500).optional(),
    source: z.enum(['PHONE', 'WALK_IN', 'PRACTICE']).default('PHONE'),
    force: z.boolean().default(false),
    notifyPatient: z.boolean().default(true),
  })
  .refine((v) => !!v.patientRecordId !== !!v.newPatient, 'Choose an existing patient or create one');

const UpdateAppointment = z.object({
  status: z.enum(['CONFIRMED', 'ARRIVED', 'IN_CONSULTATION', 'DONE', 'NO_SHOW']).optional(),
  startsAt: isoDate.optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  notifyPatient: z.boolean().default(true),
});

const CancelAppointment = z.object({ reason: z.string().trim().max(200).optional(), notifyPatient: z.boolean().default(true) });
const PatientQuery = z.object({ q: z.string().trim().max(60).default('') });
const PatientList = z.object({ q: z.string().trim().max(60).default(''), scope: z.enum(['mine', 'all']).default('mine'), page: z.coerce.number().int().min(1).max(500).default(1) });

const AgendaSettings = z
  .object({
    slotStepMinutes: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
    bookingHorizonDays: z.number().int().min(1).max(365),
    minNoticeMinutes: z.number().int().min(0).max(14 * 24 * 60),
    maxActiveAppointmentsPerPatient: z.number().int().min(1).max(10),
    onlineBookingEnabled: z.boolean(),
    requiresValidation: z.boolean(),
  })
  .partial();

const Motive = z.object({
  name: z.string().trim().min(2).max(120),
  durationMinutes: z.number().int().min(5).max(480),
  color: z.string().max(20).optional(),
  isOnline: z.boolean().optional(),
  newPatientsAllowed: z.boolean().optional(),
  instructions: z.string().trim().max(1000).nullable().optional(),
  priceKmf: z.number().int().min(0).max(10_000_000).nullable().optional(),
  cancellationDeadlineHours: z.number().int().min(0).max(14 * 24).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const Rules = z.object({
  rules: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        startMinutes: z.number().int().min(0).max(24 * 60),
        endMinutes: z.number().int().min(0).max(24 * 60),
        motiveIds: z.array(z.uuid()).optional(),
      }),
    )
    .max(50),
});

const Range = z.object({ startsAt: isoDate, endsAt: isoDate });
const Absence = Range.extend({ reason: z.string().trim().max(200).optional(), impacted: z.enum(['CANCEL_AND_NOTIFY', 'KEEP']) });

const NotificationSettings = z.object({
  reminderOffsetsHours: z.array(z.number().int()).max(3),
  reminderHour: z.number().int(),
  askConfirmation: z.boolean(),
});

@ApiTags('pro')
@Controller('v1/pro')
export class ProMeController {
  constructor(private readonly pro: ProService) {}

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Structures auxquelles le compte connecté a accès, avec son rôle.' })
  me(@CurrentUser() user: SessionUser) {
    return this.pro.me(user);
  }
}

@ApiTags('pro')
@Controller('v1/pro/orgs/:orgId')
@UseGuards(ProGuard)
export class ProController {
  constructor(
    private readonly pro: ProService,
    private readonly settings: SettingsService,
    private readonly overview: PracticeOverviewService,
  ) {}

  @Get('agendas')
  agendas(@CurrentMembership() m: MembershipContext) {
    return this.pro.agendas(m);
  }

  @Get('agenda/events')
  @ApiOperation({ summary: 'Rendez-vous, absences et plages en ligne pour la grille (31 jours max).' })
  events(@CurrentMembership() m: MembershipContext, @Query(new ZodValidationPipe(EventsQuery)) q: z.infer<typeof EventsQuery>) {
    return this.pro.events(m, q.agendaIds, q.from, q.to);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Accueil du praticien : journée, demandes à valider, patients récents. Aucune donnée médicale.' })
  dashboard(@CurrentMembership() m: MembershipContext) {
    return this.overview.dashboard(m);
  }

  @Get('patients/list')
  @ApiOperation({ summary: 'Patients : les miens (récents d’abord) ou tout le cabinet (alphabétique), recherche facultative.' })
  patientList(@CurrentMembership() m: MembershipContext, @Query(new ZodValidationPipe(PatientList)) q: z.infer<typeof PatientList>) {
    return this.overview.patients(m, q);
  }

  @Get('patients/:id')
  @ApiOperation({ summary: 'Fiche administrative du patient : coordonnées et rendez-vous.' })
  patient(@CurrentMembership() m: MembershipContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.overview.patient(m, id);
  }

  @Get('patients')
  patients(@CurrentMembership() m: MembershipContext, @Query(new ZodValidationPipe(PatientQuery)) q: z.infer<typeof PatientQuery>) {
    return this.pro.searchPatients(m, q.q);
  }

  @Post('appointments')
  @HttpCode(201)
  @ApiOperation({ summary: 'Rendez-vous pris par le cabinet (téléphone, sur place).' })
  create(@CurrentMembership() m: MembershipContext, @CurrentUser() user: SessionUser, @Body(new ZodValidationPipe(CreateAppointment)) body: z.infer<typeof CreateAppointment>) {
    return this.pro.create(m, user, body);
  }

  @Patch('appointments/:id')
  @ApiOperation({ summary: 'Statut, déplacement ou notes d’un rendez-vous.' })
  update(@CurrentMembership() m: MembershipContext, @CurrentUser() user: SessionUser, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(UpdateAppointment)) body: z.infer<typeof UpdateAppointment>) {
    return this.pro.update(m, user, id, body);
  }

  @Post('appointments/:id/cancel')
  @HttpCode(200)
  cancel(@CurrentMembership() m: MembershipContext, @CurrentUser() user: SessionUser, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(CancelAppointment)) body: z.infer<typeof CancelAppointment>) {
    return this.pro.cancel(m, user, id, body);
  }

  @Get('appointments/:id')
  one(@CurrentMembership() m: MembershipContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.pro.one(m, id);
  }

  @Get('appointments/:id/history')
  history(@CurrentMembership() m: MembershipContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.pro.history(m, id);
  }

  @Get('notification-settings')
  @ApiOperation({ summary: 'Rappels aux patients : délais, heure, demande de confirmation.' })
  notificationSettings(@CurrentMembership() m: MembershipContext) {
    return this.settings.notificationSettings(m);
  }

  @Put('notification-settings')
  updateNotificationSettings(@CurrentMembership() m: MembershipContext, @Body(new ZodValidationPipe(NotificationSettings)) body: z.infer<typeof NotificationSettings>) {
    return this.settings.updateNotificationSettings(m, body);
  }

  @Get('agendas/:agendaId/settings')
  getSettings(@CurrentMembership() m: MembershipContext, @Param('agendaId', new ParseUUIDPipe()) agendaId: string) {
    return this.settings.get(m, agendaId);
  }

  @Patch('agendas/:agendaId')
  updateAgenda(@CurrentMembership() m: MembershipContext, @Param('agendaId', new ParseUUIDPipe()) agendaId: string, @Body(new ZodValidationPipe(AgendaSettings)) body: z.infer<typeof AgendaSettings>) {
    return this.settings.updateAgenda(m, agendaId, body);
  }

  @Post('agendas/:agendaId/motives')
  @HttpCode(201)
  createMotive(@CurrentMembership() m: MembershipContext, @Param('agendaId', new ParseUUIDPipe()) agendaId: string, @Body(new ZodValidationPipe(Motive)) body: z.infer<typeof Motive>) {
    return this.settings.createMotive(m, agendaId, body);
  }

  @Patch('agendas/:agendaId/motives/:motiveId')
  updateMotive(
    @CurrentMembership() m: MembershipContext,
    @Param('agendaId', new ParseUUIDPipe()) agendaId: string,
    @Param('motiveId', new ParseUUIDPipe()) motiveId: string,
    @Body(new ZodValidationPipe(Motive.partial())) body: Partial<z.infer<typeof Motive>>,
  ) {
    return this.settings.updateMotive(m, agendaId, motiveId, body);
  }

  @Put('agendas/:agendaId/availability-rules')
  @ApiOperation({ summary: 'Remplace les plages réservables en ligne de la semaine.' })
  rules(@CurrentMembership() m: MembershipContext, @Param('agendaId', new ParseUUIDPipe()) agendaId: string, @Body(new ZodValidationPipe(Rules)) body: z.infer<typeof Rules>) {
    return this.settings.replaceRules(m, agendaId, body.rules);
  }

  @Get('agendas/:agendaId/absences')
  absences(@CurrentMembership() m: MembershipContext, @Param('agendaId', new ParseUUIDPipe()) agendaId: string) {
    return this.settings.absences(m, agendaId);
  }

  @Post('agendas/:agendaId/absences/preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rendez-vous touchés par une absence, avant de l’enregistrer.' })
  preview(@CurrentMembership() m: MembershipContext, @Param('agendaId', new ParseUUIDPipe()) agendaId: string, @Body(new ZodValidationPipe(Range)) body: z.infer<typeof Range>) {
    return this.settings.impacted(m, agendaId, body.startsAt, body.endsAt);
  }

  @Post('agendas/:agendaId/absences')
  @HttpCode(201)
  createAbsence(@CurrentMembership() m: MembershipContext, @CurrentUser() user: SessionUser, @Param('agendaId', new ParseUUIDPipe()) agendaId: string, @Body(new ZodValidationPipe(Absence)) body: z.infer<typeof Absence>) {
    return this.settings.createAbsence(m, user, agendaId, body);
  }

  @Delete('agendas/:agendaId/absences/:absenceId')
  @HttpCode(204)
  async deleteAbsence(@CurrentMembership() m: MembershipContext, @Param('agendaId', new ParseUUIDPipe()) agendaId: string, @Param('absenceId', new ParseUUIDPipe()) absenceId: string) {
    await this.settings.deleteAbsence(m, agendaId, absenceId);
  }
}
