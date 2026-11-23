import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { buttonClasses, Container } from '@twabibu/ui';
import { SearchResults } from '@/components/search/SearchResults';
import { SearchBar } from '@/components/SearchBar';
import { apiGetPublic } from '@/lib/api-server';
import { SITE_URL } from '@/lib/env';
import type { SearchResult, SitemapData } from '@/lib/types';

type Params = { specialite: string; localite: string };
type Search = { page?: string };

// Same freshness as the spec (SPEC-01 §10: regenerated every 10 minutes).
const REVALIDATE = 600;
const t = fr.seo;

/** The page exists only for a speciality and a place with at least one verified practitioner (SPEC-01 §10). */
async function landing(specialite: string, localite: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(specialite) || !/^[a-z0-9-]{1,80}$/.test(localite)) return null;
  const sitemap = await apiGetPublic<SitemapData>('/v1/search/sitemap', REVALIDATE);
  if (!sitemap.ok) return null;
  const url = `/${specialite}/${localite}`;
  const page = sitemap.data.pages.find((p) => p.url === url);
  return page ? { page, all: sitemap.data.pages } : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { specialite, localite } = await params;
  const found = await landing(specialite, localite);
  if (!found) return { title: fr.notFound.title };
  const { page } = found;
  return {
    title: t.title(page.speciality, page.place),
    description: t.description(page.speciality, page.place, page.count),
    alternates: { canonical: page.url },
  };
}

/** SEO landing page « Pédiatre à Moroni » (SPEC-01 §10, SEARCH-08): results, internal links, structured data. */
export default async function LandingPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { specialite, localite } = await params;
  const found = await landing(specialite, localite);
  if (!found) notFound();
  const { page: landingPage, all } = found;
  const page = Math.min(100, Math.max(1, Number((await searchParams).page) || 1));

  const result = await apiGetPublic<SearchResult>(
    `/v1/search/practitioners?q=${specialite}&ou=${localite}&page=${page}`,
    REVALIDATE,
  );
  if (!result.ok) notFound();
  const { items, total, pageSize } = result.data;
  const pages = Math.ceil(total / pageSize);
  if (page > 1 && items.length === 0) notFound();

  const otherPlaces = all.filter(
    (p) => p.url.startsWith(`/${specialite}/`) && p.url !== landingPage.url && p.kind === landingPage.kind,
  );
  const otherSpecialities = all.filter((p) => p.url.endsWith(`/${localite}`) && p.url !== landingPage.url);
  const pageHref = (p: number) => (p === 1 ? landingPage.url : `${landingPage.url}?page=${p}`);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: t.heading(landingPage.speciality, landingPage.place),
    numberOfItems: total,
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: (page - 1) * pageSize + i + 1,
      item: {
        '@type': 'Physician',
        name: item.displayName,
        url: `${SITE_URL}${item.url}`,
        medicalSpecialty: item.speciality.name,
        address: item.practice
          ? {
              '@type': 'PostalAddress',
              streetAddress: item.practice.addressLine,
              addressLocality: item.practice.locality,
              addressCountry: 'KM',
            }
          : undefined,
      },
    })),
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t.home, item: `${SITE_URL}/` },
      {
        '@type': 'ListItem',
        position: 2,
        name: t.heading(landingPage.speciality, landingPage.place),
        item: `${SITE_URL}${landingPage.url}`,
      },
    ],
  };

  return (
    <>
      {/* JSON is escaped for HTML (no « < »): names come from practitioners' profiles. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([jsonLd, breadcrumbLd]).replace(/</g, '\\u003c') }}
      />
      <div className="bg-primary py-4">
        <Container>
          <SearchBar initialWhat={landingPage.speciality} initialWhere={landingPage.place} />
        </Container>
      </div>
      <Container className="flex flex-col gap-5 py-6">
        <nav aria-label={t.breadcrumb}>
          <ol className="flex flex-wrap items-center gap-1 text-sm text-text-muted">
            <li>
              <Link href="/" className="hover:text-primary hover:underline">
                {t.home}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight size={14} />
            </li>
            <li aria-current="page" className="text-text">
              {t.heading(landingPage.speciality, landingPage.place)}
            </li>
          </ol>
        </nav>
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold sm:text-3xl">
            {t.heading(landingPage.speciality, landingPage.place)}
          </h1>
          <p className="max-w-3xl text-text">{t.intro(landingPage.speciality, landingPage.place, total)}</p>
          <Link
            href={`/recherche?q=${specialite}&ou=${localite}`}
            className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline"
          >
            {t.refine}
          </Link>
        </header>

        <SearchResults items={items} offset={(page - 1) * pageSize} />

        {pages > 1 ? (
          <nav aria-label={t.pagination} className="flex items-center justify-between gap-2">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                {t.previous}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-text-muted">{t.pageOf(page, pages)}</span>
            {page < pages ? (
              <Link href={pageHref(page + 1)} className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                {t.next}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}

        {otherSpecialities.length || otherPlaces.length ? (
          <div className="grid gap-6 border-t border-border pt-6 sm:grid-cols-2">
            {otherSpecialities.length ? (
              <nav aria-labelledby="seo-same-place">
                <h2 id="seo-same-place" className="mb-2 text-base font-bold">
                  {t.samePlaceOther(landingPage.place)}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {otherSpecialities.map((p) => (
                    <li key={p.url}>
                      <Link
                        href={p.url}
                        className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm text-text hover:border-primary hover:text-primary"
                      >
                        {p.speciality}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
            {otherPlaces.length ? (
              <nav aria-labelledby="seo-same-speciality">
                <h2 id="seo-same-speciality" className="mb-2 text-base font-bold">
                  {t.sameSpecialityOther(landingPage.speciality)}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {otherPlaces.map((p) => (
                    <li key={p.url}>
                      <Link
                        href={p.url}
                        className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm text-text hover:border-primary hover:text-primary"
                      >
                        {p.place}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </div>
        ) : null}
      </Container>
    </>
  );
}
