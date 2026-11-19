'use client';

import { useEffect, useState } from 'react';
import { Badge, Card } from '@twabibu/ui';
import { formatDateLong } from '@twabibu/utils';
import { dutyWindow } from '@/components/pharmacy/PharmacyCard';
import { api, errorMessage } from '@/lib/api-client';
import { usePharma } from './PharmaContext';

interface Duty { id: string; startsAt: string; endsAt: string; source: string; onDutyNow: boolean; past: boolean; updatedAt: string }

/** The pharmacy's duty calendar, as published to patients. The official calendar is kept by Twabibu (SPEC-15 §7.5). */
export function DutyList() {
  const m = usePharma();
  const [rows, setRows] = useState<Duty[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<Duty[]>(`${m.base}/duty`).then(setRows).catch((e) => setError(errorMessage(e)));
  }, [m.base]);
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-xl font-bold">Gardes</h1>
      <p className="text-sm text-text-muted">
        Le calendrier des gardes vient de la source officielle de votre île et s’affiche tel quel sur la page publique « Pharmacies de garde ». Une erreur ? Écrivez à l’équipe Twabibu : elle vérifie auprès de la source et corrige.
      </p>
      {error ? <p className="text-danger">{error}</p> : null}
      {!rows ? (
        <p className="text-text-muted">Chargement…</p>
      ) : rows.length === 0 ? (
        <Card className="text-text">Aucune garde enregistrée pour votre pharmacie.</Card>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border bg-surface">
          {rows.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className={d.past ? 'text-text-muted first-letter:uppercase' : 'text-ink first-letter:uppercase'}>{dutyWindow(d.startsAt, d.endsAt)}</span>
              <span className="flex items-center gap-2">
                {d.onDutyNow ? <Badge tone="pharmacy">En cours</Badge> : d.past ? <Badge tone="info">Passée</Badge> : null}
                <span className="text-xs text-text-muted">mis à jour le {formatDateLong(new Date(d.updatedAt))}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
