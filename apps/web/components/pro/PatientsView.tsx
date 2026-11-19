'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { Badge, Button, Card, cn } from '@twabibu/ui';
import { formatDateLong, formatPhone, formatTime } from '@twabibu/utils';
import { api, errorMessage } from '@/lib/api-client';
import { fieldClass } from './Drawer';
import { useMembership } from './ProContext';

interface Item {
  id: string;
  firstName: string;
  lastName: string;
  age: number | null;
  phone: string | null;
  email: string | null;
  hasAccount: boolean;
  noShowCount: number;
  isBlocked: boolean;
  visits: number;
  lastVisitAt: string | null;
  nextAppointmentAt: string | null;
}
interface Page {
  total: number;
  page: number;
  pageSize: number;
  items: Item[];
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Indian/Comoro', day: 'numeric', month: 'short', year: 'numeric' });

/** The practice's patients (SPEC-06): « mes patients » first for a practitioner, the whole practice otherwise. */
export function PatientsView() {
  const m = useMembership();
  const clinician = !!m.practitionerId;
  const [scope, setScope] = useState<'mine' | 'all'>(clinician ? 'mine' : 'all');
  const [q, setQ] = useState('');
  const [data, setData] = useState<Page | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api<Page>(`/v1/pro/orgs/${m.organizationId}/patients/list?scope=${scope}&page=${page}&q=${encodeURIComponent(q.trim())}`)
        .then((r) => {
          setData((prev) => (page > 1 && prev ? { ...r, items: [...prev.items, ...r.items] } : r));
          setError(null);
        })
        .catch((err) => setError(errorMessage(err)));
    }, page > 1 ? 0 : 200);
    return () => clearTimeout(t);
  }, [q, scope, page, m.organizationId]);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Patients</h1>
          <p className="text-sm text-text-muted">Les fiches de votre structure. Une autre structure ne les voit jamais.</p>
        </div>
        {data ? (
          <p className="text-sm text-text-muted" aria-live="polite">
            {data.total} patient{data.total > 1 ? 's' : ''}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-xl">
          <Search aria-hidden="true" size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" />
          <input aria-label="Rechercher un patient" placeholder="Nom, prénom, e-mail ou chiffres du téléphone" value={q} onChange={(e) => {
              // Same render as the query: never append page 2 of the old search to the new one.
              setQ(e.target.value);
              setPage(1);
            }} className={cn(fieldClass, 'h-12 pl-10 text-base sm:text-sm')} />
        </div>
        {clinician ? (
          <div role="group" aria-label="Patients affichés" className="flex shrink-0 gap-1.5">
            {(
              [
                ['mine', 'Mes patients'],
                ['all', 'Tout le cabinet'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={scope === k} onClick={() => {
                  setScope(k);
                  setPage(1);
                }} className={cn('h-11 rounded-pill border px-4 text-sm font-medium', scope === k ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-navy')}>
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {!data ? (
        <p className="text-sm text-text-muted">Chargement…</p>
      ) : data.items.length === 0 ? (
        <Card className="text-text">{q.trim() ? 'Aucun patient ne correspond.' : scope === 'mine' ? 'Aucun patient n’a encore pris rendez-vous sur votre agenda.' : 'Aucune fiche patient pour l’instant.'}</Card>
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
            {data.items.map((p) => (
              <li key={p.id}>
                <Link href={`/pro/app/patients/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-background-soft focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {p.lastName.toUpperCase()} {p.firstName}
                      {p.age !== null ? <span className="font-normal text-text-muted"> · {p.age} ans</span> : null}
                    </p>
                    <p className="truncate text-sm text-text">{[p.phone ? formatPhone(p.phone) : null, p.email].filter(Boolean).join(' · ') || 'Sans coordonnées'}</p>
                    <p className="text-xs text-text-muted">
                      {p.lastVisitAt ? `Dernière visite le ${shortDate(p.lastVisitAt)} · ${p.visits} visite${p.visits > 1 ? 's' : ''}` : 'Pas encore venu'}
                      {p.nextAppointmentAt ? (
                        <span className="first-letter:uppercase">
                          {' · prochain RDV '}
                          {formatDateLong(new Date(p.nextAppointmentAt)).replace(/ \d{4}$/, '')} à {formatTime(new Date(p.nextAppointmentAt))}
                        </span>
                      ) : null}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.hasAccount ? <Badge tone="success">Compte Twabibu</Badge> : null}
                      {p.noShowCount ? <Badge tone="warning">{p.noShowCount} absence{p.noShowCount > 1 ? 's' : ''}</Badge> : null}
                      {p.isBlocked ? <Badge tone="warning">Bloqué</Badge> : null}
                    </div>
                  </div>
                  <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
                </Link>
              </li>
            ))}
          </ul>
          {data.items.length < data.total ? (
            <Button variant="secondary" onClick={() => setPage(page + 1)} className="self-center">
              Voir plus ({data.total - data.items.length} restant{data.total - data.items.length > 1 ? 's' : ''})
            </Button>
          ) : null}
        </>
      )}
      {clinician ? <p className="text-xs text-text-muted">Ouvrez une fiche pour voir le dossier médical : antécédents, allergies, traitements, consultations, ordonnances.</p> : null}
    </div>
  );
}
