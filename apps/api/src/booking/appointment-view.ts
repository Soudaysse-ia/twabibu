import type { Prisma } from '@prisma/client';

export const appointmentInclude = {
  motive: { select: { id: true, name: true, cancellationDeadlineHours: true, instructions: true, priceKmf: true } },
  agenda: {
    select: {
      practitioner: { select: { slug: true, title: true, firstName: true, lastName: true, speciality: { select: { slug: true, name: true } } } },
      practice: { select: { name: true, addressLine: true, phone: true, lat: true, lng: true, locality: { select: { slug: true, name: true, island: { select: { name: true } } } } } },
    },
  },
  patientRecord: { select: { firstName: true, lastName: true, relativeId: true } },
} satisfies Prisma.AppointmentInclude;

export type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

export function practitionerName(p: { title: string | null; firstName: string; lastName: string }): string {
  return [p.title, p.firstName, p.lastName].filter(Boolean).join(' ');
}

/** What a patient sees about one of their appointments. Never includes practice-internal notes. */
export function toPatientView(a: AppointmentRow, now = new Date()) {
  const p = a.agenda.practitioner;
  const deadline = new Date(a.startsAt.getTime() - a.motive.cancellationDeadlineHours * 3600_000);
  const active = a.status === 'CONFIRMED' || a.status === 'PENDING_VALIDATION';
  return {
    id: a.id,
    agendaId: a.agendaId,
    motiveId: a.motive.id,
    status: a.status,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    motive: a.motive.name,
    priceKmf: a.motive.priceKmf,
    instructions: a.motive.instructions,
    forName: `${a.patientRecord.firstName} ${a.patientRecord.lastName}`,
    forRelative: a.patientRecord.relativeId !== null,
    practitioner: {
      name: practitionerName(p),
      speciality: p.speciality.name,
      slug: p.slug,
      url: `/${p.speciality.slug}/${a.agenda.practice.locality.slug}/${p.slug}`,
    },
    practice: {
      name: a.agenda.practice.name,
      addressLine: a.agenda.practice.addressLine,
      locality: a.agenda.practice.locality.name,
      island: a.agenda.practice.locality.island.name,
      phone: a.agenda.practice.phone,
      lat: a.agenda.practice.lat,
      lng: a.agenda.practice.lng,
    },
    cancellation: {
      allowed: active && a.startsAt > now && deadline > now,
      deadline: deadline.toISOString(),
    },
  };
}
