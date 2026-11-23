'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, FolderOpen, Globe, MessageSquare, Phone, Stethoscope, UserRound, X } from 'lucide-react';
import { Badge, Button, buttonClasses } from '@twabibu/ui';
import { formatDateLong, formatPhone, formatTime, toDateKey, zonedToUtc } from '@twabibu/utils';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { NEXT_STATUSES, SOURCE_LABEL, STATUS_LABEL, type AppointmentStatus, type ProAppointment } from '@/lib/pro-types';
import { useMembership } from './ProContext';
import { Drawer, fieldClass } from './Drawer';

const STATUS_ACTION: Partial<Record<AppointmentStatus, string>> = {
  CONFIRMED: 'Remettre en confirmé',
  ARRIVED: 'Patient arrivé',
  IN_CONSULTATION: 'En consultation',
  DONE: 'Terminé',
  NO_SHOW: 'Non honoré',
};

const EVENT_LABEL: Record<string, string> = { BOOKED: 'Rendez-vous pris', STATUS_CHANGED: 'Statut modifié', RESCHEDULED: 'Déplacé', CANCELLED: 'Annulé', REFUSED: 'Demande refusée', CONFIRMED_BY_PATIENT: 'Présence confirmée par le patient' };
const MESSAGE_LABEL: Record<string, string> = {
  'appointment.booked': 'confirmation',
  'appointment.pending': 'demande',
  'appointment.accepted': 'demande acceptée',
  'appointment.refused': 'demande refusée',
  'appointment.rescheduled': 'déplacement',
  'appointment.cancelled_by_practice': 'annulation',
  'appointment.cancelled_by_patient': 'annulation',
  'appointment.reminder': 'rappel',
};

function age(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const b = new Date(`${birthDate}T00:00:00Z`);
  const now = new Date();
  let years = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) years--;
  return `${years} an${years > 1 ? 's' : ''}`;
}

