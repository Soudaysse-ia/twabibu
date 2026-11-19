'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Info, Search, Trash2 } from 'lucide-react';
import { cn } from '@twabibu/ui';
import { api } from '@/lib/api-client';
import type { DrugHit, RxAlert } from '@/lib/medical-types';
import { fieldClass } from './Drawer';

export interface DraftLine {
  drug: DrugHit;
  posologyText: string;
  durationDays: string;
  quantity: string;
  substitutable: boolean;
}

const FREQUENCIES = ['1 fois par jour', '2 fois par jour (matin et soir)', '3 fois par jour (matin, midi et soir)', 'Si douleur ou fièvre, 3 fois par jour au maximum'];

/** Prescription lines from the drug reference, with live rule-based alerts (SPEC-14). */
export function PrescriptionEditor({ lines, onChange, alerts }: { lines: DraftLine[]; onChange: (l: DraftLine[]) => void; alerts: RxAlert[] }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<DrugHit[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      api<DrugHit[]>(`/v1/directory/drugs?q=${encodeURIComponent(q)}`).then(setHits).catch(() => setHits([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const update = (i: number, patch: Partial<DraftLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <div className="flex flex-col gap-3">
      {lines.map((l, i) => {
        const lineAlerts = alerts.filter((a) => a.lineIndex === i);
        return (
          <div key={i} className={cn('flex flex-col gap-2 rounded-md border p-3', lineAlerts.some((a) => a.blocking) ? 'border-danger bg-danger-soft/40' : 'border-border')}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-bold text-ink">
                {i + 1}. {l.drug.label}
                {l.drug.brandNames.length ? <span className="font-normal text-text-muted"> · {l.drug.brandNames.join(', ')}</span> : null}
              </p>
              <button type="button" aria-label="Retirer la ligne" onClick={() => onChange(lines.filter((_, j) => j !== i))} className="rounded-md p-1 text-text-muted hover:text-danger">
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </div>
            {lineAlerts.map((a, k) => (
              <p key={k} role={a.blocking ? 'alert' : undefined} className={cn('flex gap-1.5 text-xs', a.blocking ? 'font-bold text-danger' : 'text-warning')}>
                {a.blocking ? <AlertTriangle aria-hidden="true" size={14} /> : <Info aria-hidden="true" size={14} />} {a.message}
              </p>
            ))}
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <div className="flex flex-col gap-1">
                <input aria-label="Posologie" value={l.posologyText} onChange={(e) => update(i, { posologyText: e.target.value })} placeholder="Ex. 1 comprimé matin et soir" className={fieldClass} />
                <div className="flex flex-wrap gap-1">
                  {FREQUENCIES.map((f) => (
                    <button key={f} type="button" onClick={() => update(i, { posologyText: `1 ${l.drug.form} ${f}` })} className="rounded-lg border border-border px-2 py-0.5 text-xs text-text hover:border-primary hover:text-primary">
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex flex-col gap-1 text-xs text-text-muted">
                Durée (jours)
                <input type="number" min={1} max={365} value={l.durationDays} onChange={(e) => update(i, { durationDays: e.target.value })} className={cn(fieldClass, 'w-24')} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-text-muted">
                Boîtes
                <input type="number" min={1} max={99} value={l.quantity} onChange={(e) => update(i, { quantity: e.target.value })} className={cn(fieldClass, 'w-20')} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-text">
              <input type="checkbox" className="size-4 accent-primary" checked={!l.substitutable} onChange={(e) => update(i, { substitutable: !e.target.checked })} />
              Non substituable
            </label>
          </div>
        );
      })}
      <div className="relative">
        <Search aria-hidden="true" size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" />
        <input aria-label="Ajouter un médicament" placeholder="Ajouter un médicament (DCI ou nom commercial)" value={q} onChange={(e) => setQ(e.target.value)} className={cn(fieldClass, 'pl-9')} />
        {hits.length ? (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-surface shadow-float">
            {hits.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...lines, { drug: d, posologyText: '', durationDays: '', quantity: '1', substitutable: true }]);
                    setQ('');
                    setHits([]);
                  }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-primary-soft"
                >
                  <span className="text-ink">
                    {d.label}
                    {d.brandNames.length ? <span className="text-text-muted"> · {d.brandNames.join(', ')}</span> : null}
                  </span>
                  {d.controlled ? <span className="text-xs text-warning">contrôlé</span> : !d.prescriptionOnly ? <span className="text-xs text-text-muted">sans ordonnance</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
