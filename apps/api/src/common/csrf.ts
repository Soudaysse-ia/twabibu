/**
 * Cross-site request forgery guard (SEC-03, ADR-021). Session cookies are SameSite=Lax, which already stops most
 * cross-site writes; this check also refuses writes coming from another site sharing the parent domain (a
 * compromised sub-domain, an old preview) and from browsers that ignore SameSite.
 *
 * Browsers always send Origin on POST/PUT/PATCH/DELETE, and Sec-Fetch-Site on all requests. Clients that send
 * neither (mobile app with a bearer token, server-side calls, tests) are not browsers and cannot carry a victim's
 * cookie by accident, so they pass.
 */
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export type CsrfVerdict = { allowed: true } | { allowed: false; reason: string };

/** Pure decision, tested on its own. `allowedOrigins` are full origins such as https://twabibu.km. */
export function checkCrossSiteWrite(
  method: string,
  headers: { origin?: string; 'sec-fetch-site'?: string },
  allowedOrigins: ReadonlySet<string>,
): CsrfVerdict {
  if (SAFE_METHODS.has(method.toUpperCase())) return { allowed: true };
  const origin = headers.origin;
  if (origin !== undefined) {
    return allowedOrigins.has(origin) ? { allowed: true } : { allowed: false, reason: `origin ${origin} not allowed` };
  }
  const site = headers['sec-fetch-site'];
  if (site === 'cross-site' || site === 'same-site') return { allowed: false, reason: `sec-fetch-site ${site}` };
  return { allowed: true };
}

/** Normalises configured URLs to origins (scheme + host + port), ignoring any path. */
export function originsFrom(urls: readonly string[]): Set<string> {
  return new Set(urls.map((u) => new URL(u).origin));
}

export function csrfMiddleware(allowedOrigins: ReadonlySet<string>) {
  const logger = new Logger('Csrf');
  return (req: Request, res: Response, next: NextFunction): void => {
    const verdict = checkCrossSiteWrite(
      req.method,
      { origin: req.get('origin'), 'sec-fetch-site': req.get('sec-fetch-site') },
      allowedOrigins,
    );
    if (verdict.allowed) return next();
    // Same body shape as ApiException (ApiErrorSchema). The reason is logged, never returned; no query string.
    logger.warn(`Refused ${req.method} ${req.path}: ${verdict.reason}`);
    res.status(403).json({ code: 'FORBIDDEN', message: 'Cross-site request refused' });
  };
}