/** Appointment details: patient, status buttons, move, cancel, history. */
export function AppointmentDrawer({ appointment, onClose, onChanged }: { appointment: ProAppointment; onClose: () => void; onChanged: () => void }) {
  const membership = useMembership();
  const base = `/v1/pro/orgs/${membership.organizationId}/appointments/${appointment.id}`;
  const start = new Date(appointment.startsAt);
  const [date, setDate] = useState(toDateKey(start));
  const [time, setTime] = useState(formatTime(start));
  const [notes, setNotes] = useState(appointment.notes ?? '');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ events: { type: string; at: string }[]; notifications: { template: string; channel: string; status: string; createdAt: string }[] } | null>(null);
  const pending = appointment.status === 'PENDING_VALIDATION';
  // A pending request is answered (accept / refuse), not cancelled.
  const cancellable = ['CONFIRMED', 'ARRIVED'].includes(appointment.status);
  const [refusing, setRefusing] = useState(false);

  useEffect(() => {
    api<typeof history>(`${base}/history`).then(setHistory).catch(() => setHistory(null));
  }, [base]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'SLOT_UNAVAILABLE' ? 'Ce créneau est déjà occupé.' : err instanceof ApiError && err.code === 'CONFLICT' ? 'Action impossible pour ce rendez-vous (absence ou statut).' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const moved = date !== toDateKey(start) || time !== formatTime(start);
  const p = appointment.patient;

  return (
    <Drawer title={`${p.firstName} ${p.lastName}`} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={appointment.status === 'NO_SHOW' || appointment.status === 'PENDING_VALIDATION' ? 'warning' : appointment.status === 'CONFIRMED' ? 'info' : 'success'}>{STATUS_LABEL[appointment.status]}</Badge>
          <Badge>{SOURCE_LABEL[appointment.source]}</Badge>
          {appointment.allowOverlap ? <Badge tone="warning">Surbooking</Badge> : null}
          {appointment.confirmedByPatientAt ? <Badge tone="success">Présence confirmée</Badge> : null}
        </div>

        <ul className="grid gap-2 text-sm text-text">
          <li>
            <span className="font-medium text-ink first-letter:uppercase">
              {formatDateLong(start)} · {formatTime(start)} – {formatTime(new Date(appointment.endsAt))}
            </span>
          </li>
          <li>{appointment.motive.name}</li>
          <li className="flex items-center gap-2">
            <UserRound aria-hidden="true" size={16} className="text-text-muted" />
            {[age(p.birthDate), p.hasAccount ? 'compte Twabibu' : 'sans compte Twabibu', p.noShowCount ? `${p.noShowCount} absence${p.noShowCount > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ')}
          </li>
          {p.phone ? (
            <li className="flex items-center gap-2">
              <Phone aria-hidden="true" size={16} className="text-text-muted" />
              <a href={`tel:${p.phone}`} className="text-primary underline">
                {formatPhone(p.phone)}
              </a>
            </li>
          ) : null}
          {appointment.patientMessage ? (
            <li className="flex gap-2 rounded-md bg-background-soft p-3">
              <MessageSquare aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-text-muted" />
              <span>
                <span className="block text-xs font-medium text-text-muted">Message du patient</span>
                {appointment.patientMessage}
              </span>
            </li>
          ) : null}
        </ul>

        {membership.practitionerId ? (
          <div className="flex flex-wrap gap-2">
            {['CONFIRMED', 'ARRIVED', 'IN_CONSULTATION'].includes(appointment.status) ? (
              <Link href={`/pro/app/consultation/${appointment.id}`} className={buttonClasses({ variant: 'primary', size: 'sm' })}>
                <Stethoscope aria-hidden="true" size={14} /> Ouvrir la consultation
              </Link>
            ) : null}
            <Link href={`/pro/app/patients/${p.id}`} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              <FolderOpen aria-hidden="true" size={14} /> Dossier du patient
            </Link>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {pending ? (
          <section aria-labelledby="request-title" className="flex flex-col gap-3 rounded-md border border-warning bg-warning-soft p-3">
            <h3 id="request-title" className="flex items-center gap-2 text-sm font-bold text-ink">
              <Globe aria-hidden="true" size={16} /> Demande en ligne à valider
            </h3>
            <p className="text-sm text-text">Le patient attend votre réponse. Il la reçoit par e-mail, ou par SMS s’il n’a pas d’e-mail.</p>
            {refusing ? (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                  Motif du refus (facultatif, non envoyé au patient)
                  <input value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass} />
                </label>
                <label className="flex gap-2 text-sm text-text">
                  <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                  Prévenir le patient et l’inviter à choisir un autre créneau
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="danger" size="sm" disabled={busy} onClick={() => run(() => api(`${base}/cancel`, { method: 'POST', body: { reason: reason.trim() || undefined, notifyPatient: notify } }))}>
                    Confirmer le refus
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setRefusing(false)}>
                    Retour
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => run(() => api(base, { method: 'PATCH', body: { status: 'CONFIRMED' } }))}>
                  <Check aria-hidden="true" size={16} /> Accepter la demande
                </Button>
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => setRefusing(true)}>
                  <X aria-hidden="true" size={16} /> Refuser
                </Button>
              </div>
            )}
          </section>
        ) : null}

        {!pending && (NEXT_STATUSES[appointment.status] ?? []).length ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">Statut</h3>
            <div className="flex flex-wrap gap-2">
              {/* « Non honoré » only once the time has passed: it counts against the patient (SPEC-05 §Règles 4). */}
              {(NEXT_STATUSES[appointment.status] ?? []).filter((s) => s !== 'NO_SHOW' || new Date(appointment.startsAt) <= new Date()).map((s) => (
                <Button key={s} variant={s === 'NO_SHOW' ? 'secondary' : 'ghost'} size="sm" disabled={busy} onClick={() => run(() => api(base, { method: 'PATCH', body: { status: s } }))} className="border border-border">
                  {STATUS_ACTION[s]}
                </Button>
              ))}
            </div>
          </section>
        ) : null}

        {cancellable ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold">Déplacer</h3>
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="Nouvelle date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
              <input aria-label="Nouvelle heure" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} className={fieldClass} />
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="self-start"
              disabled={!moved || busy}
              onClick={() => {
                const [h, m] = time.split(':').map(Number) as [number, number];
                void run(() => api(base, { method: 'PATCH', body: { startsAt: zonedToUtc(date, h * 60 + m).toISOString(), notifyPatient: true } }));
              }}
            >
              Déplacer et prévenir le patient
            </Button>
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">Note interne</h3>
          <textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-md border border-border p-3 text-sm focus:border-primary focus:outline-2 focus:outline-primary/30" />
          <Button variant="ghost" size="sm" className="self-start" disabled={busy || notes === (appointment.notes ?? '')} onClick={() => run(() => api(base, { method: 'PATCH', body: { notes: notes.trim() || null } }))}>
            Enregistrer la note
          </Button>
        </section>

        {cancellable ? (
          <section className="flex flex-col gap-2 border-t border-border pt-4">
            {cancelling ? (
              <div className="flex flex-col gap-3 rounded-md bg-danger-soft p-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                  Motif d’annulation (facultatif, non envoyé au patient)
                  <input value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass} />
                </label>
                <label className="flex gap-2 text-sm text-text">
                  <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                  Prévenir le patient (e-mail, ou SMS sans e-mail)
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="danger" size="sm" disabled={busy} onClick={() => run(() => api(`${base}/cancel`, { method: 'POST', body: { reason: reason.trim() || undefined, notifyPatient: notify } }))}>
                    Confirmer l’annulation
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setCancelling(false)}>
                    Ne pas annuler
                  </Button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setCancelling(true)} className="self-start text-sm font-medium text-danger hover:underline">
                Annuler le rendez-vous
              </button>
            )}
          </section>
        ) : null}

        {history ? (
          <section className="flex flex-col gap-2 border-t border-border pt-4">
            <h3 className="text-sm font-bold">Historique</h3>
            <ol className="grid gap-1.5 text-xs text-text">
              {[
                ...history.events.map((e) => ({ at: e.at, label: EVENT_LABEL[e.type] ?? e.type })),
                ...history.notifications.map((n) => ({ at: n.createdAt, label: `${n.channel === 'EMAIL' ? 'E-mail' : 'SMS'} de ${MESSAGE_LABEL[n.template] ?? n.template} (${n.status === 'SENT' ? 'envoyé' : n.status === 'FAILED' ? 'échec' : 'en attente'})` })),
              ]
                .sort((a, b) => a.at.localeCompare(b.at))
                .map((e, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{e.label}</span>
                    <span className="shrink-0 text-text-muted tabular-nums">
                      {new Date(e.at).toLocaleDateString('fr-FR', { timeZone: 'Indian/Comoro', day: '2-digit', month: '2-digit' })} {formatTime(new Date(e.at))}
                    </span>
                  </li>
                ))}
            </ol>
          </section>
        ) : null}
      </div>
    </Drawer>
  );
}
