import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Check, MapPin, Phone, Truck } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { Card, Container } from '@twabibu/ui';
import { formatDateLong, formatKmf, formatPhone, formatTime } from '@twabibu/utils';
import { CancelOrderButton } from '@/components/pharmacy/CancelOrderButton';
import { OrderStatusSteps } from '@/components/pharmacy/OrderStatusSteps';
import { apiGet } from '@/lib/api-server';
import type { Order } from '@/lib/pharmacy-types';

const t = fr.pharmacy;
export const metadata: Metadata = { title: 'Suivi de commande', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nouvelle?: string }> }) {
  const { id } = await params;
  const { nouvelle } = await searchParams;
  const res = await apiGet<Order>(`/v1/me/orders/${encodeURIComponent(id)}`);
  if (!res.ok && (res.status === 401 || res.status === 403)) redirect(`/connexion?next=/mon-compte/commandes/${id}`);
  if (!res.ok) notFound();
  const o = res.data;
  return (
    <Container className="flex max-w-3xl flex-col gap-5 py-8">
      <Link href="/mon-compte/commandes" className="text-sm font-medium text-primary hover:underline">
        ← {t.orders}
      </Link>
      {nouvelle ? (
        <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-md bg-success-soft p-4 text-success">
          <Check aria-hidden="true" size={20} className="mt-0.5 shrink-0" />
          <p className="text-sm">
            <strong>{t.orderSent}.</strong> La pharmacie vous répondra rapidement ; vous recevrez un e-mail à chaque étape.
          </p>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">
          {t.reference} {o.reference}
        </h1>
        <p className="text-text first-letter:uppercase">
          {formatDateLong(new Date(o.createdAt))} à {formatTime(new Date(o.createdAt))} · {o.mode === 'DELIVERY' ? t.delivery : t.pickup}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="flex flex-col gap-3">
          <h2 className="font-heading text-sm font-bold text-navy">Suivi</h2>
          <OrderStatusSteps order={o} />
          {o.courier && o.status === 'OUT_FOR_DELIVERY' ? (
            <p className="flex items-center gap-2 text-sm text-ink">
              <Truck aria-hidden="true" size={16} className="text-pharmacy" /> {t.courier} : {o.courier.name},{' '}
              <a href={`tel:${o.courier.phone}`} className="text-primary hover:underline">
                {formatPhone(o.courier.phone)}
              </a>
            </p>
          ) : null}
          {o.status === 'PENDING' || o.status === 'ACCEPTED' ? <CancelOrderButton orderId={o.id} /> : null}
        </Card>
        <Card className="flex flex-col gap-3">
          <h2 className="font-heading text-sm font-bold text-navy">{o.pharmacy.name}</h2>
          <p className="flex gap-2 text-sm text-text">
            <MapPin aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-text-muted" /> {o.pharmacy.address}
          </p>
          {o.pharmacy.phone ? (
            <a href={`tel:${o.pharmacy.phone}`} className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              <Phone aria-hidden="true" size={16} /> {formatPhone(o.pharmacy.phone)}
            </a>
          ) : null}
          {o.address ? (
            <div className="border-t border-border pt-3 text-sm text-text">
              <p className="font-medium text-ink">Adresse de livraison</p>
              <p>
                {o.address.line}, {o.address.locality}
              </p>
              {o.address.instructions ? <p className="text-text-muted">{o.address.instructions}</p> : null}
              <p>{formatPhone(o.address.phone)}</p>
            </div>
          ) : null}
        </Card>
      </div>
      <Card className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-bold text-navy">Produits</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {o.lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span className="text-ink">
                {l.quantity} × {l.label}
              </span>
              <span className="shrink-0 text-ink">{formatKmf(l.totalKmf)}</span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-[1fr_auto] gap-1 border-t border-border pt-3 text-sm">
          <dt className="text-text">{t.subtotal}</dt>
          <dd className="text-right">{formatKmf(o.subtotalKmf)}</dd>
          {o.mode === 'DELIVERY' ? (
            <>
              <dt className="text-text">{t.deliveryFee}</dt>
              <dd className="text-right">{formatKmf(o.deliveryFeeKmf)}</dd>
            </>
          ) : null}
          <dt className="font-bold text-ink">{t.total}</dt>
          <dd className="text-right font-bold text-ink">{formatKmf(o.totalKmf)}</dd>
        </dl>
        <p className="text-xs text-text-muted">{o.paymentMode === 'CASH_ON_DELIVERY' ? t.deliveryHint : t.pickupHint}. {t.noSale}</p>
      </Card>
    </Container>
  );
}
