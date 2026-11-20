import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

const dev = process.env.NODE_ENV !== 'production';

/**
 * Content-Security-Policy (SEC-03). Scripts, styles, fonts and API calls come from this origin only, plus the
 * OpenStreetMap tiles of the search map (ADR-007).
 * Next inlines its bootstrap scripts, hence 'unsafe-inline' (a nonce would force dynamic rendering of every page);
 * the policy still blocks any external script, exfiltration to another host, framing and plugin content.
 * Development adds what React Refresh needs (eval, websocket).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "font-src 'self'",
  `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@twabibu/ui'],
  turbopack: { root: fileURLToPath(new URL('../..', import.meta.url)) },
  // Docker images run the self-contained server (infra/docker/next.Dockerfile); local `next start` is unchanged.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const, outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)) } : {}),
  poweredByHeader: false,
  // The browser talks to the API through the site's own origin: same-site cookies, no CORS.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${process.env.API_INTERNAL_URL ?? 'http://localhost:4000'}/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        ],
      },
    ];
  },
};

export default config;
