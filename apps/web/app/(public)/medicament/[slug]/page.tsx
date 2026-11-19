import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Info } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { Badge, Card, Container } from '@twabibu/ui';
import { formatDateLong, formatKmf } from '@twabibu/utils';
import { IslandTabs, isIsland } from '@/components/pharmacy/IslandTabs';
import { OpenState } from '@/components/pharmacy/PharmacyCard';
import { apiGet } from '@/lib/api-server';
import type { DrugAvailability } from '@/lib/pharmacy-types';

const t = fr.pharmacy;
type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ ile?: string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const res = await apiGet<DrugAvailability>(`/v1/drugs/${encodeURIComponent(slug)}/availability`);
  if (!res.ok) return { title: t.drugTitle };
  const d = res.data.drug;
  return { title: `${d.dci} ${d.strength} : prix et disponibilité en pharmacie`, description: `${d.dci} ${d.strength} (${d.form}) dans les pharmacies des Comores.` };
}

/** Drug page and price comparison (SPEC-15 §2). Never medical advice; no promotion of prescription drugs. */
export default async function DrugPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { ile } = await searchParams;
  const island = isIsland(ile) ? ile : 'ngazidja';
  const res = await apiGet<DrugAvailability>(`/v1/drugs/${encodeURIComponent(slug)}/availability?island=${island}`);
  if (!res.ok) notFound();
  const { drug, offers, inStockCount } = res.data;
  return (
    <Container className="flex flex-col gap-5 py-6 sm:py-8">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold tracking-wide text-text-muted uppercase">{t.drugTitle}</p>
        <h1 className="text-2xl font-bold">
          {drug.dci} {drug.strength}
        </h1>
        <p className="text-text">
          {drug.form}
          {drug.brandNames.length ? ` · ${drug.brandNames.join(', ')}` : ''}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {drug.controlled ? <Badge tone="warning">{t.controlled}</Badge> : drug.prescriptionOnly ? <Badge tone="pharmacy">{t.prescriptionOnly}</Badge> : null}
          {drug.essential ? <Badge tone="info">Médicament essentiel</Badge> : null}
        </div>
      </div>
      <IslandTabs current={island} href={(i) => `/medicament/${drug.slug}?ile=${i}`} />
      <p className="text-sm text-text" aria-live="polite">
        {inStockCount > 0 ? `${drug.dci} ${drug.strength} : ${t.inPharmacies} ${t.pharmaciesCount(inStockCount)} sur ${t.islands[island]}.` : t.drugNone}
      </p>
      {offers.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
          {offers.map((o) => (
            <li key={o.productId} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link href={`/pharmacie/${o.pharmacy.slug}`} className="font-bold text-primary hover:underline">
                  {o.pharmacy.name}
                </Link>
                <p className="text-sm text-text">{o.pharmacy.locality?.name}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <OpenState p={o.pharmacy} />
                  {o.pharmacy.partner ? <Badge tone="info">{t.partner}</Badge> : null}
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-lg font-bold text-navy">{formatKmf(o.priceKmf)}</p>
                <Badge tone={o.availability === 'IN_STOCK' ? 'success' : 'warning'}>{t.availability[o.availability]}</Badge>
                <p className="mt-1 text-xs text-text-muted">mis à jour le {formatDateLong(new Date(o.updatedAt))}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <Card className="flex gap-3 text-sm text-text">
        <Info aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-primary" />
        <div className="flex flex-col gap-1">
          {drug.controlled ? <p>{t.drugControlled}</p> : drug.prescriptionOnly ? <p>{t.drugRx}</p> : null}
          <p>{t.drugNoAdvice}</p>
          <p className="text-text-muted">{t.priceNote.replace(', mis à jour le', '.')}</p>
        </div>
      </Card>
    </Container>
  );
}
