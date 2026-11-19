'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarClock, ClipboardList, ShoppingBag, Wallet } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { Badge, Card } from '@twabibu/ui';
import { formatKmf } from '@twabibu/utils';
import { dutyWindow } from '@/components/pharmacy/PharmacyCard';
import { api, errorMessage } from '@/lib/api-client';
import type { PharmaDashboard as Data } from '@/lib/pharma-types';
import { usePharma } from './PharmaContext';

const SLOT: Record<string, string> = { LOCALITY_TOP: 'En tête de l’annuaire', DUTY_PAGE: 'Page des gardes', DRUG_PAGE: 'Pages médicaments (produits sans ordonnance)' };

export function PharmaDashboard() {
  const m = usePharma();
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const load = () => api<Data>(`${m.base}/dashboard`).then(setD).catch((e) => setError(errorMessage(e)));
    load();
    const id = setInterval(load, 30_000); // new prescriptions and orders show up without reloading
    return () => clearInterval(id);
  }, [m.base]);
  if (error) return <p className="p-6 text-danger">{error}</p>;
  if (!d) return <p className="p-6 text-text-muted">Chargement…</p>;
  const open = Object.values(d.openOrders).reduce((s, n) => s + (n ?? 0), 0);
  const tiles = [
    { href: '/pharma/app/ordonnances', icon: ClipboardList, label: 'Ordonnances à traiter', value: String(d.prescriptionsWaiting), alert: d.prescriptionsWaiting > 0 },
    { href: '/pharma/app/commandes', icon: ShoppingBag, label: 'Commandes en cours', value: String(open), alert: (d.openOrders.PENDING ?? 0) > 0 },
    { href: '/pharma/app/commandes', icon: Wallet, label: `Commandes du jour (${d.todayOrders})`, value: formatKmf(d.todayRevenueKmf), alert: false },
  ];
  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <h1 className="text-xl font-bold">{m.organizationName}</h1>
      {!d.verified ? (
        <p role="alert" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-ink">
          Votre pharmacie n’est pas encore vérifiée : elle apparaît dans l’annuaire mais ne reçoit ni ordonnances ni commandes. Transmettez votre autorisation d’ouverture à l’équipe Twabibu.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map(({ href, icon: Icon, label, value, alert }) => (
          <Link key={label} href={href} className="rounded-md focus-visible:outline-2 focus-visible:outline-primary">
            <Card className="flex items-center gap-4 hover:border-pharmacy">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-pharmacy-soft text-pharmacy">
                <Icon aria-hidden="true" size={22} />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-ink">{value}</p>
                <p className="text-sm text-text">{label}</p>
              </div>
              {alert ? <span className="ml-auto size-2.5 shrink-0 rounded-full bg-danger" aria-label="À traiter" /> : null}
            </Card>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 font-heading text-sm font-bold text-navy">
            <CalendarClock aria-hidden="true" size={16} /> Prochaines gardes
          </h2>
          {d.duties.length === 0 ? (
            <p className="text-sm text-text">Aucune garde prévue.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {d.duties.map((x) => (
                <li key={x.startsAt} className="flex items-center justify-between gap-2">
                  <span className="text-ink first-letter:uppercase">{dutyWindow(x.startsAt, x.endsAt)}</span>
                  {x.onDutyNow ? <Badge tone="pharmacy">En cours</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="font-heading text-sm font-bold text-navy">Espaces « {fr.pharmacy.partner} »</h2>
          {d.placements.length === 0 ? (
            <p className="text-sm text-text">Aucun espace sponsorisé. Contactez Twabibu pour être mis en avant sur votre île (3 emplacements par île).</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {d.placements.map((p) => (
                <li key={`${p.slot}-${p.startsAt}`} className="flex items-center justify-between gap-2">
                  <span className="text-ink">{SLOT[p.slot] ?? p.slot}</span>
                  <span className="text-text-muted">jusqu’au {new Date(p.endsAt).toLocaleDateString('fr-FR', { timeZone: 'Indian/Comoro' })}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
