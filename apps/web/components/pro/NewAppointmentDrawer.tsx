'use client';

import { useEffect, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Button, cn } from '@twabibu/ui';
import { formatPhone, formatTime, toDateKey, zonedToUtc } from '@twabibu/utils';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import type { PatientHit, ProAgenda, ProAppointment } from '@/lib/pro-types';
import { canOverbook, useMembership } from './ProContext';
import { Drawer, fieldClass } from './Drawer';

export interface NewAppointmentDraft {
  agendaId: string;
  startsAt: Date;
}

/** Booking by the practice (phone, walk-in): patient search or quick creation, motive, time, confirmation. */
export function NewAppointmentDrawer({ agendas, draft, onClose, onCreated }: { agendas: ProAgenda[]; draft: NewAppointmentDraft; onClose: () => void; onCreated: (a: ProAppointment) => void }) {
  const membership = useMembership();
  const [agendaId, setAgendaId] = useState(draft.agendaId);
  const agenda = agendas.find((a) => a.id === agendaId) ?? agendas[0]!;
  const [motiveId, setMotiveId] = useState(agenda.motives[0]?.id ?? '');
  const [date, setDate] = useState(toDateKey(draft.startsAt));
  const [time, setTime] = useState(formatTime(draft.startsAt));
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PatientHit[]>([]);
  const [patient, setPatient] = useState<PatientHit | null>(null);
  const [creating, setCreating] = useState(false);
  const [newPatient, setNewPatient] = useState({ firstName: '', lastName: '', email: '', phone: '', birthDate: '' });
  const [source, setSource] = useState<'PHONE' | 'WALK_IN'>('PHONE');
  const [notes, setNotes] = useState('');
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!agenda.motives.some((m) => m.id === motiveId)) setMotiveId(agenda.motives[0]?.id ?? '');
  }, [agenda, motiveId]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setHits(await api<PatientHit[]>(`/v1/pro/orgs/${membership.organizationId}/patients?q=${encodeURIComponent(query)}`));
      } catch {
        setHits([]);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, membership.organizationId]);

  async function submit(force = false) {
    setError(null);
    if (!patient && !creating) return setError('Choisissez un patient ou créez sa fiche.');
    if (creating && (!newPatient.firstName.trim() || !newPatient.lastName.trim())) return setError('Le prénom et le nom du patient sont obligatoires.');
    if (!/^\d{2}:\d{2}$/.test(time)) return setError('Indiquez une heure au format 09:30.');
    const [h, m] = time.split(':').map(Number) as [number, number];
    setBusy(true);
    try {
      const created = await api<ProAppointment>(`/v1/pro/orgs/${membership.organizationId}/appointments`, {
        method: 'POST',
        body: {
          agendaId,
          motiveId,
          startsAt: zonedToUtc(date, h * 60 + m).toISOString(),
          source,
          notes: notes.trim() || undefined,
          notifyPatient: notify,
          force,
          ...(patient ? { patientRecordId: patient.id } : { newPatient: { ...newPatient, email: newPatient.email || undefined, phone: newPatient.phone || undefined, birthDate: newPatient.birthDate || undefined } }),
        },
      });
      onCreated(created);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SLOT_UNAVAILABLE') {
        const who = (err.details as { with?: string } | undefined)?.with;
        setConflict(`Ce créneau est déjà occupé${who ? ` par ${who}` : ''}.`);
      } else if (err instanceof ApiError && err.code === 'CONFLICT') {
        setConflict('Le soignant est absent à cette heure.');
      } else if (err instanceof ApiError && err.code === 'VALIDATION_FAILED') {
        setError('Vérifiez l’adresse e-mail, le téléphone et la date de naissance.');
      } else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer title="Nouveau rendez-vous" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {agendas.length > 1 ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Agenda
            <select value={agendaId} onChange={(e) => setAgendaId(e.target.value)} className={fieldClass}>
              {agendas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.practitioner.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-ink">Patient</legend>
          {patient ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-primary bg-primary-soft px-3 py-2.5">
              <span className="text-sm text-ink">
                <strong className="font-medium">
                  {patient.firstName} {patient.lastName}
                </strong>
                {patient.phone ? ` · ${formatPhone(patient.phone)}` : ''}
              </span>
              <button type="button" onClick={() => setPatient(null)} className="text-sm text-primary underline">
                Changer
              </button>
            </div>
          ) : creating ? (
            <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                Prénom
                <input value={newPatient.firstName} onChange={(e) => setNewPatient({ ...newPatient, firstName: e.target.value })} className={fieldClass} autoFocus />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                Nom
                <input value={newPatient.lastName} onChange={(e) => setNewPatient({ ...newPatient, lastName: e.target.value })} className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-ink sm:col-span-2">
                E-mail (pour la confirmation)
                <input type="email" inputMode="email" autoCapitalize="none" placeholder="patient@exemple.com" value={newPatient.email} onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })} className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                Téléphone
                <input type="tel" inputMode="tel" placeholder="321 12 34" value={newPatient.phone} onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })} className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                Date de naissance
                <input type="date" value={newPatient.birthDate} onChange={(e) => setNewPatient({ ...newPatient, birthDate: e.target.value })} className={fieldClass} />
              </label>
              <button type="button" onClick={() => setCreating(false)} className="text-left text-sm text-primary underline sm:col-span-2">
                Chercher un patient existant
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search aria-hidden="true" size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" />
                <input
                  aria-label="Rechercher un patient par nom ou téléphone"
                  placeholder="Nom ou 4 derniers chiffres du téléphone"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={cn(fieldClass, 'pl-9')}
                  autoFocus
                />
              </div>
              {hits.length ? (
                <ul className="max-h-56 overflow-y-auto rounded-md border border-border">
                  {hits.map((h) => (
                    <li key={h.id} className="border-b border-border last:border-b-0">
                      <button type="button" onClick={() => setPatient(h)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-primary-soft">
                        <span className="text-ink">
                          {h.firstName} {h.lastName}
                          {h.isBlocked ? <span className="ml-2 text-xs text-danger">bloqué</span> : null}
                        </span>
                        <span className="text-xs text-text-muted">{h.phone ? formatPhone(h.phone) : h.birthDate ?? ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : query.trim().length >= 2 ? (
                <p className="text-sm text-text-muted">Aucun patient trouvé.</p>
              ) : null}
              <button type="button" onClick={() => setCreating(true)} className="inline-flex items-center gap-2 self-start text-sm font-medium text-primary hover:underline">
                <UserPlus aria-hidden="true" size={16} /> Nouveau patient
              </button>
            </>
          )}
        </fieldset>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Motif
          <select value={motiveId} onChange={(e) => setMotiveId(e.target.value)} className={fieldClass}>
            {agenda.motives.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.durationMinutes} min)
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Heure
            <input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} className={fieldClass} />
          </label>
        </div>

        <fieldset className="flex gap-2">
          <legend className="mb-1.5 text-sm font-medium text-ink">Pris</legend>
          {(
            [
              ['PHONE', 'Par téléphone'],
              ['WALK_IN', 'Sur place'],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className={cn('flex h-10 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm', source === v ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text')}>
              <input type="radio" className="sr-only" checked={source === v} onChange={() => setSource(v)} />
              {l}
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Note interne (facultatif)
          <textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-md border border-border p-3 text-sm focus:border-primary focus:outline-2 focus:outline-primary/30" />
        </label>

        <label className="flex gap-3 text-sm text-text">
          <input type="checkbox" className="mt-1 size-4 accent-primary" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          Envoyer une confirmation au patient (par e-mail, ou par SMS s’il n’a pas d’e-mail)
        </label>

        {error ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {conflict ? (
          <div role="alert" className="flex flex-col gap-2 rounded-md bg-warning-soft px-3 py-3 text-sm text-ink">
            <p>{conflict}</p>
            {canOverbook(membership) ? (
              <Button variant="secondary" size="sm" onClick={() => submit(true)} disabled={busy} className="self-start">
                Enregistrer quand même
              </Button>
            ) : (
              <p className="text-text-muted">Choisissez une autre heure, ou demandez au praticien.</p>
            )}
          </div>
        ) : null}

        <Button size="lg" fullWidth onClick={() => submit(false)} disabled={busy || !motiveId}>
          {busy ? 'Enregistrement…' : 'Enregistrer le rendez-vous'}
        </Button>
      </div>
    </Drawer>
  );
}
