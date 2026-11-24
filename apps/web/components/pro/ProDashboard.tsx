'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarClock, CalendarDays, CheckCircle2, ChevronRight, FileText, Search, Stethoscope, UserX, Users } from 'lucide-react';
import { Badge, buttonClasses, Card, cn } from '@twabibu/ui';
import { formatDateLong, formatTime } from '@twabibu/utils';
import { api, errorMessage } from '@/lib/api-client';
import type { ProDashboard as Data } from '@/lib/pro-types';
import { useMembership } from './ProContext';
import { SetupChecklist } from './SetupChecklist';

const STATUS: Record<string, { label: string; tone: 'info' | 'success' | 'warning' | 'pharmacy' }> = {
  PENDING_VALIDATION: { label: 'À valider', tone: 'warning' },
  CONFIRMED: { label: 'Confirmé', tone: 'info' },
  ARRIVED: { label: 'Arrivé', tone: 'pharmacy' },
  IN_CONSULTATION: { label: 'En consultation', tone: 'pharmacy' },
  DONE: { label: 'Terminé', tone: 'success' },
  NO_SHOW: { label: 'Absent', tone: 'warning' },
};

/** Practitioner's home (SPEC-05): today's list, what needs an answer, recent patients. No medical data here. */
export function ProDashboard() {
  const m = useMembership();
  const clinician = !!m.practitionerId;
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const load = () => api<Data>(`/v1/pro/orgs/${m.organizationId}/dashboard`).then(setD).catch((e) => setError(errorMessage(e)));
    load();
    const id = setInterval(load, 60_000); // arrivals and online bookings show up during the day
    return () => clearInterval(id);
  }, [m.organizationId]);

  if (!d) return <p className="p-6 text-text-muted">{error ?? 'Chargement…'}</p>;
  const hour = Number(new Date().toLocaleString('fr-FR', { timeZone: 'Indian/Comoro', hour: '2-digit', hour12: false }));
  const tiles = [
    {
      icon: CalendarDays,
      label: 'Aujourd’hui',
      value: d.today.total,
      hint: [`${d.today.remaining} à venir`, `${d.today.done} terminé${d.today.done > 1 ? 's' : ''}`, d.today.toClose ? `${d.today.toClose} à clôturer` : null].filter(Boolean).join(' · '),
    },
    { icon: CalendarClock, label: '7 prochains jours', value: d.nextSevenDays, hint: 'rendez-vous prévus' },
    { icon: Users, label: '30 derniers jours', value: d.last30Days.appointments, hint: `${d.last30Days.online} pris en ligne` },
    { icon: UserX, label: 'Absences (30 j)', value: d.last30Days.noShows, hint: 'rendez-vous non honorés' },
  ];

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">
            {hour >= 18 ? 'Bonsoir' : 'Bonjour'} {m.displayName}
          </h1>
          <p className="text-sm text-text-muted first-letter:uppercase">{formatDateLong(new Date(`${d.date}T12:00:00Z`))}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/pro/app/patients" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
            <Search aria-hidden="true" size={16} /> Rechercher un patient
          </Link>
          <Link href="/pro/app/agenda" className={buttonClasses({ variant: 'primary', size: 'sm' })}>
            <CalendarDays aria-hidden="true" size={16} /> Ouvrir l’agenda
          </Link>
        </div>
      </div>

      <SetupChecklist />

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ icon: Icon, label, value, hint }) => (
          <li key={label}>
            <Card className="flex h-full flex-col gap-1 p-4">
              <p className="flex items-center gap-2 text-sm text-text">
                <Icon aria-hidden="true" size={16} className="text-primary" /> {label}
              </p>
              <p className="text-2xl font-bold text-ink">{value}</p>
              <p className="text-xs text-text-muted">{hint}</p>
            </Card>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="flex min-w-0 flex-col gap-3">
          <h2 className="font-heading text-base font-bold text-navy">Votre journée</h2>
          {d.today.items.length === 0 ? (
            <p className="text-sm text-text">Aucun rendez-vous aujourd’hui.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-border">
              {d.today.items.map((a) => {
                const isNext = a.id === d.nextAppointmentId;
                const st = STATUS[a.status] ?? { label: a.status, tone: 'info' as const };
                return (
                  <li key={a.id} className={cn('flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between', isNext && 'rounded-md bg-primary-soft px-3')}>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="w-12 shrink-0 font-bold text-ink tabular-nums">{formatTime(new Date(a.startsAt))}</span>
                      <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.color }} />
                      <div className="min-w-0">
                        <Link href={`/pro/app/patients/${a.patient.id}`} className="font-medium text-primary hover:underline">
                          {a.patient.name}
                        </Link>
                        <span className="text-sm text-text-muted">{a.patient.age !== null ? ` · ${a.patient.age} ans` : ''}</span>
                        <p className="text-sm text-text">{a.motive}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {isNext ? <Badge tone="info">Prochain patient</Badge> : null}
                          <Badge tone={st.tone}>{st.label}</Badge>
                          {a.toClose ? <Badge tone="warning">À clôturer</Badge> : null}
                          {a.confirmedByPatient ? <Badge tone="success">Présence confirmée</Badge> : null}
                          {a.patient.noShowCount ? <Badge tone="warning">{a.patient.noShowCount} absence{a.patient.noShowCount > 1 ? 's' : ''}</Badge> : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2 pl-15 sm:pl-0">
                      {clinician ? (
                        <Link href={`/pro/app/patients/${a.patient.id}`} className={buttonClasses({ variant: 'ghost', size: 'sm' })} aria-label={`Dossier de ${a.patient.name}`}>
                          <FileText aria-hidden="true" size={16} /> Dossier
                        </Link>
                      ) : null}
                      {clinician && ['CONFIRMED', 'ARRIVED', 'IN_CONSULTATION'].includes(a.status) ? (
                        <Link href={`/pro/app/consultation/${a.id}`} className={buttonClasses({ variant: isNext ? 'primary' : 'secondary', size: 'sm' })} aria-label={`Consultation de ${a.patient.name}`}>
                          <Stethoscope aria-hidden="true" size={16} /> Consultation
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <h2 className="font-heading text-base font-bold text-navy">Demandes à valider</h2>
            {d.pending.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-text">
                <CheckCircle2 aria-hidden="true" size={16} className="text-success" /> Rien en attente.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {d.pending.map((p) => (
                  <li key={p.id}>
                    <Link href={`/pro/app/agenda?rdv=${p.id}`} className="-mx-2 flex min-h-11 flex-col justify-center rounded-md px-2 py-1 hover:bg-background-soft" aria-label={`Répondre à la demande de ${p.patient.name}`}>
                      <span className="font-medium text-primary">{p.patient.name}</span>
                      <span className="text-text-muted first-letter:uppercase">
                        {formatDateLong(new Date(p.startsAt))} à {formatTime(new Date(p.startsAt))} · {p.motive}
                      </span>
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/pro/app/agenda" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    Voir l’agenda <ChevronRight aria-hidden="true" size={14} />
                  </Link>
                </li>
              </ul>
            )}
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="font-heading text-base font-bold text-navy">Patients vus récemment</h2>
            {d.recentPatients.length === 0 ? (
              <p className="text-sm text-text">Aucune consultation terminée pour l’instant.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {d.recentPatients.map((p) => (
                  <li key={p.id}>
                    <Link href={`/pro/app/patients/${p.id}`} className="flex min-h-11 items-center justify-between gap-2 rounded-md px-2 text-sm hover:bg-background-soft">
                      <span className="font-medium text-ink">
                        {p.name}
                        {p.age !== null ? <span className="font-normal text-text-muted"> · {p.age} ans</span> : null}
                      </span>
                      <span className="text-xs text-text-muted">{new Date(p.lastVisitAt).toLocaleDateString('fr-FR', { timeZone: 'Indian/Comoro', day: 'numeric', month: 'short' })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/pro/app/patients" className="text-sm font-medium text-primary hover:underline">
              Tous mes patients
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
