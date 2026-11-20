import type { NextConfig } from 'next';
import { fileURLToPath } from 'node:url';

/** Back-office (SPEC-11): separate app, never indexed, same-origin API proxy like the public site. */
const dev = process.env.NODE_ENV !== 'production';

/**
 * Content-Security-Policy (SEC-03). Scripts, styles, fonts and API calls come from this origin only: the back-office
 * loads no third-party resource.
 * Next inlines its bootstrap scripts, hence 'unsafe-inline' (a nonce would force dynamic rendering of every page);
 * the policy still blocks any external script, exfiltration to another host, framing and plugin content.
 * Development adds what React Refresh needs (eval, websocket).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
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
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
