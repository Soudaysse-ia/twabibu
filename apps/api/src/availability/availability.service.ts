import { Injectable } from '@nestjs/common';
import { computeSlots, groupSlotsByDay, isSlotBookable, type ComputeInput, type DaySlots, type UnavailableReason } from '@twabibu/availability';
import { ACTIVE_APPOINTMENT_STATUSES } from '@twabibu/contracts';
import { addDaysToDateKey, toDateKey, zonedToUtc } from '@twabibu/utils';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { SlotLockService } from './slot-locks.js';

const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export interface AvailabilityContext {
  source: 'ONLINE' | 'PRACTICE';
  /** Patient profile of the person booking, to know whether they are already followed. */
  patientProfileId?: string | null;
  /** Booking session whose own lock must not hide its own slot. */
  bookingSessionId?: string;
  now?: Date;
}

/** Loads everything the pure engine needs from the database and Redis (SPEC-12). */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locks: SlotLockService,
  ) {}

  /** A patient is "known" by a practice once they have a past, non-cancelled appointment there. */
  async isKnownPatient(organizationId: string, patientProfileId?: string | null): Promise<boolean> {
    if (!patientProfileId) return false;
    const count = await this.prisma.appointment.count({
      where: {
        patientRecord: { organizationId, patientProfileId },
        status: { in: ['DONE', 'CONFIRMED', 'ARRIVED', 'IN_CONSULTATION'] },
        startsAt: { lt: new Date() },
      },
    });
    return count > 0;
  }

  async buildInput(agendaId: string, motiveId: string, from: Date, to: Date, ctx: AvailabilityContext): Promise<ComputeInput | null> {
    const agenda = await this.prisma.agenda.findUnique({
      where: { id: agendaId },
      include: { practitioner: { select: { organizationId: true } }, availabilityRules: true, motives: { where: { id: motiveId, isActive: true } } },
    });
    const motive = agenda?.motives[0];
    if (!agenda || !motive) return null;

    const busyWhere: Prisma.AppointmentWhereInput = {
      agendaId,
      status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
      startsAt: { lt: to },
      endsAt: { gt: from },
    };
    const [appointments, absences, holidays, locks, isKnownPatient] = await Promise.all([
      this.prisma.appointment.findMany({ where: busyWhere, select: { startsAt: true, endsAt: true } }),
      this.prisma.absence.findMany({ where: { agendaId, startsAt: { lt: to }, endsAt: { gt: from } }, select: { startsAt: true, endsAt: true } }),
      this.prisma.holiday.findMany({ where: { date: { gte: new Date(from.getTime() - 86_400_000), lte: to } }, select: { date: true } }),
      this.locks.list(agendaId, ctx.bookingSessionId),
      this.isKnownPatient(agenda.practitioner.organizationId, ctx.patientProfileId),
    ]);

    return {
      agenda: {
        timezone: agenda.timezone,
        slotStepMinutes: agenda.slotStepMinutes,
        bookingHorizonDays: agenda.bookingHorizonDays,
        minNoticeMinutes: agenda.minNoticeMinutes,
        onlineBookingEnabled: agenda.onlineBookingEnabled,
        blockHolidays: agenda.blockHolidays,
      },
      motive: {
        id: motive.id,
        durationMinutes: motive.durationMinutes,
        isOnline: motive.isOnline,
        newPatientsAllowed: motive.newPatientsAllowed,
        minNoticeMinutes: motive.minNoticeMinutes,
      },
      rules: agenda.availabilityRules.map((r) => ({
        weekday: r.weekday,
        startMinutes: r.startMinutes,
        endMinutes: r.endMinutes,
        motiveIds: r.motiveIds,
        capacity: r.capacity,
        validFrom: dateOnly(r.validFrom),
        validUntil: dateOnly(r.validUntil),
        recurrence: r.recurrence,
        anchorDate: dateOnly(r.anchorDate),
      })),
      absences,
      holidays: holidays.map((h) => h.date.toISOString().slice(0, 10)),
      appointments,
      locks: locks.map(({ startsAt, endsAt }) => ({ startsAt, endsAt })),
      range: { from, to },
      now: ctx.now ?? new Date(),
      context: { isKnownPatient, source: ctx.source },
    };
  }

  /** Slots grouped by local day, between two local dates (inclusive), at most 31 days. */
  async days(agendaId: string, motiveId: string, fromDate: string, toDate: string, ctx: AvailabilityContext): Promise<{ days: DaySlots[]; reason: UnavailableReason | null; timezone: string } | null> {
    const agenda = await this.prisma.agenda.findUnique({ where: { id: agendaId }, select: { timezone: true } });
    if (!agenda) return null;
    const from = zonedToUtc(fromDate, 0, agenda.timezone);
    const to = zonedToUtc(addDaysToDateKey(toDate, 1), 0, agenda.timezone);
    const input = await this.buildInput(agendaId, motiveId, from, to, ctx);
    if (!input) return null;
    const result = computeSlots(input);
    return { days: groupSlotsByDay(result.slots, agenda.timezone), reason: result.reason, timezone: agenda.timezone };
  }

  /** First bookable slot within the next `days` days, or null. */
  async firstSlot(agendaId: string, motiveId: string, days: number, ctx: AvailabilityContext): Promise<Date | null> {
    const now = ctx.now ?? new Date();
    const today = toDateKey(now);
    const result = await this.days(agendaId, motiveId, today, addDaysToDateKey(today, days), ctx);
    return result?.days[0]?.slots[0]?.startsAt ?? null;
  }

  async isBookable(agendaId: string, motiveId: string, startsAt: Date, ctx: AvailabilityContext): Promise<boolean> {
    const input = await this.buildInput(agendaId, motiveId, new Date(startsAt.getTime() - 86_400_000), new Date(startsAt.getTime() + 86_400_000), ctx);
    return !!input && isSlotBookable(input, startsAt);
  }
}
