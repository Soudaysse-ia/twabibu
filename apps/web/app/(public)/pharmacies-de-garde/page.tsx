import type { Metadata } from 'next';
import Link from 'next/link';
import { Info } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { Card, Container, cn } from '@twabibu/ui';
import { addDaysToDateKey, formatDateLong, formatTime, toDateKey } from '@twabibu/utils';
import { IslandTabs, isIsland } from '@/components/pharmacy/IslandTabs';
import { PharmacyCard } from '@/components/pharmacy/PharmacyCard';
import { apiGet } from '@/lib/api-server';
import type { DutyPage } from '@/lib/pharmacy-types';

const t = fr.pharmacy;
type Params = { ile?: string; jour?: string };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const { ile } = await searchParams;
  const island = isIsland(ile) ? ile : 'ngazidja';
  return { title: `${t.dutyTitle} · ${t.islands[island]} (${t.islandsFrench[island]})`, description: t.dutyIntro };
}

/** SPEC-15 §1: duty pharmacies by island, today / tomorrow / 7 days, without an account. */
export default async function DutyPharmaciesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const island = isIsland(params.ile) ? params.ile : 'ngazidja';
  const today = toDateKey(new Date());
  const range = params.jour === 'demain' ? 'demain' : params.jour === 'semaine' ? 'semaine' : 'aujourdhui';
  const date = range === 'demain' ? addDaysToDateKey(today, 1) : today;
  const res = await apiGet<DutyPage>(`/v1/pharmacies/on-duty?island=${island}&date=${date}${range === 'semaine' ? '&week=1' : ''}`);
  const href = (i: string, j: string = range) => `/pharmacies-de-garde?ile=${i}${j === 'aujourdhui' ? '' : `&jour=${j}`}`;
  const ranges = [
    ['aujourdhui', t.today],
    ['demain', t.tomorrow],
    ['semaine', t.week],
  ] as const;

  return (
    <>
      <div className="bg-primary py-6 text-white sm:py-8">
        <Container className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-bold text-white sm:text-[28px]">{t.dutyTitle}</h1>
          <p className="max-w-2xl text-white/90">{t.dutyIntro}</p>
        </Container>
      </div>
      <Container className="flex flex-col gap-5 py-6">
        <IslandTabs current={island} href={(i) => href(i)} />
        <div role="group" aria-label="Période" className="flex flex-wrap gap-2">
          {ranges.map(([key, label]) => (
            <Link
              key={key}
              href={href(island, key)}
              aria-current={key === range ? 'true' : undefined}
              className={cn('inline-flex h-11 items-center rounded-pill border px-4 text-sm font-medium', key === range ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-navy hover:bg-background-soft')}
            >
              {label}
            </Link>
          ))}
        </div>

        {!res.ok ? (
          <Card className="text-text">{fr.errors.INTERNAL_ERROR}</Card>
        ) : (
          <>
            <p className="text-sm text-text-muted first-letter:uppercase" aria-live="polite">
              {range === 'semaine' ? `Du ${formatDateLong(new Date(`${date}T12:00:00Z`))} au ${formatDateLong(new Date(`${addDaysToDateKey(date, 6)}T12:00:00Z`))}` : formatDateLong(new Date(`${date}T12:00:00Z`))}
              {' · '}
              {res.data.duties.length} garde{res.data.duties.length > 1 ? 's' : ''}
            </p>
            {res.data.duties.length === 0 ? (
              <Card className="text-text">{t.noDuty}</Card>
            ) : (
              <ul className="grid gap-3 lg:grid-cols-2">
                {res.data.duties.map((d) => (
                  <li key={d.id}>
                    <PharmacyCard p={d.pharmacy} duty={d} />
                  </li>
                ))}
              </ul>
            )}

            {res.data.partners.length > 0 ? (
              <section aria-labelledby="partners" className="flex flex-col gap-3">
                <h2 id="partners" className="text-base font-bold">
                  {t.partner}s sur {t.islands[island]}
                </h2>
                <p className="text-sm text-text-muted">{t.partnerHint}</p>
                <ul className="grid gap-3 lg:grid-cols-2">
                  {res.data.partners.map((p) => (
                    <li key={p.id}>
                      <PharmacyCard p={p} headingLevel="h3" />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <Card className="flex gap-3 text-sm text-text">
              <Info aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-primary" />
              <div className="flex flex-col gap-1">
                <p>{t.source}</p>
                {res.data.updatedAt ? (
                  <p className="text-text-muted">
                    {t.updatedAt} {formatDateLong(new Date(res.data.updatedAt))} à {formatTime(new Date(res.data.updatedAt))}.
                  </p>
                ) : null}
                <p className="font-medium text-ink">{t.emergency}</p>
              </div>
            </Card>
            <p className="text-sm">
              <Link href={`/pharmacies?ile=${island}`} className="font-medium text-primary hover:underline">
                Toutes les pharmacies de {t.islands[island]}
              </Link>
            </p>
          </>
        )}
      </Container>
    </>
  );
}
