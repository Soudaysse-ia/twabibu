import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { activeRulesOn } from '@twabibu/availability';
import { ACTIVE_APPOINTMENT_STATUSES } from '@twabibu/contracts';
import { addDaysToDateKey, normalizePhone, searchKey, zonedToUtc } from '@twabibu/utils';
import type { SessionUser } from '../auth/auth.types.js';
import { practitionerName } from '../booking/appointment-view.js';
import { ApiException } from '../common/api-exception.js';
import { AppointmentMessagesService } from '../notifications/appointment-messages.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { canForceOverlap, canMarkNoShow, canTransition, canViewAgenda, type MembershipContext } from './permissions.js';

const TZ = 'Indian/Comoro';

const proAppointmentInclude = {
  motive: { select: { id: true, name: true, color: true, durationMinutes: true } },
  patientRecord: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, birthDate: true, noShowCount: true, patientProfileId: true } },
  agenda: { select: { id: true, practitioner: { select: { title: true, firstName: true, lastName: true, slug: true, speciality: { select: { slug: true } } } }, practice: { select: { locality: { select: { name: true, slug: true } } } } } },
} satisfies Prisma.AppointmentInclude;

type ProAppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof proAppointmentInclude }>;

function toProView(a: ProAppointmentRow) {
  return {
    id: a.id,
    agendaId: a.agendaId,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    status: a.status,
    source: a.source,
    allowOverlap: a.allowOverlap,
    confirmedByPatientAt: a.confirmedByPatientAt?.toISOString() ?? null,
    notes: a.notes,
    patientMessage: a.patientMessage,
    motive: { id: a.motive.id, name: a.motive.name, color: a.motive.color },
    patient: {
      id: a.patientRecord.id,
      firstName: a.patientRecord.firstName,
      lastName: a.patientRecord.lastName,
      phone: a.patientRecord.phone,
      email: a.patientRecord.email,
      birthDate: a.patientRecord.birthDate?.toISOString().slice(0, 10) ?? null,
      noShowCount: a.patientRecord.noShowCount,
      hasAccount: a.patientRecord.patientProfileId !== null,
    },
  };
}

export interface CreatePracticeAppointment {
  agendaId: string;
  motiveId: string;
  startsAt: Date;
  patientRecordId?: string;
  newPatient?: { firstName: string; lastName: string; email?: string; phone?: string; birthDate?: string };
  notes?: string;
  source: 'PHONE' | 'WALK_IN' | 'PRACTICE';
  force: boolean;
  notifyPatient: boolean;
}

