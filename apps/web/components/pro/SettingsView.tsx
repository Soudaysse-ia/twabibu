'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, cn } from '@twabibu/ui';
import { formatDateLong, formatKmf, formatTime, toDateKey, zonedToUtc } from '@twabibu/utils';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import type { AgendaSettings, ProAgenda } from '@/lib/pro-types';
import { fieldClass } from './Drawer';
import { useMembership } from './ProContext';
import { ReminderSettings } from './ReminderSettings';

const WEEKDAYS = [
  [1, 'Lundi'], [2, 'Mardi'], [3, 'Mercredi'], [4, 'Jeudi'], [5, 'Vendredi'], [6, 'Samedi'], [0, 'Dimanche'],
] as const;
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (v: string) => {
  const [h, m] = v.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

type Motive = AgendaSettings['motives'][number];
type Rule = { weekday: number; start: string; end: string; motiveIds: string[] };

function Section({ id, title, description, children }: { id?: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="flex scroll-mt-20 flex-col gap-4">
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        {description ? <p className="text-sm text-text-muted">{description}</p> : null}
      </div>
      {children}
    </Card>
  );
}

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn('flex items-center justify-between gap-4 text-sm text-ink', disabled && 'opacity-60')}>
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-border')}
      >
        <span className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

function MotiveEditor({ motive, onSave, onCancel, disabled }: { motive: Partial<Motive>; onSave: (m: Partial<Motive>) => Promise<void>; onCancel: () => void; disabled: boolean }) {
  const [m, setM] = useState<Partial<Motive>>({ durationMinutes: 20, isOnline: true, newPatientsAllowed: true, isActive: true, cancellationDeadlineHours: 24, ...motive });
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-3 rounded-md border border-primary/40 bg-background-soft p-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-ink sm:col-span-2">
        Nom du motif
        <input value={m.name ?? ''} onChange={(e) => setM({ ...m, name: e.target.value })} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-ink">
        Durée (minutes)
        <input type="number" min={5} max={480} step={5} value={m.durationMinutes ?? ''} onChange={(e) => setM({ ...m, durationMinutes: Number(e.target.value) })} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-ink">
        Tarif (KMF, facultatif)
        <input type="number" min={0} step={500} value={m.priceKmf ?? ''} onChange={(e) => setM({ ...m, priceKmf: e.target.value === '' ? null : Number(e.target.value) })} className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-ink">
        Annulation en ligne jusqu’à (heures avant)
        <input type="number" min={0} max={336} value={m.cancellationDeadlineHours ?? 24} onChange={(e) => setM({ ...m, cancellationDeadlineHours: Number(e.target.value) })} className={fieldClass} />
      </label>
      <div className="flex flex-col justify-end gap-2">
        <Toggle label="Réservable en ligne" checked={!!m.isOnline} onChange={(v) => setM({ ...m, isOnline: v })} />
        <Toggle label="Ouvert aux nouveaux patients" checked={!!m.newPatientsAllowed} onChange={(v) => setM({ ...m, newPatientsAllowed: v })} />
        <Toggle label="Actif" checked={m.isActive !== false} onChange={(v) => setM({ ...m, isActive: v })} />
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-ink sm:col-span-2">
        Consignes affichées au patient
        <textarea rows={2} maxLength={1000} value={m.instructions ?? ''} onChange={(e) => setM({ ...m, instructions: e.target.value })} className="rounded-md border border-border bg-surface p-3 text-sm focus:border-primary focus:outline-2 focus:outline-primary/30" />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button
          size="sm"
          disabled={disabled || busy || !m.name || (m.name?.trim().length ?? 0) < 2 || !m.durationMinutes}
          onClick={async () => {
            setBusy(true);
            await onSave({ ...m, name: m.name?.trim(), instructions: m.instructions?.trim() || null });
            setBusy(false);
          }}
        >
          Enregistrer
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

/** Agenda settings (SPEC-05 §Paramètres) for one agenda at a time. */
export function SettingsView() {
  const membership = useMembership();
  const org = membership.organizationId;
  const [agendas, setAgendas] = useState<ProAgenda[]>([]);
  const [agendaId, setAgendaId] = useState<string>('');
  const [s, setS] = useState<AgendaSettings | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [absences, setAbsences] = useState<{ id: string; startsAt: string; endsAt: string; reason: string | null }[]>([]);
  const [absence, setAbsence] = useState({ fromDate: '', fromTime: '08:00', toDate: '', toTime: '18:00', reason: '' });
  const [impacted, setImpacted] = useState<{ id: string; startsAt: string; patient: string; hasPhone: boolean }[] | null>(null);
  const base = `/v1/pro/orgs/${org}/agendas/${agendaId}`;

  useEffect(() => {
    api<ProAgenda[]>(`/v1/pro/orgs/${org}/agendas`).then((list) => {
      setAgendas(list);
      setAgendaId((list.find((a) => a.mine) ?? list[0])?.id ?? '');
    });
  }, [org]);

  const load = useCallback(async () => {
    if (!agendaId) return;
    const [settings, abs] = await Promise.all([api<AgendaSettings>(`${base}/settings`), api<typeof absences>(`${base}/absences`)]);
    setS(settings);
    setRules(settings.rules.map((r) => ({ weekday: r.weekday, start: toHHMM(r.startMinutes), end: toHHMM(r.endMinutes), motiveIds: r.motiveIds })));
    setAbsences(abs);
  }, [agendaId, base]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save<T>(fn: () => Promise<T>, ok: string) {
    setMessage(null);
    try {
      await fn();
      setMessage({ tone: 'ok', text: ok });
      await load();
      return true;
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiError && err.code === 'VALIDATION_FAILED' ? `Vérifiez les valeurs saisies. ${err.message === 'Two windows overlap on the same day' ? 'Deux plages se chevauchent le même jour.' : ''}` : errorMessage(err) });
      return false;
    }
  }

  if (!s) return <p className="p-6 text-text-muted">Chargement…</p>;
  const ro = !s.canEdit;
  const a = s.agenda;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Réglages de l’agenda</h1>
          <p className="text-sm text-text-muted">Ces réglages s’appliquent immédiatement aux réservations en ligne.</p>
        </div>
        {agendas.length > 1 ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-ink">
            Agenda
            <select value={agendaId} onChange={(e) => setAgendaId(e.target.value)} className={cn(fieldClass, 'min-w-56')}>
              {agendas.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.practitioner.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {ro ? <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-ink">Lecture seule : seul le praticien ou la direction peut modifier cet agenda.</p> : null}
      {message ? (
        <p role="status" className={cn('rounded-md px-3 py-2 text-sm', message.tone === 'ok' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
          {message.text}
        </p>
      ) : null}

      <Section title="Réservation en ligne" description="Ce que les patients peuvent réserver eux-mêmes sur Twabibu.">
        <div className="grid gap-3 sm:max-w-xl">
          <Toggle disabled={ro} label="Réservation en ligne ouverte" checked={a.onlineBookingEnabled} onChange={(v) => save(() => api(base, { method: 'PATCH', body: { onlineBookingEnabled: v } }), v ? 'Réservation en ligne ouverte.' : 'Réservation en ligne fermée.')} />
          <Toggle disabled={ro} label="Valider chaque demande avant confirmation" checked={a.requiresValidation} onChange={(v) => save(() => api(base, { method: 'PATCH', body: { requiresValidation: v } }), 'Réglage enregistré.')} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-ink">
              Délai minimum avant un rendez-vous
              <select disabled={ro} value={a.minNoticeMinutes} onChange={(e) => save(() => api(base, { method: 'PATCH', body: { minNoticeMinutes: Number(e.target.value) } }), 'Délai enregistré.')} className={fieldClass}>
                {[0, 60, 120, 240, 720, 1440, 2880].map((v) => (
                  <option key={v} value={v}>
                    {v === 0 ? 'Aucun' : v < 1440 ? `${v / 60} h` : `${v / 1440} jour${v > 1440 ? 's' : ''}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink">
              Réservable jusqu’à
              <select disabled={ro} value={a.bookingHorizonDays} onChange={(e) => save(() => api(base, { method: 'PATCH', body: { bookingHorizonDays: Number(e.target.value) } }), 'Horizon enregistré.')} className={fieldClass}>
                {[7, 14, 30, 60, 90, 180].map((v) => (
                  <option key={v} value={v}>
                    {v} jours à l’avance
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink">
              Pas entre deux créneaux
              <select disabled={ro} value={a.slotStepMinutes} onChange={(e) => save(() => api(base, { method: 'PATCH', body: { slotStepMinutes: Number(e.target.value) } }), 'Pas enregistré.')} className={fieldClass}>
                {[5, 10, 15, 20, 30].map((v) => (
                  <option key={v} value={v}>
                    {v} minutes
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink">
              Rendez-vous à venir par patient
              <select disabled={ro} value={a.maxActiveAppointmentsPerPatient} onChange={(e) => save(() => api(base, { method: 'PATCH', body: { maxActiveAppointmentsPerPatient: Number(e.target.value) } }), 'Limite enregistrée.')} className={fieldClass}>
                {[1, 2, 3, 5].map((v) => (
                  <option key={v} value={v}>
                    {v} maximum
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </Section>

      <Section id="motifs" title="Motifs de consultation" description="Durée, tarif et consignes de chaque type de rendez-vous.">
        <ul className="flex flex-col gap-2">
          {s.motives.map((m) =>
            editing === m.id ? (
              <li key={m.id}>
                <MotiveEditor
                  motive={m}
                  disabled={ro}
                  onCancel={() => setEditing(null)}
                  onSave={async (v) => {
                    const { id: _id, sortOrder: _s, color: _c, ...body } = v as Motive;
                    if (await save(() => api(`${base}/motives/${m.id}`, { method: 'PATCH', body }), 'Motif enregistré.')) setEditing(null);
                  }}
                />
              </li>
            ) : (
              <li key={m.id} className={cn('flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-4 py-3', !m.isActive && 'opacity-60')}>
                <div className="min-w-0">
                  <p className="font-medium text-ink">{m.name}</p>
                  <p className="text-xs text-text-muted">
                    {m.durationMinutes} min{m.priceKmf !== null ? ` · ${formatKmf(m.priceKmf)}` : ''} · annulation jusqu’à {m.cancellationDeadlineHours} h avant
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {m.isOnline ? <Badge tone="success">En ligne</Badge> : <Badge>Cabinet seulement</Badge>}
                  {!m.newPatientsAllowed ? <Badge tone="warning">Patients suivis</Badge> : null}
                  {!m.isActive ? <Badge>Inactif</Badge> : null}
                  {!ro ? (
                    <Button variant="ghost" size="sm" onClick={() => setEditing(m.id)}>
                      Modifier
                    </Button>
                  ) : null}
                </div>
              </li>
            ),
          )}
          {editing === 'new' ? (
            <li>
              <MotiveEditor
                motive={{}}
                disabled={ro}
                onCancel={() => setEditing(null)}
                onSave={async (v) => {
                  if (await save(() => api(`${base}/motives`, { method: 'POST', body: v }), 'Motif ajouté.')) setEditing(null);
                }}
              />
            </li>
          ) : null}
        </ul>
        {!ro && editing !== 'new' ? (
          <Button variant="secondary" size="sm" className="self-start" onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" size={14} /> Ajouter un motif
          </Button>
        ) : null}
      </Section>

      <Section id="plages" title="Plages réservables en ligne" description="Horaires de la semaine pendant lesquels les patients peuvent réserver. En dehors, seul le cabinet ajoute des rendez-vous.">
        <div className="flex flex-col divide-y divide-border">
          {WEEKDAYS.map(([wd, label]) => {
            const dayRules = rules.map((r, i) => ({ r, i })).filter(({ r }) => r.weekday === wd);
            return (
              <div key={wd} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
                <p className="w-28 shrink-0 pt-2 text-sm font-medium text-ink">{label}</p>
                <div className="flex flex-1 flex-col gap-2">
                  {dayRules.length === 0 ? <p className="pt-2 text-sm text-text-muted">Fermé en ligne</p> : null}
                  {dayRules.map(({ r, i }) => (
                    <div key={i} className="flex items-center gap-2">
                      <input aria-label={`${label}, début`} type="time" step={300} disabled={ro} value={r.start} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className={cn(fieldClass, 'w-32')} />
                      <span className="text-text-muted">à</span>
                      <input aria-label={`${label}, fin`} type="time" step={300} disabled={ro} value={r.end} onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className={cn(fieldClass, 'w-32')} />
                      {!ro ? (
                        <button type="button" aria-label={`Supprimer la plage du ${label.toLowerCase()}`} onClick={() => setRules(rules.filter((_, j) => j !== i))} className="rounded-md p-2 text-text-muted hover:bg-danger-soft hover:text-danger">
                          <Trash2 aria-hidden="true" size={16} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {!ro ? (
                    <button type="button" onClick={() => setRules([...rules, { weekday: wd, start: dayRules.length ? '14:00' : '08:00', end: dayRules.length ? '17:00' : '12:00', motiveIds: [] }])} className="self-start text-sm font-medium text-primary hover:underline">
                      + Ajouter une plage
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {!ro ? (
          <Button
            className="self-start"
            onClick={() =>
              save(
                () => api(`${base}/availability-rules`, { method: 'PUT', body: { rules: rules.map((r) => ({ weekday: r.weekday, startMinutes: toMin(r.start), endMinutes: toMin(r.end), motiveIds: r.motiveIds })) } }),
                'Plages enregistrées. Les créneaux en ligne sont à jour.',
              )
            }
          >
            Enregistrer les plages
          </Button>
        ) : null}
      </Section>

      <Section title="Absences et congés" description="Bloque l’agenda. Les rendez-vous déjà pris sur la période vous sont montrés avant d’enregistrer.">
        {absences.length ? (
          <ul className="flex flex-col gap-2">
            {absences.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-ink">
                  <CalendarOff aria-hidden="true" size={16} className="text-text-muted" />
                  <span className="first-letter:uppercase">
                    {formatDateLong(new Date(x.startsAt))} {formatTime(new Date(x.startsAt))} → {toDateKey(new Date(x.endsAt)) === toDateKey(new Date(x.startsAt)) ? '' : `${formatDateLong(new Date(x.endsAt))} `}
                    {formatTime(new Date(x.endsAt))}
                  </span>
                  {x.reason ? <span className="text-text-muted">· {x.reason}</span> : null}
                </span>
                {!ro ? (
                  <button type="button" onClick={() => save(() => api(`${base}/absences/${x.id}`, { method: 'DELETE' }), 'Absence supprimée.')} className="text-sm text-danger hover:underline">
                    Supprimer
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">Aucune absence à venir.</p>
        )}
        {!ro ? (
          <div className="flex flex-col gap-3 rounded-md border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                Du
                <input type="date" value={absence.fromDate} onChange={(e) => { setAbsence({ ...absence, fromDate: e.target.value, toDate: absence.toDate || e.target.value }); setImpacted(null); }} className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                à
                <input type="time" step={300} value={absence.fromTime} onChange={(e) => { setAbsence({ ...absence, fromTime: e.target.value }); setImpacted(null); }} className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                Au
                <input type="date" value={absence.toDate} onChange={(e) => { setAbsence({ ...absence, toDate: e.target.value }); setImpacted(null); }} className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-ink">
                à
                <input type="time" step={300} value={absence.toTime} onChange={(e) => { setAbsence({ ...absence, toTime: e.target.value }); setImpacted(null); }} className={fieldClass} />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink">
              Motif (visible par l’équipe uniquement)
              <input value={absence.reason} onChange={(e) => setAbsence({ ...absence, reason: e.target.value })} placeholder="Congés, formation…" className={fieldClass} />
            </label>
            {impacted === null ? (
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                disabled={!absence.fromDate || !absence.toDate}
                onClick={async () => {
                  try {
                    setImpacted(
                      await api(`${base}/absences/preview`, {
                        method: 'POST',
                        body: { startsAt: zonedToUtc(absence.fromDate, toMin(absence.fromTime)).toISOString(), endsAt: zonedToUtc(absence.toDate, toMin(absence.toTime)).toISOString() },
                      }),
                    );
                  } catch (err) {
                    setMessage({ tone: 'error', text: errorMessage(err) });
                  }
                }}
              >
                Vérifier les rendez-vous concernés
              </Button>
            ) : (
              <div className="flex flex-col gap-3">
                {impacted.length ? (
                  <>
                    <p className="text-sm font-medium text-ink">
                      {impacted.length} rendez-vous sur cette période :
                    </p>
                    <ul className="grid gap-1 text-sm text-text">
                      {impacted.map((i) => (
                        <li key={i.id}>
                          {formatDateLong(new Date(i.startsAt))} à {formatTime(new Date(i.startsAt))} · {i.patient}
                          {!i.hasPhone ? <span className="text-warning"> (sans e-mail ni téléphone, à prévenir vous-même)</span> : null}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-text">Aucun rendez-vous sur cette période.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {impacted.length ? (
                    <Button
                      size="sm"
                      onClick={async () => {
                        const ok = await save(
                          () => api(`${base}/absences`, { method: 'POST', body: { startsAt: zonedToUtc(absence.fromDate, toMin(absence.fromTime)).toISOString(), endsAt: zonedToUtc(absence.toDate, toMin(absence.toTime)).toISOString(), reason: absence.reason || undefined, impacted: 'CANCEL_AND_NOTIFY' } }),
                          `Absence enregistrée. ${impacted.length} rendez-vous annulé${impacted.length > 1 ? 's' : ''}, patients prévenus.`,
                        );
                        if (ok) setImpacted(null);
                      }}
                    >
                      Enregistrer et annuler ces rendez-vous
                    </Button>
                  ) : null}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      const ok = await save(
                        () => api(`${base}/absences`, { method: 'POST', body: { startsAt: zonedToUtc(absence.fromDate, toMin(absence.fromTime)).toISOString(), endsAt: zonedToUtc(absence.toDate, toMin(absence.toTime)).toISOString(), reason: absence.reason || undefined, impacted: 'KEEP' } }),
                        'Absence enregistrée.',
                      );
                      if (ok) setImpacted(null);
                    }}
                  >
                    {impacted.length ? 'Enregistrer en gardant les rendez-vous' : 'Enregistrer l’absence'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Section>

      <ReminderSettings />
    </div>
  );
}
