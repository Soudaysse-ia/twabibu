import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SessionUser } from '../auth/auth.types.js';
import { AvailabilityService } from '../availability/availability.service.js';
import { LOCK_TTL_SECONDS, SlotLockService } from '../availability/slot-locks.js';
import { ApiException } from '../common/api-exception.js';
import { AppointmentMessagesService } from '../notifications/appointment-messages.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { appointmentInclude, toPatientView } from './appointment-view.js';

export interface BookingInput {
  agendaId: string;
  motiveId: string;
  startsAt: Date;
  relativeId?: string;
  newRelative?: { firstName: string; lastName: string; birthDate: string; relationship: string };
  answers?: Record<string, string>;
  instructionsAccepted: true;
  patientMessage?: string;
}

/** Online booking (SPEC-03): lock the slot, then create the appointment once the patient is signed in. */
@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly locks: SlotLockService,
    private readonly messages: AppointmentMessagesService,
  ) {}

  private async loadMotive(agendaId: string, motiveId: string) {
    const motive = await this.prisma.motive.findFirst({
      where: { id: motiveId, agendaId, isActive: true, isOnline: true, agenda: { practitioner: { isPublished: true, verificationStatus: 'VERIFIED', deletedAt: null } } },
      include: { agenda: { include: { practitioner: true, practice: { include: { locality: true } } } } },
    });
    if (!motive) throw new ApiException('NOT_FOUND', 'Motive not found');
    return motive;
  }

  async lock(input: { agendaId: string; motiveId: string; startsAt: Date }, bookingSessionId: string, user: SessionUser | null) {
    const motive = await this.loadMotive(input.agendaId, input.motiveId);
    const ctx = { source: 'ONLINE' as const, patientProfileId: user?.patientProfileId, bookingSessionId };
    // Never trust the client: the slot must come out of the engine right now.
    if (!(await this.availability.isBookable(input.agendaId, input.motiveId, input.startsAt, ctx))) {
      throw new ApiException('SLOT_UNAVAILABLE', 'Slot unavailable');
    }
    const endsAt = new Date(input.startsAt.getTime() + motive.durationMinutes * 60_000);
    const acquired = await this.locks.acquire({ ...input, endsAt, sessionId: bookingSessionId });
    if (!acquired) throw new ApiException('SLOT_UNAVAILABLE', 'Slot just taken');
    await this.locks.releaseOthers(input.agendaId, bookingSessionId, input.startsAt);
    return { agendaId: input.agendaId, motiveId: input.motiveId, startsAt: input.startsAt.toISOString(), endsAt: endsAt.toISOString(), expiresInSeconds: LOCK_TTL_SECONDS };
  }

  async unlock(agendaId: string, startsAt: Date, bookingSessionId: string): Promise<void> {
    await this.locks.release(agendaId, startsAt, bookingSessionId);
  }

  async book(input: BookingInput, user: SessionUser, bookingSessionId: string) {
    const profileId = user.patientProfileId!;
    const owner = await this.locks.owner(input.agendaId, input.startsAt);
    if (!owner || owner.sessionId !== bookingSessionId || owner.motiveId !== input.motiveId) {
      throw new ApiException('SLOT_LOCK_EXPIRED', 'Slot is no longer held for you');
    }
    const motive = await this.loadMotive(input.agendaId, input.motiveId);
    const agenda = motive.agenda;
    const organizationId = agenda.practitioner.organizationId;
    const profile = await this.prisma.patientProfile.findUniqueOrThrow({ where: { id: profileId }, include: { user: { select: { phone: true, email: true } } } });

    // Who is the appointment for?
    let person: { firstName: string; lastName: string; birthDate: Date; relativeId: string | null };
    if (input.relativeId) {
      const relative = await this.prisma.relative.findFirst({ where: { id: input.relativeId, patientProfileId: profileId } });
      if (!relative) throw new ApiException('NOT_FOUND', 'Relative not found');
      person = { ...relative, relativeId: relative.id };
    } else if (input.newRelative) {
      const relative = await this.prisma.relative.create({
        data: { patientProfileId: profileId, ...input.newRelative, birthDate: new Date(`${input.newRelative.birthDate}T00:00:00Z`) },
      });
      person = { ...relative, relativeId: relative.id };
    } else {
      person = { firstName: profile.firstName, lastName: profile.lastName, birthDate: profile.birthDate, relativeId: null };
    }

    if (!(await this.availability.isBookable(input.agendaId, input.motiveId, input.startsAt, { source: 'ONLINE', patientProfileId: profileId, bookingSessionId }))) {
      throw new ApiException(motive.newPatientsAllowed ? 'SLOT_UNAVAILABLE' : 'NEW_PATIENTS_NOT_ACCEPTED', 'Slot unavailable');
    }

    // The practice's file for this person (created on first booking, SPEC-06 §2).
    const record =
      (await this.prisma.patientRecord.findFirst({ where: { organizationId, patientProfileId: profileId, relativeId: person.relativeId, deletedAt: null, mergedIntoId: null } })) ??
      (await this.prisma.patientRecord.create({
        data: {
          organizationId,
          patientProfileId: profileId,
          relativeId: person.relativeId,
          firstName: person.firstName,
          lastName: person.lastName,
          birthDate: person.birthDate,
          phone: profile.user.phone,
          email: profile.user.email,
        },
      }));
    if (record.isBlocked) throw new ApiException('BOOKING_BLOCKED', 'Please contact the practice');

    const active = await this.prisma.appointment.count({
      where: { patientRecordId: record.id, agenda: { practitionerId: agenda.practitionerId }, startsAt: { gt: new Date() }, status: { in: ['CONFIRMED', 'PENDING_VALIDATION'] } },
    });
    if (active >= agenda.maxActiveAppointmentsPerPatient) throw new ApiException('TOO_MANY_ACTIVE_APPOINTMENTS', 'Too many upcoming appointments with this practitioner');

    const status = agenda.requiresValidation ? 'PENDING_VALIDATION' : 'CONFIRMED';
    let appointmentId: string;
    try {
      const created = await this.prisma.appointment.create({
        data: {
          agendaId: agenda.id,
          motiveId: motive.id,
          patientRecordId: record.id,
          patientProfileId: profileId,
          relativeId: person.relativeId,
          startsAt: input.startsAt,
          endsAt: new Date(input.startsAt.getTime() + motive.durationMinutes * 60_000),
          status,
          source: 'ONLINE',
          bookedByUserId: user.id,
          answers: input.answers ?? Prisma.JsonNull,
          patientMessage: input.patientMessage ?? null,
          instructionsAcceptedAt: new Date(),
          events: { create: { type: 'BOOKED', actorUserId: user.id, payload: { source: 'ONLINE' } } },
        },
      });
      appointmentId = created.id;
    } catch (error) {
      // 23P01 = exclusion_violation: the database refused an overlapping appointment.
      if (String((error as Error).message).includes('appointment_no_overlap') || String((error as Error).message).includes('23P01')) {
        throw new ApiException('SLOT_UNAVAILABLE', 'Slot just taken');
      }
      throw error;
    }
    await this.locks.release(input.agendaId, input.startsAt, bookingSessionId);

    await this.messages.send(appointmentId, status === 'CONFIRMED' ? 'booked' : 'pending');
    const appointment = await this.prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId }, include: appointmentInclude });
    return toPatientView(appointment);
  }
}
