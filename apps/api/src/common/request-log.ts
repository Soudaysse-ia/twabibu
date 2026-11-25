import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * One line per request (INFRA-05), to find what went wrong from the id a user reads on an error, without ever
 * writing personal data: no query string, no body, and the route template (« /v1/pro/invitations/:token ») rather
 * than the real path, which can hold a sign-in link or an invitation token.
 */

export const REQUEST_ID_HEADER = 'x-request-id';

/** An id from Caddy or the site is reused only when it looks like one: anything else could inject text in the logs. */
export function requestIdFrom(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  return value && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : randomUUID();
}

/**
 * The route template when Express matched one; otherwise (404) the path with every segment that could be an id,
 * a token or a name replaced by « :x ».
 */
export function loggedPath(req: Pick<Request, 'baseUrl' | 'path'> & { route?: { path?: unknown } }): string {
  if (req.route && typeof req.route.path === 'string') return `${req.baseUrl ?? ''}${req.route.path}`;
  return (req.path || '/')
    .split('/')
    .map((s) => (s === '' || /^[a-z-]{1,24}$/.test(s) || /^v\d{1,2}$/.test(s) ? s : ':x'))
    .join('/')
    .replace(/^:x$/, '/');
}

/** Liveness probes run every few seconds: logging them would drown everything else. */
const QUIET = new Set(['/health', '/ready', '/v1/health', '/v1/ready']);

export function requestLog(logger = new Logger('Request')) {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = requestIdFrom(req.headers[REQUEST_ID_HEADER]);
    res.locals.requestId = id;
    res.setHeader('X-Request-Id', id);
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const path = loggedPath(req);
      if (QUIET.has(path)) return;
      const ms = Number((process.hrtime.bigint() - started) / 1_000_000n);
      const line = `${req.method} ${path} ${res.statusCode} ${ms}ms id=${id}`;
      if (res.statusCode >= 500) logger.error(line);
      else if (res.statusCode >= 400 && res.statusCode !== 401 && res.statusCode !== 404) logger.warn(line);
      else logger.log(line);
    });
    next();
  };
}
