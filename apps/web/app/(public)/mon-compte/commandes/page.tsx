import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { fr } from '@twabibu/i18n';
import { Badge, Card, Container } from '@twabibu/ui';
import { formatDateLong, formatKmf } from '@twabibu/utils';
import { apiGet } from '@/lib/api-server';
import type { Order } from '@/lib/pharmacy-types';

const t = fr.pharmacy;
export const metadata: Metadata = { title: t.orders, robots: { index: false } };

export default async function MyOrdersPage() {
  const res = await apiGet<Order[]>('/v1/me/orders');
  if (!res.ok && (res.status === 401 || res.status === 403)) redirect('/connexion?next=/mon-compte/commandes');
  const orders = res.ok ? res.data : [];
  return (
    <Container className="flex flex-col gap-5 py-8">
      <h1 className="text-2xl font-bold">{t.orders}</h1>
      {orders.length === 0 ? (
        <Card className="flex flex-col gap-2 text-text">
          <p>{t.ordersEmpty}</p>
          <Link href="/pharmacies" className="self-start font-medium text-primary hover:underline">
            Trouver une pharmacie
          </Link>
        </Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/mon-compte/commandes/${o.id}`} className="block rounded-md focus-visible:outline-2 focus-visible:outline-primary">
                <Card className="flex flex-col gap-2 hover:border-primary">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-ink">{o.pharmacy.name}</p>
                    <Badge tone={o.status === 'CANCELLED' ? 'warning' : o.status === 'DELIVERED' ? 'success' : 'pharmacy'}>{t.orderStatus[o.status]}</Badge>
                  </div>
                  <p className="text-sm text-text first-letter:uppercase">
                    {formatDateLong(new Date(o.createdAt))} · {o.mode === 'DELIVERY' ? t.delivery : t.pickup}
                  </p>
                  <p className="text-sm text-text-muted">
                    {t.reference} {o.reference} · {o.lines.length} produit{o.lines.length > 1 ? 's' : ''} · {formatKmf(o.totalKmf)}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
