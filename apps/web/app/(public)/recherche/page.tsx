import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { REFERENCE_ISLANDS, REFERENCE_LOCALITIES, REFERENCE_SPECIALITIES } from '@twabibu/contracts';
import { fr } from '@twabibu/i18n';
import { buttonClasses, Card, Container } from '@twabibu/ui';
import { PractitionerCard } from '@/components/PractitionerCard';
import { SearchBar } from '@/components/SearchBar';
import { apiGet } from '@/lib/api-server';
import type { SearchResult } from '@/lib/types';

type Params = { q?: string; ou?: string; lat?: string; lng?: string; page?: string };

function whatLabel(q?: string): string | null {
  if (!q) return null;
  return REFERENCE_SPECIALITIES.find((s) => s.slug === q)?.name ?? q.replace(/^soignant:/, '');
}

function whereLabel(ou?: string): string | null {
  if (!ou) return null;
  if (ou === 'autour-de-moi') return fr.search.aroundMe;
  return REFERENCE_ISLANDS.find((i) => i.slug === ou)?.name ?? REFERENCE_LOCALITIES.find((l) => l.slug === ou)?.name ?? ou;
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<Params> }): Promise<Metadata> {
  const { q, ou } = await searchParams;
  const what = whatLabel(q) ?? 'Soignants';
  const where = whereLabel(ou);
  return { title: `${what}${where ? ` à ${where}` : ' aux Comores'} : prenez rendez-vous en ligne`, robots: { index: false } };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const query = new URLSearchParams();
  for (const key of ['q', 'ou', 'lat', 'lng'] as const) if (params[key]) query.set(key, params[key]!);
  query.set('page', String(page));
  const result = await apiGet<SearchResult>(`/v1/search/practitioners?${query}`);
  const what = whatLabel(params.q);
  const where = whereLabel(params.ou);
  const pages = result.ok ? Math.ceil(result.data.total / result.data.pageSize) : 0;
  const pageHref = (p: number) => {
    const next = new URLSearchParams(query);
    next.set('page', String(p));
    return `/recherche?${next}`;
  };

  return (
    <>
      <div className="bg-primary py-4">
        <Container>
          <SearchBar initialWhat={what ?? ''} initialWhere={where ?? ''} />
        </Container>
      </div>
      <Container className="flex flex-col gap-4 py-6">
        <div>
          <h1 className="text-xl font-bold">
            {what ?? 'Soignants'} {where ? `à ${where}` : 'aux Comores'}
          </h1>
          {result.ok ? (
            <p className="text-sm text-text-muted">
              {result.data.total} résultat{result.data.total > 1 ? 's' : ''} · prenez rendez-vous en ligne
            </p>
          ) : null}
        </div>

        {!result.ok ? (
          <Card className="text-text">Les résultats sont momentanément indisponibles. Réessayez dans un instant.</Card>
        ) : result.data.total === 0 ? (
          <Card className="flex flex-col items-start gap-3 p-6">
            <SearchX aria-hidden="true" size={28} className="text-text-muted" />
            <h2 className="text-lg font-bold">Aucun soignant ne correspond à votre recherche</h2>
            <p className="text-text">Élargissez la zone à toute l’île ou essayez une autre spécialité.</p>
            <div className="flex flex-wrap gap-2">
              {params.q ? (
                <Link href={`/recherche?q=${encodeURIComponent(params.q)}`} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                  Chercher dans toutes les Comores
                </Link>
              ) : null}
              <Link href="/pro" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
                Vous êtes soignant ? Inscrivez votre cabinet
              </Link>
            </div>
          </Card>
        ) : (
          <>
            <ul className="flex flex-col gap-4">
              {result.data.items.map((item) => (
                <li key={item.id}>
                  <PractitionerCard item={item} />
                </li>
              ))}
            </ul>
            {pages > 1 ? (
              <nav aria-label="Pagination" className="flex items-center justify-between gap-2">
                {page > 1 ? (
                  <Link href={pageHref(page - 1)} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                    Page précédente
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-sm text-text-muted">
                  Page {page} sur {pages}
                </span>
                {page < pages ? (
                  <Link href={pageHref(page + 1)} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                    Page suivante
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        )}
      </Container>
    </>
  );
}
