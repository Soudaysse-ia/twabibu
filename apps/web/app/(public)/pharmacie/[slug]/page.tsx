import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fr } from '@twabibu/i18n';
import { Card, Container } from '@twabibu/ui';
import { formatKmf } from '@twabibu/utils';
import { PharmacyCard, dutyWindow } from '@/components/pharmacy/PharmacyCard';
import { PharmacyCatalogue } from '@/components/pharmacy/PharmacyCatalogue';
import { apiGet } from '@/lib/api-server';
import type { PharmacyProfile } from '@/lib/pharmacy-types';

const t = fr.pharmacy;
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const res = await apiGet<PharmacyProfile>(`/v1/pharmacies/${encodeURIComponent(slug)}`);
  if (!res.ok) return { title: t.directoryTitle };
  return { title: `${res.data.name} · ${res.data.locality?.name ?? ''}`, description: `Horaires, gardes, catalogue et commande en ligne : ${res.data.name}.` };
}

/** Public pharmacy page (SPEC-15 §1-2): card, hours, delivery zones, upcoming duties, catalogue. */
export default async function PharmacyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await apiGet<PharmacyProfile>(`/v1/pharmacies/${encodeURIComponent(slug)}`);
  if (!res.ok) notFound();
  const p = res.data;
  return (
    <Container className="flex flex-col gap-6 py-6 sm:py-8">
      <nav aria-label="Fil d’Ariane" className="text-sm text-text-muted">
        <Link href={`/pharmacies?ile=${p.island?.slug ?? 'ngazidja'}`} className="text-primary hover:underline">
          {t.directoryTitle}
        </Link>
        {' › '}
        {p.name}
      </nav>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <PharmacyCard p={p} headingLevel="h2" />
          {p.description ? <p className="text-text">{p.description}</p> : null}
          <PharmacyCatalogue pharmacy={p} />
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="flex flex-col gap-2">
            <h2 className="font-heading text-sm font-bold text-navy">{t.hours}</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {DAYS.map((d) => (
                <div key={d} className="contents">
                  <dt className="text-text">{t.days[d]}</dt>
                  <dd className="text-right text-ink">{p.openingHours[d]?.length ? p.openingHours[d]!.map(([a, b]) => `${a}–${b}`).join(', ') : 'Fermée'}</dd>
                </div>
              ))}
            </dl>
          </Card>
          {p.upcomingDuties.length ? (
            <Card className="flex flex-col gap-2">
              <h2 className="font-heading text-sm font-bold text-navy">{t.upcomingDuties}</h2>
              <ul className="flex flex-col gap-1 text-sm text-ink">
                {p.upcomingDuties.map((d) => (
                  <li key={d.startsAt} className="first-letter:uppercase">
                    {dutyWindow(d.startsAt, d.endsAt)}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {p.deliveryZones.length ? (
            <Card className="flex flex-col gap-2">
              <h2 className="font-heading text-sm font-bold text-navy">{t.zones}</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {p.deliveryZones.map((z) => (
                  <li key={z.localityId} className="flex justify-between gap-3">
                    <span className="text-text">{z.locality}</span>
                    <span className="text-ink">{formatKmf(z.feeKmf)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </Container>
  );
}
