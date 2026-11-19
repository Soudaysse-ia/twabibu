/** Server-side URL of the API (never exposed to the browser). */
export const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
/** Browser-side base: the site proxies /api/* to the API (see next.config.ts). */
export const API_PUBLIC_BASE = '/api';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3100';
