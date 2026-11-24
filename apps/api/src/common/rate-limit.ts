/**
 * Per-address rate limits for public routes (securite-et-donnees-sante.md §5, api.md « Limites de débit »).
 * Fixed one-minute windows counted in Redis. Usage on a route: `@RateLimit('search')` + `@UseGuards(RateLimitGuard)`.
 *
 * The address is req.ip: behind Caddy and the site it is the visitor (trust proxy in bootstrap.ts, X-Forwarded-For
 * written by Caddy and forwarded by the site's server-side calls). If Redis is down the request goes through: these
 * routes only read public data, and the site must keep working.
 */
import { CanActivate, ExecutionContext, Injectable, Logger, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { RedisService } from '../redis/redis.service.js';
import { ApiException } from './api-exception.js';

/** Requests per minute and per address. Generous for a person, low enough to stop scraping and floods. */
export const RATE_LIMITS = {
  /** « Quoi » / « où » autocomplete: one call per keystroke. */
  autocomplete: 120,
  /** Results page with the 5-day slot grid: the most expensive public query. */
  search: 60,
  /** Practitioner profile and its slots, islands, localities, specialities, pharmacies, drugs. */
  publicRead: 120,
  /** Public check of a prescription code (QR): codes cannot be guessed, and this keeps it that way. */
  prescriptionCheck: 30,
  /** Reporting a profile: a person sends one, a robot many. */
  report: 5,
  /** Team invitation link (view and accept). */
  invitation: 30,
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

const WINDOW_SECONDS = 60;
const RATE_LIMIT_KEY = 'twabibu:rate-limit';

export const RateLimit = (name: RateLimitName) => SetMetadata(RATE_LIMIT_KEY, name);

/** Redis key for one address in the current window. Pure, tested on its own. */
export function rateLimitKey(name: RateLimitName, ip: string, nowMs: number): string {
  const window = Math.floor(nowMs / 1000 / WINDOW_SECONDS);
  return `twabibu:rl:${name}:${ip}:${window}`;
}

/** Seconds until the current window ends (at least 1), for the Retry-After header. */
export function secondsToNextWindow(nowMs: number): number {
  return Math.max(1, WINDOW_SECONDS - (Math.floor(nowMs / 1000) % WINDOW_SECONDS));
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger('RateLimit');

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const name = this.reflector.getAllAndOverride<RateLimitName | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!name) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    const key = rateLimitKey(name, req.ip ?? 'unknown', now);

    let count: number;
    try {
      const replies = await this.redis.client
        .multi()
        .incr(key)
        .expire(key, WINDOW_SECONDS + 5)
        .exec();
      const [error, incr] = replies?.[0] ?? [new Error('no reply'), null];
      if (error || typeof incr !== 'number') throw error ?? new Error('unexpected reply');
      count = incr;
    } catch (error) {
      this.logger.warn(`Rate limit skipped (${name}): ${(error as Error).message}`);
      return true;
    }
    if (count <= RATE_LIMITS[name]) return true;

    if (count === RATE_LIMITS[name] + 1) this.logger.warn(`Rate limit reached (${name}) for one address`);
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Retry-After', String(secondsToNextWindow(now)));
    throw new ApiException('RATE_LIMITED', 'Too many requests, retry later');
  }
}
