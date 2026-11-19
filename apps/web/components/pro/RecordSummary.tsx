'use client';

import { AlertTriangle, Pill, Stethoscope } from 'lucide-react';
import { cn } from '@twabibu/ui';
import { ageOf, HISTORY_LABEL, VITALS, type RecordSynthesis } from '@/lib/medical-types';

/** Compact synthesis for the consultation screen: what the practitioner must see before anything else. */
export function RecordSummary({ s, className }: { s: RecordSynthesis; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 text-sm', className)}>
      <div>
        <p className="font-heading text-base font-bold text-navy">
          {s.patient.firstName} {s.patient.lastName}
        </p>
        <p className="text-text-muted">
          {[ageOf(s.patient.birthDate), s.bloodGroup ? `Groupe ${s.bloodGroup}` : null].filter(Boolean).join(' · ') || 'Âge non renseigné'}
        </p>
      </div>
      {s.allergies.length ? (
        <div role="alert" className="rounded-md border border-danger/40 bg-danger-soft p-3 text-danger">
          <p className="flex items-center gap-1.5 font-bold">
            <AlertTriangle aria-hidden="true" size={16} /> Allergies
          </p>
          <ul className="mt-1 grid gap-0.5">
            {s.allergies.map((a) => (
              <li key={a.id}>
                {a.substance}
                {a.reaction ? ` (${a.reaction})` : ''}
                {a.severity === 'SEVERE' ? ' · sévère' : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-md bg-background-soft p-3 text-text">Aucune allergie connue.</p>
      )}
      <div>
        <p className="flex items-center gap-1.5 font-bold text-ink">
          <Pill aria-hidden="true" size={15} /> Traitements en cours
        </p>
        {s.treatments.length ? (
          <ul className="mt-1 grid gap-1 text-text">
            {s.treatments.map((t) => (
              <li key={t.id}>
                <span className="font-medium text-ink">{t.label}</span> · {t.posology}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-muted">Aucun.</p>
        )}
      </div>
      <div>
        <p className="flex items-center gap-1.5 font-bold text-ink">
          <Stethoscope aria-hidden="true" size={15} /> Antécédents
        </p>
        {s.history.length ? (
          <ul className="mt-1 grid gap-1 text-text">
            {s.history.map((h) => (
              <li key={h.id}>
                <span className="text-text-muted">{HISTORY_LABEL[h.type]} :</span> {h.label}
                {h.occurredOn ? ` (${h.occurredOn.slice(0, 4)})` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-muted">Aucun.</p>
        )}
      </div>
      {Object.keys(s.vitals).length ? (
        <div>
          <p className="font-bold text-ink">Dernières constantes</p>
          <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-text">
            {VITALS.filter((v) => s.vitals[v.type]).map((v) => (
              <div key={v.type} className="contents">
                <dt className="text-text-muted">{v.label}</dt>
                <dd className="tabular-nums">
                  {s.vitals[v.type]!.value} {v.unit}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
