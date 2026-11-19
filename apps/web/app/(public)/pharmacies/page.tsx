import type { Metadata } from 'next';
import Link from 'next/link';
import { fr } from '@twabibu/i18n';
import { Card, Container } from '@twabibu/ui';
import { IslandTabs, isIsland } from '@/components/pharmacy/IslandTabs';
import { PharmacyCard } from '@/components/pharmacy/PharmacyCard';
import { apiGet } from '@/lib/api-server';
import type { PharmacyCard as Card_ } from '@/lib/pharmacy-types';

const t = fr.pharmacy;
type Params = { ile?: string };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const { ile } = await searchParams;
  const island = isIsland(ile) ? ile : 'ngazidja';
  return { title: `${t.directoryTitle} · ${t.islands[island]} (${t.islandsFrench[island]})`, description: t.directoryIntro };
}

/** Pharmacy directory by island (SPEC-15 §1). Partners first, always labelled. */
export default async function PharmaciesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const island = isIsland(params.ile) ? params.ile : 'ngazidja';
  const res = await apiGet<Card_[]>(`/v1/pharmacies?island=${island}`);
  return (
    <>
      <div className="bg-primary py-6 text-white sm:py-8">
        <Container className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-bold text-white sm:text-[28px]">{t.directoryTitle}</h1>
          <p className="max-w-2xl text-white/90">{t.directoryIntro}</p>
        </Container>
      </div>
      <Container className="flex flex-col gap-5 py-6">
        <IslandTabs current={island} href={(i) => `/pharmacies?ile=${i}`} />
        <Link href={`/pharmacies-de-garde?ile=${island}`} className="self-start text-sm font-medium text-primary hover:underline">
          {t.dutyTitle} de {t.islands[island]}
        </Link>
        {!res.ok ? (
          <Card className="text-text">{fr.errors.INTERNAL_ERROR}</Card>
        ) : res.data.length === 0 ? (
          <Card className="text-text">{t.noPharmacy}</Card>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {res.data.map((p) => (
              <li key={p.id}>
                <PharmacyCard p={p} />
              </li>
            ))}
          </ul>
        )}
      </Container>
    </>
  );
}
