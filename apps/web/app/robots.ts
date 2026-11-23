import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/env';

// Read at request time: the same image serves the demo (never indexed) and production (indexed after launch).
export const dynamic = 'force-dynamic';

/**
 * Closed to search engines unless ALLOW_INDEXING=true in the server's .env, to set at the public launch only (legal
 * texts validated, real data). Private spaces stay out either way.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.ALLOW_INDEXING !== 'true')
    return { rules: { userAgent: '*', disallow: '/' }, host: SITE_URL };
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/mon-compte',
        '/connexion',
        '/pro/app',
        '/pro/invitation',
        '/pharma/app',
        '/demo',
        '/recherche',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
