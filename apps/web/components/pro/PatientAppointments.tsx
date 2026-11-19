'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Badge, Card, CardTitle } from '@twabibu/ui';
import { formatDateLong, formatTime } from '@twabibu/utils';
import type { ProPatientOverview } from '@/lib/pro-types';

const STATUS: Record<string, string> = {
  PENDING_VALIDATION: 'À valider',
  CONFIRMED: 'Confirmé',
  ARRIVED: 'Arrivé',
  IN_CONSULTATION: 'En consultation',
  DONE: 'Terminé',
  NO_SHOW: 'Absent',
  CANCELLED_BY_PATIENT: 'Annulé par le patient',
  CANCELLED_BY_PRACTICE: 'Annulé par le cabinet',
};

/** Appointments of the patient on the agendas the member may see, upcoming first then the history. */
export function PatientAppointments({ appointments }: { appointments: ProPatientOverview['appointments'] }) {
  const [all, setAll] = useState(false);
  const upcoming = appointments.filter((a) => a.upcoming && !a.status.startsWith('CANCELLED')).reverse();
  const past = appointments.filter((a) => !a.upcoming || a.status.startsWith('CANCELLED'));
  const shown = all ? past : past.slice(0, 6);
  const line = (a: ProPatientOverview['appointments'][number]) => (
    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span className="min-w-0">
        <span className="font-medium text-ink first-letter:uppercase">
          {formatDateLong(new Date(a.startsAt))} à {formatTime(new Date(a.startsAt))}
        </span>
        <span className="block text-text-muted">
          {a.motive} · {a.practitioner}
        </span>
      </span>
      <Badge tone={a.status === 'DONE' ? 'success' : a.status === 'NO_SHOW' || a.status.startsWith('CANCELLED') ? 'warning' : 'info'}>{STATUS[a.status] ?? a.status}</Badge>
    </li>
  );
  return (
    <Card className="flex flex-col gap-2">
      <CardTitle as="h2" icon={<CalendarDays aria-hidden="true" size={16} />}>
        Rendez-vous
      </CardTitle>
      {appointments.length === 0 ? <p className="text-sm text-text">Aucun rendez-vous avec la structure.</p> : null}
      {upcoming.length ? (
        <>
          <h3 className="text-xs font-bold tracking-wide text-text-muted uppercase">À venir</h3>
          <ul className="divide-y divide-border">{upcoming.map(line)}</ul>
        </>
      ) : null}
      {past.length ? (
        <>
          <h3 className="text-xs font-bold tracking-wide text-text-muted uppercase">Historique ({past.length})</h3>
          <ul className="divide-y divide-border">{shown.map(line)}</ul>
          {past.length > shown.length ? (
            <button type="button" onClick={() => setAll(true)} className="self-start text-sm font-medium text-primary hover:underline">
              Voir tout l’historique
            </button>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
