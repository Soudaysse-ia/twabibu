import { Injectable } from '@nestjs/common';
import type { SessionUser } from '../auth/auth.types.js';
import { ApiException } from '../common/api-exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_REMINDER_HOUR, DEFAULT_REMINDER_OFFSETS, normaliseReminderSettings } from '../notifications/reminder-rules.js';
import { canManageAgendaSettings, canManagePractice, canViewAgenda, type MembershipContext } from './permissions.js';
import { ProService } from './pro.service.js';

export interface MotiveInput {
  name: string;
  durationMinutes: number;
  color?: string;
  isOnline?: boolean;
  newPatientsAllowed?: boolean;
  instructions?: string | null;
  priceKmf?: number | null;
  cancellationDeadlineHours?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface RuleInput {
  weekday: number;
  startMinutes: number;
  endMinutes: number;
  motiveIds?: string[];
}

/** Agenda settings (SPEC-05 §Paramètres): booking rules, motives, online windows, absences. */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pro: ProService,
  ) {}

  /** Reminder settings of the practice (SPEC-08). Everyone in the practice may read them; managers change them. */
  async notificationSettings(m: MembershipContext) {
    const s = await this.prisma.organizationNotificationSettings.findUnique({ where: { organizationId: m.organizationId } });
    return {
      reminderOffsetsHours: s?.reminderOffsetsHours ?? DEFAULT_REMINDER_OFFSETS,
      reminderHour: s?.reminderHour ?? DEFAULT_REMINDER_HOUR,
      askConfirmation: s?.askConfirmation ?? false,
      canEdit: canManagePractice(m),
    };
  }

  async updateNotificationSettings(m: MembershipContext, input: { reminderOffsetsHours: number[]; reminderHour: number; askConfirmation: boolean }) {
    if (!canManagePractice(m)) throw new ApiException('FORBIDDEN', 'Owner or administrator only');
    const clean = normaliseReminderSettings(input);
    if (!clean) throw new ApiException('VALIDATION_FAILED', 'Reminders: the day before, 2 or 3 days before, between 07:00 and 20:00');
    const data = { ...clean, askConfirmation: input.askConfirmation };
    await this.prisma.organizationNotificationSettings.upsert({ where: { organizationId: m.organizationId }, update: data, create: { organizationId: m.organizationId, ...data } });
    return this.notificationSettings(m);
  }

  private async agenda(m: MembershipContext, agendaId: string, write: boolean) {
    const agenda = await this.prisma.agenda.findFirst({ where: { id: agendaId, practitioner: { organizationId: m.organizationId } } });
    if (!agenda || !canViewAgenda(m, agenda)) throw new ApiException('NOT_FOUND', 'Agenda not found');
    if (write && !canManageAgendaSettings(m, agenda)) throw new ApiException('FORBIDDEN', 'You cannot change this agenda');
    return agenda;
  }

  async get(m: MembershipContext, agendaId: string) {
    const agenda = await this.agenda(m, agendaId, false);
    const [motives, rules] = await Promise.all([
      this.prisma.motive.findMany({ where: { agendaId }, orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }] }),
      this.prisma.availabilityRule.findMany({ where: { agendaId }, orderBy: [{ weekday: 'asc' }, { startMinutes: 'asc' }] }),
    ]);
    return {
      canEdit: canManageAgendaSettings(m, agenda),
      agenda: {
        id: agenda.id,
        name: agenda.name,
        slotStepMinutes: agenda.slotStepMinutes,
        bookingHorizonDays: agenda.bookingHorizonDays,
        minNoticeMinutes: agenda.minNoticeMinutes,
        maxActiveAppointmentsPerPatient: agenda.maxActiveAppointmentsPerPatient,
        onlineBookingEnabled: agenda.onlineBookingEnabled,
        requiresValidation: agenda.requiresValidation,
      },
      motives: motives.map((x) => ({
        id: x.id, name: x.name, durationMinutes: x.durationMinutes, color: x.color, isOnline: x.isOnline, newPatientsAllowed: x.newPatientsAllowed,
        instructions: x.instructions, priceKmf: x.priceKmf, cancellationDeadlineHours: x.cancellationDeadlineHours, isActive: x.isActive, sortOrder: x.sortOrder,
      })),
      rules: rules.map((r) => ({ id: r.id, weekday: r.weekday, startMinutes: r.startMinutes, endMinutes: r.endMinutes, motiveIds: r.motiveIds })),
    };
  }

  async updateAgenda(m: MembershipContext, agendaId: string, input: Partial<{ slotStepMinutes: number; bookingHorizonDays: number; minNoticeMinutes: number; maxActiveAppointmentsPerPatient: number; onlineBookingEnabled: boolean; requiresValidation: boolean }>) {
    await this.agenda(m, agendaId, true);
    await this.prisma.agenda.update({ where: { id: agendaId }, data: input });
    return this.get(m, agendaId);
  }

  async createMotive(m: MembershipContext, agendaId: string, input: MotiveInput) {
    await this.agenda(m, agendaId, true);
    const count = await this.prisma.motive.count({ where: { agendaId } });
    await this.prisma.motive.create({ data: { agendaId, ...input, sortOrder: input.sortOrder ?? count } });
    return this.get(m, agendaId);
  }

  async updateMotive(m: MembershipContext, agendaId: string, motiveId: string, input: Partial<MotiveInput>) {
    await this.agenda(m, agendaId, true);
    const motive = await this.prisma.motive.findFirst({ where: { id: motiveId, agendaId } });
    if (!motive) throw new ApiException('NOT_FOUND', 'Motive not found');
    await this.prisma.motive.update({ where: { id: motiveId }, data: input });
    return this.get(m, agendaId);
  }

  /** Replaces the weekly online windows in one transaction. Overlapping windows on a day are refused. */
  async replaceRules(m: MembershipContext, agendaId: string, rules: RuleInput[]) {
    await this.agenda(m, agendaId, true);
    const motiveIds = new Set((await this.prisma.motive.findMany({ where: { agendaId }, select: { id: true } })).map((x) => x.id));
    for (const r of rules) {
      if (r.endMinutes <= r.startMinutes) throw new ApiException('VALIDATION_FAILED', 'A window must end after it starts');
      for (const id of r.motiveIds ?? []) if (!motiveIds.has(id)) throw new ApiException('VALIDATION_FAILED', 'Unknown motive in a window');
    }
    for (let d = 0; d < 7; d++) {
      const day = rules.filter((r) => r.weekday === d).sort((a, b) => a.startMinutes - b.startMinutes);
      for (let i = 1; i < day.length; i++) {
        if (day[i]!.startMinutes < day[i - 1]!.endMinutes) throw new ApiException('VALIDATION_FAILED', 'Two windows overlap on the same day', { weekday: d });
      }
    }
    await this.prisma.$transaction([
      this.prisma.availabilityRule.deleteMany({ where: { agendaId } }),
      this.prisma.availabilityRule.createMany({ data: rules.map((r) => ({ agendaId, weekday: r.weekday, startMinutes: r.startMinutes, endMinutes: r.endMinutes, motiveIds: r.motiveIds ?? [] })) }),
    ]);
    return this.get(m, agendaId);
  }

  async absences(m: MembershipContext, agendaId: string) {
    await this.agenda(m, agendaId, false);
    const rows = await this.prisma.absence.findMany({ where: { agendaId, endsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' } });
    return rows.map((a) => ({ id: a.id, startsAt: a.startsAt.toISOString(), endsAt: a.endsAt.toISOString(), reason: a.reason }));
  }

  /** Appointments an absence would hit, shown before it is saved (SPEC-05 §Absences). */
  async impacted(m: MembershipContext, agendaId: string, startsAt: Date, endsAt: Date) {
    await this.agenda(m, agendaId, false);
    const rows = await this.prisma.appointment.findMany({
      where: { agendaId, status: { in: ['CONFIRMED', 'PENDING_VALIDATION'] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      include: { patientRecord: { select: { firstName: true, lastName: true, phone: true } } },
      orderBy: { startsAt: 'asc' },
    });
    return rows.map((a) => ({ id: a.id, startsAt: a.startsAt.toISOString(), patient: `${a.patientRecord.firstName} ${a.patientRecord.lastName}`, hasPhone: !!a.patientRecord.phone }));
  }

  async createAbsence(m: MembershipContext, user: SessionUser, agendaId: string, input: { startsAt: Date; endsAt: Date; reason?: string; impacted: 'CANCEL_AND_NOTIFY' | 'KEEP' }) {
    await this.agenda(m, agendaId, true);
    if (input.endsAt <= input.startsAt) throw new ApiException('VALIDATION_FAILED', 'The absence must end after it starts');
    const impacted = await this.impacted(m, agendaId, input.startsAt, input.endsAt);
    const absence = await this.prisma.absence.create({ data: { agendaId, startsAt: input.startsAt, endsAt: input.endsAt, reason: input.reason ?? null, createdById: user.id } });
    if (input.impacted === 'CANCEL_AND_NOTIFY' && impacted.length) {
      await this.pro.cancelForAbsence(m, user, impacted.map((a) => a.id), input.reason ? `Absence : ${input.reason}` : 'Absence du soignant');
    }
    return { id: absence.id, cancelled: input.impacted === 'CANCEL_AND_NOTIFY' ? impacted.length : 0, kept: input.impacted === 'KEEP' ? impacted.length : 0 };
  }

  async deleteAbsence(m: MembershipContext, agendaId: string, absenceId: string) {
    await this.agenda(m, agendaId, true);
    const deleted = await this.prisma.absence.deleteMany({ where: { id: absenceId, agendaId } });
    if (!deleted.count) throw new ApiException('NOT_FOUND', 'Absence not found');
  }
}