/** The practice side of the agenda (SPEC-05): read the week, book, move, change status, cancel. */
@Injectable()
export class ProService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: AppointmentMessagesService,
  ) {}

  async me(user: SessionUser) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id, role: { in: ['OWNER', 'ADMIN', 'PRACTITIONER', 'SECRETARY'] }, organization: { status: { not: 'SUSPENDED' }, type: { not: 'PHARMACY' } } },
      include: { organization: { select: { id: true, name: true, type: true } }, practitioner: { select: { title: true, firstName: true, lastName: true, verificationStatus: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      userId: user.id,
      email: user.email,
      memberships: memberships.map((m) => ({
        organizationId: m.organization.id,
        organizationName: m.organization.name,
        role: m.role,
        practitionerId: m.practitionerId,
        displayName: m.practitioner ? practitionerName(m.practitioner) : m.role === 'SECRETARY' ? 'Secrétariat' : 'Direction',
        /** The member's own practitioner file: PENDING until the back-office validates it (SPEC-07 §4). */
        verificationStatus: m.practitioner?.verificationStatus ?? null,
      })),
    };
  }

  /** Agendas of the practice visible to this member. */
  async agendas(m: MembershipContext) {
    const rows = await this.prisma.agenda.findMany({
      where: { practitioner: { organizationId: m.organizationId, deletedAt: null } },
      include: {
        practitioner: { select: { id: true, title: true, firstName: true, lastName: true, speciality: { select: { name: true } } } },
        practice: { select: { name: true } },
        motives: { where: { isActive: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, durationMinutes: true, color: true, isOnline: true } },
      },
      orderBy: [{ practitioner: { lastName: 'asc' } }, { createdAt: 'asc' }],
    });
    return rows
      .filter((a) => canViewAgenda(m, a))
      .map((a) => ({
        id: a.id,
        name: a.name,
        color: a.color,
        slotStepMinutes: a.slotStepMinutes,
        practiceName: a.practice.name,
        practitioner: { id: a.practitioner.id, name: practitionerName(a.practitioner), speciality: a.practitioner.speciality.name },
        motives: a.motives,
        mine: a.practitionerId === m.practitionerId,
      }));
  }

  private async agendaFor(m: MembershipContext, agendaId: string) {
    const agenda = await this.prisma.agenda.findFirst({
      where: { id: agendaId, practitioner: { organizationId: m.organizationId } },
      include: { practitioner: true, practice: { include: { locality: true } } },
    });
    if (!agenda || !canViewAgenda(m, agenda)) throw new ApiException('NOT_FOUND', 'Agenda not found');
    return agenda;
  }

  /** Everything the agenda grid needs between two local dates (≤ 31 days). */
  async events(m: MembershipContext, agendaIds: string[], from: string, to: string) {
    const visible = (await this.agendas(m)).map((a) => a.id);
    const ids = agendaIds.length ? agendaIds.filter((id) => visible.includes(id)) : visible;
    const start = zonedToUtc(from, 0, TZ);
    const end = zonedToUtc(addDaysToDateKey(to, 1), 0, TZ);
    const [appointments, absences, rules, holidays] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { agendaId: { in: ids }, startsAt: { lt: end }, endsAt: { gt: start }, status: { in: [...ACTIVE_APPOINTMENT_STATUSES] } },
        include: proAppointmentInclude,
        orderBy: { startsAt: 'asc' },
      }),
      this.prisma.absence.findMany({ where: { agendaId: { in: ids }, startsAt: { lt: end }, endsAt: { gt: start } }, orderBy: { startsAt: 'asc' } }),
      this.prisma.availabilityRule.findMany({ where: { agendaId: { in: ids } } }),
      this.prisma.holiday.findMany({ where: { date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } } }),
    ]);
    const windows: { agendaId: string; date: string; startMinutes: number; endMinutes: number }[] = [];
    for (let day = from; day <= to; day = addDaysToDateKey(day, 1)) {
      for (const agendaId of ids) {
        const agendaRules = rules
          .filter((r) => r.agendaId === agendaId)
          .map((r) => ({
            ...r,
            validFrom: r.validFrom?.toISOString().slice(0, 10) ?? null,
            validUntil: r.validUntil?.toISOString().slice(0, 10) ?? null,
            anchorDate: r.anchorDate?.toISOString().slice(0, 10) ?? null,
          }));
        for (const r of activeRulesOn(agendaRules, day)) windows.push({ agendaId, date: day, startMinutes: r.startMinutes, endMinutes: r.endMinutes });
      }
    }
    return {
      agendaIds: ids,
      appointments: appointments.map(toProView),
      absences: absences.map((a) => ({ id: a.id, agendaId: a.agendaId, startsAt: a.startsAt.toISOString(), endsAt: a.endsAt.toISOString(), reason: a.reason })),
      windows,
      holidays: holidays.map((h) => ({ date: h.date.toISOString().slice(0, 10), name: h.name })),
    };
  }

  async searchPatients(m: MembershipContext, q: string) {
    const term = searchKey(q);
    const digits = q.replace(/\D/g, '');
    if (term.length < 2 && digits.length < 3) return [];
    const rows = await this.prisma.patientRecord.findMany({
      where: {
        organizationId: m.organizationId,
        deletedAt: null,
        mergedIntoId: null,
        OR: [
          { lastName: { contains: term, mode: 'insensitive' } },
          { firstName: { contains: term, mode: 'insensitive' } },
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
          ...(q.includes('@') ? [{ email: { contains: q.trim().toLowerCase() } }] : []),
        ],
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 20,
      include: { appointments: { where: { startsAt: { gte: new Date() }, status: { in: ['CONFIRMED', 'PENDING_VALIDATION'] } }, orderBy: { startsAt: 'asc' }, take: 1, select: { startsAt: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      phone: r.phone,
      email: r.email,
      birthDate: r.birthDate?.toISOString().slice(0, 10) ?? null,
      isBlocked: r.isBlocked,
      noShowCount: r.noShowCount,
      hasAccount: r.patientProfileId !== null,
      nextAppointmentAt: r.appointments[0]?.startsAt.toISOString() ?? null,
    }));
  }

  private async assertFree(agendaId: string, startsAt: Date, endsAt: Date, exceptId?: string) {
    const [clash, absence] = await Promise.all([
      this.prisma.appointment.findFirst({
        where: { agendaId, id: exceptId ? { not: exceptId } : undefined, status: { in: [...ACTIVE_APPOINTMENT_STATUSES] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
        include: { patientRecord: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.absence.findFirst({ where: { agendaId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } }),
    ]);
    return { clash, absence };
  }

  async create(m: MembershipContext, user: SessionUser, input: CreatePracticeAppointment) {
    const agenda = await this.agendaFor(m, input.agendaId);
    const motive = await this.prisma.motive.findFirst({ where: { id: input.motiveId, agendaId: agenda.id } });
    if (!motive) throw new ApiException('NOT_FOUND', 'Motive not found');
    const endsAt = new Date(input.startsAt.getTime() + motive.durationMinutes * 60_000);

    const { clash, absence } = await this.assertFree(agenda.id, input.startsAt, endsAt);
    if (absence && !input.force) throw new ApiException('CONFLICT', 'The practitioner is absent at that time', { absence: { startsAt: absence.startsAt, endsAt: absence.endsAt, reason: absence.reason } });
    if (clash) {
      if (!input.force) throw new ApiException('SLOT_UNAVAILABLE', 'Another appointment overlaps', { with: `${clash.patientRecord.firstName} ${clash.patientRecord.lastName}`, startsAt: clash.startsAt });
      if (!canForceOverlap(m)) throw new ApiException('FORBIDDEN', 'Overbooking is not allowed for your role');
    }

    let recordId = input.patientRecordId;
    if (recordId) {
      const record = await this.prisma.patientRecord.findFirst({ where: { id: recordId, organizationId: m.organizationId, deletedAt: null } });
      if (!record) throw new ApiException('NOT_FOUND', 'Patient not found');
    } else if (input.newPatient) {
      const phone = input.newPatient.phone ? normalizePhone(input.newPatient.phone) : null;
      if (input.newPatient.phone && !phone) throw new ApiException('VALIDATION_FAILED', 'Invalid phone number', [{ path: 'newPatient.phone', message: 'Invalid phone number' }]);
      const record = await this.prisma.patientRecord.create({
        data: {
          organizationId: m.organizationId,
          firstName: input.newPatient.firstName,
          lastName: input.newPatient.lastName,
          phone,
          email: input.newPatient.email ?? null,
          birthDate: input.newPatient.birthDate ? new Date(`${input.newPatient.birthDate}T00:00:00Z`) : null,
        },
      });
      recordId = record.id;
    } else throw new ApiException('VALIDATION_FAILED', 'Choose a patient or create one');

    let id: string;
    try {
      const created = await this.prisma.appointment.create({
        data: {
          agendaId: agenda.id,
          motiveId: motive.id,
          patientRecordId: recordId,
          startsAt: input.startsAt,
          endsAt,
          status: 'CONFIRMED',
          source: input.source,
          allowOverlap: !!clash,
          bookedByUserId: user.id,
          notes: input.notes ?? null,
          events: { create: { type: 'BOOKED', actorUserId: user.id, payload: { source: input.source, forced: !!clash } } },
        },
      });
      id = created.id;
    } catch (error) {
      if (String((error as Error).message).includes('appointment_no_overlap')) throw new ApiException('SLOT_UNAVAILABLE', 'Another appointment overlaps');
      throw error;
    }
    const row = await this.prisma.appointment.findUniqueOrThrow({ where: { id }, include: proAppointmentInclude });
    if (input.notifyPatient) await this.messages.send(row.id, 'booked');
    return toProView(row);
  }

  private async appointmentFor(m: MembershipContext, id: string) {
    const a = await this.prisma.appointment.findFirst({ where: { id, agenda: { practitioner: { organizationId: m.organizationId } } }, include: { ...proAppointmentInclude, agenda: { select: { ...proAppointmentInclude.agenda.select, practitionerId: true } } } });
    if (!a || !canViewAgenda(m, { id: a.agendaId, practitionerId: a.agenda.practitionerId })) throw new ApiException('NOT_FOUND', 'Appointment not found');
    return a;
  }

  async update(m: MembershipContext, user: SessionUser, id: string, input: { status?: string; startsAt?: Date; notes?: string | null; notifyPatient: boolean }) {
    const a = await this.appointmentFor(m, id);
    if (a.status === 'CANCELLED_BY_PATIENT' || a.status === 'CANCELLED_BY_PRACTICE') throw new ApiException('CONFLICT', 'Cancelled appointments cannot be changed');
    const data: Prisma.AppointmentUpdateInput = {};
    const events: Prisma.AppointmentEventCreateWithoutAppointmentInput[] = [];

    if (input.status && input.status !== a.status) {
      if (!canTransition(a.status, input.status)) throw new ApiException('CONFLICT', `Cannot go from ${a.status} to ${input.status}`);
      if (input.status === 'NO_SHOW' && !canMarkNoShow(a.startsAt, new Date())) throw new ApiException('CONFLICT', 'A no-show is recorded once the appointment time has passed');
      data.status = input.status as Prisma.AppointmentUpdateInput['status'];
      events.push({ type: 'STATUS_CHANGED', actorUserId: user.id, payload: { from: a.status, to: input.status } });
      // No-show counter on the patient file (SPEC-05 §Règles 4).
      if (input.status === 'NO_SHOW') await this.prisma.patientRecord.update({ where: { id: a.patientRecord.id }, data: { noShowCount: { increment: 1 } } });
      if (a.status === 'NO_SHOW') await this.prisma.patientRecord.update({ where: { id: a.patientRecord.id }, data: { noShowCount: { decrement: 1 } } });
    }

    // Accepting an online request (SPEC-05 §Règles 6): the patient is told it is confirmed.
    const accepted = a.status === 'PENDING_VALIDATION' && data.status === 'CONFIRMED';

    let moved = false;
    if (input.startsAt && input.startsAt.getTime() !== a.startsAt.getTime()) {
      const duration = a.endsAt.getTime() - a.startsAt.getTime();
      const endsAt = new Date(input.startsAt.getTime() + duration);
      const { clash, absence } = await this.assertFree(a.agendaId, input.startsAt, endsAt, a.id);
      if (clash) throw new ApiException('SLOT_UNAVAILABLE', 'Another appointment overlaps', { with: `${clash.patientRecord.firstName} ${clash.patientRecord.lastName}` });
      if (absence) throw new ApiException('CONFLICT', 'The practitioner is absent at that time');
      data.startsAt = input.startsAt;
      data.endsAt = endsAt;
      // A presence confirmed for the old time says nothing about the new one.
      data.confirmedByPatientAt = null;
      events.push({ type: 'RESCHEDULED', actorUserId: user.id, payload: { from: a.startsAt.toISOString(), to: input.startsAt.toISOString() } });
      moved = true;
    }
    if (input.notes !== undefined && input.notes !== a.notes) data.notes = input.notes;
    if (events.length) data.events = { create: events };

    try {
      await this.prisma.appointment.update({ where: { id: a.id }, data });
    } catch (error) {
      if (String((error as Error).message).includes('appointment_no_overlap')) throw new ApiException('SLOT_UNAVAILABLE', 'Another appointment overlaps');
      throw error;
    }
    const row = await this.prisma.appointment.findUniqueOrThrow({ where: { id: a.id }, include: proAppointmentInclude });
    if (input.notifyPatient && accepted) await this.messages.send(row.id, 'accepted');
    else if (input.notifyPatient && moved) await this.messages.send(row.id, 'rescheduled');
    return toProView(row);
  }

  async cancel(m: MembershipContext, user: SessionUser, id: string, input: { reason?: string; notifyPatient: boolean }) {
    const a = await this.appointmentFor(m, id);
    if (a.status !== 'CONFIRMED' && a.status !== 'PENDING_VALIDATION' && a.status !== 'ARRIVED') throw new ApiException('CONFLICT', 'This appointment cannot be cancelled');
    // Cancelling a request that was never accepted is a refusal: different event and message.
    const refused = a.status === 'PENDING_VALIDATION';
    await this.prisma.appointment.update({
      where: { id: a.id },
      data: {
        status: 'CANCELLED_BY_PRACTICE',
        cancelledAt: new Date(),
        cancellationReason: input.reason ?? null,
        events: { create: refused ? { type: 'REFUSED', actorUserId: user.id, payload: { reason: input.reason ?? null } } : { type: 'CANCELLED', actorUserId: user.id, payload: { by: 'PRACTICE', reason: input.reason ?? null } } },
      },
    });
    const row = await this.prisma.appointment.findUniqueOrThrow({ where: { id: a.id }, include: proAppointmentInclude });
    if (input.notifyPatient && row.startsAt > new Date()) await this.messages.send(row.id, refused ? 'refused' : 'cancelledByPractice');
    return toProView(row);
  }

  async one(m: MembershipContext, id: string) {
    const a = await this.appointmentFor(m, id);
    return { ...toProView(a), practitionerId: a.agenda.practitionerId };
  }

  async history(m: MembershipContext, id: string) {
    const a = await this.appointmentFor(m, id);
    const events = await this.prisma.appointmentEvent.findMany({ where: { appointmentId: a.id }, orderBy: { createdAt: 'asc' } });
    const notifications = await this.prisma.notification.findMany({ where: { relatedAppointmentId: a.id }, orderBy: { createdAt: 'asc' }, select: { template: true, channel: true, status: true, createdAt: true } });
    return { events: events.map((e) => ({ type: e.type, at: e.createdAt.toISOString(), payload: e.payload })), notifications };
  }

  /** Used by the absence flow: cancel each impacted appointment and tell the patient. */
  async cancelForAbsence(m: MembershipContext, user: SessionUser, ids: string[], reason: string) {
    for (const id of ids) await this.cancel(m, user, id, { reason, notifyPatient: true });
  }
}
