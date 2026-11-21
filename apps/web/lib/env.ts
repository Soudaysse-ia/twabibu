/** Server-side URL of the API (never exposed to the browser). */
export const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
/** Browser-side base: the site proxies /api/* to the API (see next.config.ts). */
export const API_PUBLIC_BASE = '/api';
/**
 * Public address of the site (canonical links, prescription QR codes). On a server, APP_URL from .env is read at
 * start-up, so one image works on any address (demo on a temporary address, then the real domain). The build-time
 * NEXT_PUBLIC_SITE_URL is only the fallback, e.g. in the browser where APP_URL does not exist.
 */
export const SITE_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3100';
