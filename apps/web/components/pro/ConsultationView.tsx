'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, FileText } from 'lucide-react';
import { Button, buttonClasses, Card, cn } from '@twabibu/ui';
import { formatDateLong, formatTime } from '@twabibu/utils';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { VITALS, type RecordSynthesis, type RxAlert, type VitalType } from '@/lib/medical-types';
import type { ProAppointment } from '@/lib/pro-types';
import { fieldClass } from './Drawer';
import { PrescriptionEditor, type DraftLine } from './PrescriptionEditor';
import { useMembership } from './ProContext';
import { RecordSummary } from './RecordSummary';

const SECTIONS = [
  ['reason', 'Motif de consultation', 2],
  ['history', 'Interrogatoire', 3],
  ['examination', 'Examen clinique', 3],
  ['diagnosis', 'Diagnostic', 2],
  ['plan', 'Conduite à tenir', 3],
] as const;

type SectionKey = (typeof SECTIONS)[number][0];

/** The consultation screen (SPEC-13 §Écrans): record on the left, note and prescription on the right. */
export function ConsultationView({ appointmentId }: { appointmentId: string }) {
  const m = useMembership();
  const org = `/v1/pro/orgs/${m.organizationId}`;
  const [appt, setAppt] = useState<(ProAppointment & { practitionerId: string }) | null>(null);
  const [s, setS] = useState<RecordSynthesis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<Record<SectionKey, string>>({ reason: '', history: '', examination: '', diagnosis: '', plan: '' });
  const [vitals, setVitals] = useState<Partial<Record<VitalType, string>>>({});
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [alerts, setAlerts] = useState<RxAlert[]>([]);
  const [override, setOverride] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ prescriptionId: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const a = await api<ProAppointment & { practitionerId: string }>(`${org}/appointments/${appointmentId}`);
        setAppt(a);
        setSections((x) => ({ ...x, reason: a.motive.name }));
        setS(await api<RecordSynthesis>(`${org}/patients/${a.patient.id}/record`));
      } catch (err) {
        setError(err instanceof ApiError && err.status === 403 ? 'La consultation est réservée aux praticiens.' : errorMessage(err));
      }
    })();
  }, [org, appointmentId]);

  const payloadLines = useMemo(
    () =>
      lines.map((l) => ({
        drugId: l.drug.id,
        // Alerts must show as soon as a drug is added, before the posology is typed (finish() requires it).
        posologyText: l.posologyText.trim().length >= 3 ? l.posologyText.trim() : 'à préciser',
        durationDays: l.durationDays ? Number(l.durationDays) : undefined,
        quantity: l.quantity ? Number(l.quantity) : undefined,
        substitutable: l.substitutable,
      })),
    [lines],
  );

  // Live alerts while the prescription is written.
  useEffect(() => {
    if (!appt || !lines.length) {
      setAlerts([]);
      return;
    }
    const t = setTimeout(() => {
      api<RxAlert[]>(`${org}/patients/${appt.patient.id}/record/prescriptions/check`, { method: 'POST', body: { lines: payloadLines } })
        .then(setAlerts)
        .catch(() => undefined);
    }, 300);
    return () => clearTimeout(t);
  }, [org, appt, lines.length, payloadLines]);

  const blocking = alerts.some((a) => a.blocking);

  async function finish() {
    if (!appt) return;
    setError(null);
    if (lines.some((l) => l.posologyText.trim().length < 3)) return setError('Indiquez la posologie de chaque médicament.');
    if (blocking && override.trim().length < 5) return setError('Une allergie est signalée : retirez le médicament ou justifiez la prescription.');
    const vitalList = Object.entries(vitals)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([type, v]) => ({ type, value: Number(String(v).replace(',', '.')) }));
    setBusy(true);
    try {
      const recordBase = `${org}/patients/${appt.patient.id}/record`;
      await api(`${recordBase}/consultations`, {
        method: 'POST',
        body: {
          appointmentId: appt.id,
          sections: Object.fromEntries(Object.entries(sections).filter(([, v]) => v.trim())),
          diagnoses: sections.diagnosis.trim() ? [{ label: sections.diagnosis.trim().slice(0, 200) }] : [],
          vitals: vitalList,
          close: true,
        },
      });
      let prescriptionId: string | null = null;
      if (lines.length) {
        const signed = await api<{ id: string }>(`${recordBase}/prescriptions`, {
          method: 'POST',
          body: { appointmentId: appt.id, lines: payloadLines, ...(blocking ? { allergyOverride: { justification: override.trim() } } : {}) },
        });
        prescriptionId = signed.id;
      }
      setDone({ prescriptionId });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_FAILED') setError('Une constante semble incorrecte : vérifiez les valeurs saisies.');
      else if (err instanceof ApiError && err.code === 'PRESCRIBER_NOT_ALLOWED') setError('Votre profil ne permet pas de signer une ordonnance.');
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (error && !appt) return <p className="p-6 text-danger">{error}</p>;
  if (!appt || !s) return <p className="p-6 text-text-muted">Chargement…</p>;

  if (done)
    return (
      <div className="p-4 sm:p-6">
        <Card className="flex max-w-xl flex-col items-start gap-4">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
            <Check aria-hidden="true" size={26} />
          </span>
          <h1 className="text-xl font-bold">Consultation enregistrée</h1>
          <p className="text-text">
            {appt.patient.firstName} {appt.patient.lastName} · le rendez-vous est marqué terminé.
            {done.prescriptionId ? ' L’ordonnance est signée et ajoutée au dossier.' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {done.prescriptionId ? (
              <Link href={`/pro/ordonnance/${done.prescriptionId}`} className={buttonClasses({ variant: 'primary' })}>
                <FileText aria-hidden="true" size={16} /> Imprimer l’ordonnance
              </Link>
            ) : null}
            <Link href="/pro/app/agenda" className={buttonClasses({ variant: 'secondary' })}>
              Retour à l’agenda
            </Link>
            <Link href={`/pro/app/patients/${appt.patient.id}`} className={buttonClasses({ variant: 'ghost' })}>
              Voir le dossier
            </Link>
          </div>
        </Card>
      </div>
    );

  const start = new Date(appt.startsAt);
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/pro/app/agenda" className="inline-flex items-center gap-1.5 text-sm font-bold text-navy hover:text-primary">
          <ArrowLeft aria-hidden="true" size={16} /> Agenda
        </Link>
        <p className="text-sm text-text-muted first-letter:uppercase">
          {formatDateLong(start)} à {formatTime(start)} · {appt.motive.name}
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="lg:sticky lg:top-20 lg:self-start">
          <RecordSummary s={s} />
          <Link href={`/pro/app/patients/${appt.patient.id}`} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            Dossier complet
          </Link>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <h1 className="text-lg font-bold">Consultation</h1>
            {SECTIONS.map(([key, label, rows]) => (
              <label key={key} className="flex flex-col gap-1 text-sm font-medium text-ink">
                {label}
                <textarea rows={rows} value={sections[key]} onChange={(e) => setSections({ ...sections, [key]: e.target.value })} className="rounded-md border border-border p-3 text-sm font-normal focus:border-primary focus:outline-2 focus:outline-primary/30" />
              </label>
            ))}
            <p className="text-xs text-text-muted">Le texte est chiffré avant d’être enregistré.</p>
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="font-heading text-sm font-bold text-navy">Constantes</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {VITALS.map((v) => (
                <label key={v.type} className="flex flex-col gap-1 text-xs text-text-muted">
                  {v.label} ({v.unit})
                  <input inputMode="decimal" value={vitals[v.type] ?? ''} onChange={(e) => setVitals({ ...vitals, [v.type]: e.target.value })} className={fieldClass} />
                </label>
              ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="font-heading text-sm font-bold text-navy">Ordonnance</h2>
            <PrescriptionEditor lines={lines} onChange={setLines} alerts={alerts} />
            {blocking ? (
              <label className="flex flex-col gap-1 text-sm font-medium text-danger">
                Justification pour prescrire malgré l’allergie
                <input value={override} onChange={(e) => setOverride(e.target.value)} placeholder="Ex. allergie ancienne non confirmée, test négatif" className={cn(fieldClass, 'border-danger')} />
              </label>
            ) : null}
          </Card>

          {error ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button size="lg" onClick={finish} disabled={busy} className="self-start">
            {busy ? 'Enregistrement…' : lines.length ? 'Terminer et signer l’ordonnance' : 'Terminer la consultation'}
          </Button>
        </div>
      </div>
    </div>
  );
}
