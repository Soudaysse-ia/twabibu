import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  // Not indexed until the public launch (phase 3).
  return { rules: { userAgent: '*', disallow: '/' }, host: SITE_URL };
}
