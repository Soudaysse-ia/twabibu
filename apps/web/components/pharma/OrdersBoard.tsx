'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Phone } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { Badge, Button, Card, cn } from '@twabibu/ui';
import { formatKmf, formatPhone, formatTime } from '@twabibu/utils';
import { fieldClass } from '@/components/Drawer';
import { api, errorMessage } from '@/lib/api-client';
import type { PharmaOrder } from '@/lib/pharma-types';
import type { OrderStatus } from '@/lib/pharmacy-types';
import { usePharma } from './PharmaContext';

const t = fr.pharmacy;
const COLUMNS: { key: string; label: string; statuses: OrderStatus[] }[] = [
  { key: 'new', label: 'Nouvelles', statuses: ['PENDING'] },
  { key: 'work', label: 'À préparer', statuses: ['ACCEPTED', 'PREPARING'] },
  { key: 'out', label: 'Prêtes / en livraison', statuses: ['READY', 'OUT_FOR_DELIVERY'] },
  { key: 'done', label: 'Terminées', statuses: ['DELIVERED', 'CANCELLED'] },
];
const ACTION: Record<string, string> = {
  ACCEPTED: 'Accepter',
  PREPARING: 'Commencer la préparation',
  READY: 'Prête à retirer',
  OUT_FOR_DELIVERY: 'Partir en livraison',
  DELIVERED: 'Marquer remise',
  CANCELLED: 'Refuser / annuler',
};

/** Orders kanban (SPEC-15 §6). Columns on desktop, one column at a time on phones. */
export function OrdersBoard() {
  const m = usePharma();
  const [orders, setOrders] = useState<PharmaOrder[] | null>(null);
  const [column, setColumn] = useState('new');
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<PharmaOrder[]>(`${m.base}/orders`).then(setOrders).catch((e) => setError(errorMessage(e)));
  }, [m.base]);
  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-xl font-bold">Commandes</h1>
      {error ? <p className="text-danger">{error}</p> : null}
      <div role="tablist" aria-label="Étapes" className="flex gap-1 overflow-x-auto xl:hidden">
        {COLUMNS.map((c) => {
          const n = orders?.filter((o) => c.statuses.includes(o.status)).length ?? 0;
          return (
            <button key={c.key} role="tab" type="button" aria-selected={column === c.key} onClick={() => setColumn(c.key)} className={cn('h-11 shrink-0 rounded-pill border px-4 text-sm font-medium', column === c.key ? 'border-pharmacy bg-pharmacy-soft text-pharmacy' : 'border-border bg-surface text-navy')}>
              {c.label} ({n})
            </button>
          );
        })}
      </div>
      {!orders ? (
        <p className="text-text-muted">Chargement…</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-4">
          {COLUMNS.map((c) => {
            const list = orders.filter((o) => c.statuses.includes(o.status));
            return (
              <section key={c.key} aria-label={c.label} className={cn('flex min-w-0 flex-col gap-3', column !== c.key && 'max-xl:hidden')}>
                <h2 className="hidden text-sm font-bold text-navy xl:block">
                  {c.label} ({list.length})
                </h2>
                {list.length === 0 ? <p className="rounded-md border border-dashed border-border p-4 text-sm text-text-muted">Aucune commande.</p> : null}
                {list.map((o) => (
                  <OrderCard key={o.id} order={o} onChange={load} />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order: o, onChange }: { order: PharmaOrder; onChange: () => void }) {
  const m = usePharma();
  const [courier, setCourier] = useState({ name: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function move(status: OrderStatus) {
    setError(null);
    if (status === 'OUT_FOR_DELIVERY' && (courier.name.trim().length < 2 || courier.phone.trim().length < 6)) return setError('Indiquez le nom et le téléphone du livreur.');
    setBusy(true);
    try {
      await api(`${m.base}/orders/${o.id}/status`, { method: 'POST', body: { status, ...(status === 'OUT_FOR_DELIVERY' ? { courier } : {}) } });
      onChange();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-ink">
            n° {o.reference} · {o.patient?.name ?? 'Patient'}
          </p>
          <p className="text-xs text-text-muted">
            {formatTime(new Date(o.createdAt))} · {o.mode === 'DELIVERY' ? t.delivery : t.pickup}
            {o.prescriptionId ? ' · sur ordonnance' : ''}
          </p>
        </div>
        <Badge tone={o.status === 'CANCELLED' ? 'warning' : o.status === 'DELIVERED' ? 'success' : 'pharmacy'}>{t.orderStatus[o.status]}</Badge>
      </div>
      <ul className="text-sm text-ink">
        {o.lines.map((l) => (
          <li key={l.id} className="flex justify-between gap-2">
            <span className="min-w-0">
              {l.quantity} × {l.label}
            </span>
            <span className="shrink-0 text-text">{formatKmf(l.totalKmf)}</span>
          </li>
        ))}
      </ul>
      <p className="text-sm font-bold text-ink">
        {t.total} : {formatKmf(o.totalKmf)}
        {o.deliveryFeeKmf ? <span className="font-normal text-text-muted"> (dont livraison {formatKmf(o.deliveryFeeKmf)})</span> : null}
      </p>
      {o.address ? (
        <div className="flex flex-col gap-1 rounded-md bg-background-soft p-2 text-sm text-text">
          <span className="flex gap-1.5">
            <MapPin aria-hidden="true" size={14} className="mt-0.5 shrink-0" /> {o.address.line}, {o.address.locality}
          </span>
          {o.address.instructions ? <span className="text-xs">{o.address.instructions}</span> : null}
          <a href={`tel:${o.address.phone}`} className="flex items-center gap-1.5 font-medium text-primary">
            <Phone aria-hidden="true" size={14} /> {formatPhone(o.address.phone)}
          </a>
        </div>
      ) : null}
      {o.courier ? <p className="text-xs text-text-muted">{t.courier} : {o.courier.name}, {formatPhone(o.courier.phone)}</p> : null}
      {o.next.includes('OUT_FOR_DELIVERY') ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <input aria-label="Nom du livreur" placeholder="Nom du livreur" value={courier.name} onChange={(e) => setCourier({ ...courier, name: e.target.value })} className={fieldClass} />
          <input aria-label="Téléphone du livreur" placeholder="Téléphone du livreur" inputMode="tel" value={courier.phone} onChange={(e) => setCourier({ ...courier, phone: e.target.value })} className={fieldClass} />
        </div>
      ) : null}
      {o.next.length ? (
        <div className="flex flex-wrap gap-2">
          {o.next
            .filter((s) => s !== 'CANCELLED')
            .map((s) => (
              <Button key={s} size="sm" onClick={() => move(s)} disabled={busy || (s === 'DELIVERED' && !!o.prescriptionId && !m.pharmacist)}>
                {ACTION[s]}
              </Button>
            ))}
          {o.next.includes('CANCELLED') ? (
            confirmCancel ? (
              <>
                <Button size="sm" variant="secondary" onClick={() => move('CANCELLED')} disabled={busy}>
                  Confirmer l’annulation
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(false)}>
                  Non
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(true)}>
                {ACTION.CANCELLED}
              </Button>
            )
          ) : null}
        </div>
      ) : null}
      {o.prescriptionId && o.next.includes('DELIVERED') && !m.pharmacist ? <p className="text-xs text-text-muted">La remise d’une commande sur ordonnance est validée par un pharmacien.</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
