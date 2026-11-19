import { Injectable } from '@nestjs/common';
import type { SessionUser } from '../auth/auth.types.js';
import { appointmentInclude, toPatientView } from '../booking/appointment-view.js';
import { ApiException } from '../common/api-exception.js';
import { AppointmentMessagesService } from '../notifications/appointment-messages.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: AppointmentMessagesService,
  ) {}

  /** Only reminders can be switched off: confirmations and cancellations always go out (SPEC-08 §Règles 4). */
  async preferences(user: SessionUser) {
    const p = await this.prisma.notificationPreference.findUnique({ where: { userId: user.id } });
    return { reminders: !(p?.reminderOptOut ?? false) };
  }

  async updatePreferences(user: SessionUser, input: { reminders: boolean }) {
    await this.prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: { reminderOptOut: !input.reminders },
      create: { userId: user.id, reminderOptOut: !input.reminders, sms: false },
    });
    return this.preferences(user);
  }

  async me(user: SessionUser) {
    const u = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { patientProfile: { include: { relatives: { orderBy: { createdAt: 'asc' } } } } },
    });
    const p = u.patientProfile;
    return {
      id: u.id,
      kind: u.kind,
      phone: u.phone,
      email: u.email,
      profile: p && {
        civility: p.civility,
        firstName: p.firstName,
        lastName: p.lastName,
        birthDate: p.birthDate.toISOString().slice(0, 10),
      },
      relatives: (p?.relatives ?? []).map((r) => ({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        birthDate: r.birthDate.toISOString().slice(0, 10),
        relationship: r.relationship,
      })),
    };
  }

  async addRelative(user: SessionUser, input: { firstName: string; lastName: string; birthDate: string; relationship: string }) {
    const r = await this.prisma.relative.create({
      data: { patientProfileId: user.patientProfileId!, ...input, birthDate: new Date(`${input.birthDate}T00:00:00Z`) },
    });
    return { id: r.id, firstName: r.firstName, lastName: r.lastName, birthDate: input.birthDate, relationship: r.relationship };
  }

  async appointments(user: SessionUser, scope: 'upcoming' | 'past') {
    const now = new Date();
    const rows = await this.prisma.appointment.findMany({
      where: {
        patientProfileId: user.patientProfileId!,
        ...(scope === 'upcoming'
          ? { endsAt: { gte: now }, status: { in: ['CONFIRMED', 'PENDING_VALIDATION', 'ARRIVED', 'IN_CONSULTATION'] } }
          : { OR: [{ endsAt: { lt: now } }, { status: { in: ['CANCELLED_BY_PATIENT', 'CANCELLED_BY_PRACTICE', 'DONE', 'NO_SHOW'] } }] }),
      },
      include: appointmentInclude,
      orderBy: { startsAt: scope === 'upcoming' ? 'asc' : 'desc' },
      take: 50,
    });
    return rows.map((a) => toPatientView(a, now));
  }

  async cancel(user: SessionUser, appointmentId: string) {
    const a = await this.prisma.appointment.findFirst({ where: { id: appointmentId, patientProfileId: user.patientProfileId! }, include: appointmentInclude });
    if (!a) throw new ApiException('NOT_FOUND', 'Appointment not found');
    const view = toPatientView(a);
    if (!view.cancellation.allowed) {
      if (a.status !== 'CONFIRMED' && a.status !== 'PENDING_VALIDATION') throw new ApiException('CONFLICT', 'Appointment cannot be cancelled');
      throw new ApiException('CANCELLATION_DEADLINE_PASSED', 'Online cancellation deadline passed', { practicePhone: a.agenda.practice.phone });
    }
    await this.prisma.appointment.update({
      where: { id: a.id },
      data: {
        status: 'CANCELLED_BY_PATIENT',
        cancelledAt: new Date(),
        cancellationReason: 'Annulé en ligne par le patient',
        events: { create: { type: 'CANCELLED', actorUserId: user.id, payload: { by: 'PATIENT' } } },
      },
    });
    await this.messages.send(a.id, 'cancelledByPatient');
    const updated = await this.prisma.appointment.findUniqueOrThrow({ where: { id: a.id }, include: appointmentInclude });
    return toPatientView(updated);
  }
}
