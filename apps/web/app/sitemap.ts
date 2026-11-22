import type { MetadataRoute } from 'next';
import { HELP_ARTICLES } from '@twabibu/i18n';
import { apiGetPublic } from '@/lib/api-server';
import { SITE_URL } from '@/lib/env';
import type { SitemapData } from '@/lib/types';

// Rebuilt at most once an hour: new practitioners appear in search engines within the day.
export const revalidate = 3600;

const STATIC_PAGES = [
  '/',
  '/pharmacies-de-garde',
  '/pharmacies',
  '/pro',
  '/pharma',
  '/aide',
  '/contact',
  '/a-propos',
  '/cgu',
  '/confidentialite',
  '/mentions-legales',
];

/** /sitemap.xml (SEARCH-08): public pages, « speciality × place » pages with results, verified profiles. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await apiGetPublic<SitemapData>('/v1/search/sitemap', revalidate);
  const dynamicPages = data.ok
    ? [
        ...data.data.pages.map((p) => ({
          url: `${SITE_URL}${p.url}`,
          changeFrequency: 'daily' as const,
          priority: p.kind === 'LOCALITY' ? 0.8 : 0.7,
        })),
        ...data.data.practitioners.map((p) => ({
          url: `${SITE_URL}${p.url}`,
          lastModified: new Date(p.updatedAt),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        })),
      ]
    : [];
  return [
    ...STATIC_PAGES.map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: 'weekly' as const,
      priority: path === '/' ? 1 : 0.5,
    })),
    ...HELP_ARTICLES.map((a) => ({
      url: `${SITE_URL}/aide/${a.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
    ...dynamicPages,
  ];
}
