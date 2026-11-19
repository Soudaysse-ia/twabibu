'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, FileText, Lock, Pill, Plus, Stethoscope, Syringe } from 'lucide-react';
import { Badge, Button, Card, CardTitle, cn } from '@twabibu/ui';
import { formatDateLong, formatPhone } from '@twabibu/utils';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { ageOf, HISTORY_LABEL, VITALS, type ConsultationDetail, type RecordSynthesis } from '@/lib/medical-types';
import type { ProPatientOverview } from '@/lib/pro-types';
import { fieldClass } from './Drawer';
import { PatientAppointments } from './PatientAppointments';
import { useMembership } from './ProContext';

type Form = 'allergy' | 'history' | 'treatment' | 'vaccination' | null;

/** Full medical record of one patient, for practitioners (SPEC-13). Secretaries see contact and appointments only. */
export function PatientFileView({ recordId }: { recordId: string }) {
  const m = useMembership();
  const base = `/v1/pro/orgs/${m.organizationId}/patients/${recordId}/record`;
  const [s, setS] = useState<RecordSynthesis | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [opened, setOpened] = useState<ConsultationDetail | null>(null);
  const [overview, setOverview] = useState<ProPatientOverview | null>(null);

  const load = useCallback(async () => {
    try {
      setS(await api<RecordSynthesis>(base));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setForbidden(true);
      else setError(errorMessage(err));
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  // Administrative side (contact, appointments): for the whole team, never logged as a medical read.
  useEffect(() => {
    api<ProPatientOverview>(`/v1/pro/orgs/${m.organizationId}/patients/${recordId}`)
      .then(setOverview)
      .catch(() => undefined);
  }, [m.organizationId, recordId]);

  async function submit(path: string, body: unknown) {
    setError(null);
    try {
      setS(await api<RecordSynthesis>(`${base}${path}`, { method: 'POST', body }));
      setForm(null);
      setValues({});
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'VALIDATION_FAILED' ? 'Vérifiez les champs saisis.' : errorMessage(err));
    }
  }

  const v = (k: string) => values[k] ?? '';
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValues({ ...values, [k]: e.target.value });

  if (forbidden)
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <Link href="/pro/app/patients" className="inline-flex items-center gap-1.5 self-start text-sm font-bold text-navy hover:text-primary">
          <ArrowLeft aria-hidden="true" size={16} /> Patients
        </Link>
        {overview ? (
          <div>
            <h1 className="text-2xl font-bold">
              {overview.firstName} {overview.lastName}
            </h1>
            <p className="text-sm text-text-muted">
              {[overview.age !== null ? `${overview.age} ans` : null, overview.phone ? formatPhone(overview.phone) : null, overview.email].filter(Boolean).join(' · ')}
            </p>
          </div>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          {overview ? <PatientAppointments appointments={overview.appointments} /> : null}
          <Card className="flex flex-col items-start gap-3 self-start">
            <Lock aria-hidden="true" size={24} className="text-text-muted" />
            <h2 className="text-base font-bold">Dossier médical réservé aux praticiens</h2>
            <p className="text-sm text-text">Le secrétariat gère les rendez-vous et les coordonnées, mais n’accède jamais aux informations médicales.</p>
          </Card>
        </div>
      </div>
    );
  if (!s) return <p className="p-6 text-text-muted">{error ?? 'Chargement du dossier…'}</p>;

  const add = (f: Exclude<Form, null>) =>
    form === f ? null : (
      <Button variant="ghost" size="sm" onClick={() => { setForm(f); setValues({}); }}>
        <Plus aria-hidden="true" size={14} /> Ajouter
      </Button>
    );
  const actions = (path: string, body: () => unknown, valid: boolean) => (
    <div className="flex gap-2 sm:col-span-2">
      <Button size="sm" disabled={!valid} onClick={() => submit(path, body())}>
        Enregistrer
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setForm(null)}>
        Annuler
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <Link href="/pro/app/patients" className="inline-flex items-center gap-1.5 self-start text-sm font-bold text-navy hover:text-primary">
        <ArrowLeft aria-hidden="true" size={16} /> Patients
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {s.patient.firstName} {s.patient.lastName}
          </h1>
          <p className="text-sm text-text-muted">
            {[ageOf(s.patient.birthDate), s.patient.birthDate ? `né(e) le ${new Date(`${s.patient.birthDate}T12:00:00Z`).toLocaleDateString('fr-FR')}` : null, s.patient.phone ? formatPhone(s.patient.phone) : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {s.patient.hasAccount ? <Badge tone="success">Compte Twabibu</Badge> : <Badge>Sans compte</Badge>}
          {s.patient.hasAccount ? <Badge tone={s.shared ? 'success' : 'warning'}>{s.shared ? 'Dossier partagé avec vous' : 'Vous voyez vos entrées seulement'}</Badge> : null}
          <label className="flex items-center gap-2 text-sm text-text">
            Groupe sanguin
            <select
              value={s.bloodGroup ?? ''}
              onChange={async (e) => setS(await api<RecordSynthesis>(`${base}/blood-group`, { method: 'PUT', body: { bloodGroup: e.target.value || null } }))}
              className={cn(fieldClass, 'h-9 w-24')}
            >
              <option value="">—</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={cn('flex flex-col gap-3', s.allergies.length && 'border-danger/40')}>
          <div className="flex items-center justify-between">
            <CardTitle as="h2" icon={<AlertTriangle aria-hidden="true" size={16} />} className={s.allergies.length ? 'text-danger' : ''}>
              Allergies et intolérances
            </CardTitle>
            {add('allergy')}
          </div>
          {s.allergies.length ? (
            <ul className="grid gap-2">
              {s.allergies.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                  <span>
                    <strong>{a.substance}</strong>
                    {a.reaction ? ` · ${a.reaction}` : ''} {a.severity === 'SEVERE' ? '· sévère' : a.severity === 'MILD' ? '· légère' : ''}
                  </span>
                  <button type="button" onClick={() => submit(`/allergies/${a.id}/resolve`, {})} className="shrink-0 text-xs underline">
                    Ne plus signaler
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">Aucune allergie connue.</p>
          )}
          {form === 'allergy' ? (
            <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
              <input aria-label="Substance" placeholder="Substance (ex. Pénicillines, Arachide)" value={v('substance')} onChange={set('substance')} className={fieldClass} />
              <input aria-label="Réaction" placeholder="Réaction (ex. urticaire)" value={v('reaction')} onChange={set('reaction')} className={fieldClass} />
              <select aria-label="Gravité" value={v('severity') || 'MODERATE'} onChange={set('severity')} className={fieldClass}>
                <option value="MILD">Légère</option>
                <option value="MODERATE">Modérée</option>
                <option value="SEVERE">Sévère</option>
              </select>
              {actions('/allergies', () => ({ substance: v('substance'), reaction: v('reaction') || undefined, severity: v('severity') || 'MODERATE' }), v('substance').trim().length >= 2)}
            </div>
          ) : null}
        </Card>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle as="h2" icon={<Pill aria-hidden="true" size={16} />}>Traitements en cours</CardTitle>
            {add('treatment')}
          </div>
          {s.treatments.length ? (
            <ul className="grid gap-2 text-sm">
              {s.treatments.map((t) => (
                <li key={t.id} className="flex items-start justify-between gap-2 border-b border-border pb-2 last:border-b-0">
                  <span className="text-text">
                    <strong className="font-medium text-ink">{t.label}</strong> · {t.posology}
                    <span className="block text-xs text-text-muted">
                      Depuis le {t.startedOn ? new Date(`${t.startedOn}T12:00:00Z`).toLocaleDateString('fr-FR') : '—'}
                      {t.endsOn ? ` jusqu’au ${new Date(`${t.endsOn}T12:00:00Z`).toLocaleDateString('fr-FR')}` : ''}
                      {t.fromPrescription ? ' · ordonnance Twabibu' : ''}
                    </span>
                  </span>
                  <button type="button" onClick={() => submit(`/treatments/${t.id}/stop`, {})} className="shrink-0 text-xs text-text-muted underline hover:text-danger">
                    Arrêter
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">Aucun traitement en cours.</p>
          )}
          {form === 'treatment' ? (
            <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
              <input aria-label="Médicament" placeholder="Médicament et dosage" value={v('label')} onChange={set('label')} className={fieldClass} />
              <input aria-label="Posologie" placeholder="Posologie" value={v('posology')} onChange={set('posology')} className={fieldClass} />
              {actions('/treatments', () => ({ label: v('label'), posology: v('posology') }), v('label').trim().length >= 2 && v('posology').trim().length >= 2)}
            </div>
          ) : null}
        </Card>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle as="h2" icon={<Stethoscope aria-hidden="true" size={16} />}>Antécédents</CardTitle>
            {add('history')}
          </div>
          {s.history.length ? (
            <ul className="grid gap-2 text-sm">
              {s.history.map((h) => (
                <li key={h.id} className="text-text">
                  <span className="text-xs font-bold tracking-wide text-text-muted uppercase">{HISTORY_LABEL[h.type]}</span>
                  <span className="block font-medium text-ink">
                    {h.label}
                    {h.occurredOn ? ` (${h.occurredOn.slice(0, 4)})` : ''}
                  </span>
                  {h.details ? <span className="block">{h.details}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">Aucun antécédent renseigné.</p>
          )}
          {form === 'history' ? (
            <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
              <select aria-label="Type" value={v('type') || 'MEDICAL'} onChange={set('type')} className={fieldClass}>
                {Object.entries(HISTORY_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              <input aria-label="Antécédent" placeholder="Ex. Diabète de type 2, appendicectomie" value={v('label')} onChange={set('label')} className={fieldClass} />
              <input aria-label="Date" type="date" value={v('occurredOn')} onChange={set('occurredOn')} className={fieldClass} />
              <input aria-label="Détails" placeholder="Détails (facultatif)" value={v('details')} onChange={set('details')} className={fieldClass} />
              {actions('/history', () => ({ type: v('type') || 'MEDICAL', label: v('label'), occurredOn: v('occurredOn') || undefined, details: v('details') || undefined }), v('label').trim().length >= 2)}
            </div>
          ) : null}
        </Card>

        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle as="h2" icon={<Syringe aria-hidden="true" size={16} />}>Vaccinations</CardTitle>
            {add('vaccination')}
          </div>
          {s.vaccinations.length ? (
            <ul className="grid gap-1 text-sm text-text">
              {s.vaccinations.map((x) => (
                <li key={x.id}>
                  <strong className="font-medium text-ink">{x.vaccine}</strong> · {x.givenOn ? new Date(`${x.givenOn}T12:00:00Z`).toLocaleDateString('fr-FR') : ''}
                  {x.nextDueOn ? <span className="text-text-muted"> · rappel le {new Date(`${x.nextDueOn}T12:00:00Z`).toLocaleDateString('fr-FR')}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">Aucune vaccination enregistrée.</p>
          )}
          {form === 'vaccination' ? (
            <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
              <input aria-label="Vaccin" placeholder="Vaccin (ex. ROR, Pentavalent)" value={v('vaccine')} onChange={set('vaccine')} className={fieldClass} />
              <input aria-label="Date" type="date" value={v('givenOn')} onChange={set('givenOn')} className={fieldClass} />
              <input aria-label="Lot" placeholder="Lot (facultatif)" value={v('lot')} onChange={set('lot')} className={fieldClass} />
              <input aria-label="Rappel prévu" type="date" value={v('nextDueOn')} onChange={set('nextDueOn')} className={fieldClass} />
              {actions('/vaccinations', () => ({ vaccine: v('vaccine'), givenOn: v('givenOn'), lot: v('lot') || undefined, nextDueOn: v('nextDueOn') || undefined }), v('vaccine').trim().length >= 2 && !!v('givenOn'))}
            </div>
          ) : null}
        </Card>
      </div>

      {Object.keys(s.vitals).length ? (
        <Card className="flex flex-col gap-3">
          <h2 className="font-heading text-sm font-bold text-navy">Dernières constantes</h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {VITALS.filter((x) => s.vitals[x.type]).map((x) => (
              <div key={x.type} className="rounded-md bg-background-soft p-3">
                <dt className="text-xs text-text-muted">{x.label}</dt>
                <dd className="font-heading text-lg font-bold text-navy tabular-nums">
                  {s.vitals[x.type]!.value} <span className="text-xs font-normal text-text-muted">{x.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="font-heading text-sm font-bold text-navy">Consultations</h2>
          {s.consultations.length ? (
            <ul className="grid gap-2">
              {s.consultations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={async () => setOpened(opened?.id === c.id ? null : await api<ConsultationDetail>(`${base}/consultations/${c.id}`))}
                    className="w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:border-primary"
                  >
                    <span className="block font-medium text-ink first-letter:uppercase">
                      {formatDateLong(new Date(c.createdAt))} · {c.practitioner}
                    </span>
                    <span className="block text-text">{[c.reason, ...c.diagnoses.map((d) => d.label)].filter(Boolean).join(' · ') || 'Sans motif renseigné'}</span>
                  </button>
                  {opened?.id === c.id ? (
                    <dl className="mt-2 grid gap-2 rounded-md bg-background-soft p-3 text-sm">
                      {(
                        [
                          ['reason', 'Motif'],
                          ['history', 'Interrogatoire'],
                          ['examination', 'Examen clinique'],
                          ['diagnosis', 'Diagnostic'],
                          ['plan', 'Conduite à tenir'],
                        ] as const
                      )
                        .filter(([k]) => opened.sections[k])
                        .map(([k, l]) => (
                          <div key={k}>
                            <dt className="text-xs font-bold text-text-muted uppercase">{l}</dt>
                            <dd className="whitespace-pre-line text-ink">{opened.sections[k]}</dd>
                          </div>
                        ))}
                      {opened.vitals.length ? (
                        <div>
                          <dt className="text-xs font-bold text-text-muted uppercase">Constantes</dt>
                          <dd className="text-ink">{opened.vitals.map((x) => `${VITALS.find((y) => y.type === x.type)?.label} ${x.value} ${VITALS.find((y) => y.type === x.type)?.unit}`).join(' · ')}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">Aucune consultation enregistrée.</p>
          )}
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="font-heading text-sm font-bold text-navy">Ordonnances</h2>
          {s.prescriptions.length ? (
            <ul className="grid gap-2">
              {s.prescriptions.map((p) => (
                <li key={p.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink first-letter:uppercase">{p.signedAt ? formatDateLong(new Date(p.signedAt)) : 'Brouillon'}</span>
                    <Link href={`/pro/ordonnance/${p.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <FileText aria-hidden="true" size={14} /> Imprimer
                    </Link>
                  </div>
                  <ul className="mt-1 text-text">
                    {p.lines.map((l, i) => (
                      <li key={i}>
                        {l.label} · <span className="text-text-muted">{l.posologyText}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">Aucune ordonnance.</p>
          )}
        </Card>
        {overview ? <PatientAppointments appointments={overview.appointments} /> : null}
      </div>
      <p className="text-xs text-text-muted">Chaque ouverture de ce dossier est enregistrée et visible par le patient s’il a un compte Twabibu.</p>
    </div>
  );
}
