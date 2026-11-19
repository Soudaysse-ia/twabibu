import { Injectable } from '@nestjs/common';
import type { Interval } from '@twabibu/availability';
import { RedisService } from '../redis/redis.service.js';

export const LOCK_TTL_SECONDS = 10 * 60;

export interface SlotLock {
  agendaId: string;
  startsAt: Date;
  endsAt: Date;
  motiveId: string;
  sessionId: string;
}

const key = (agendaId: string, startsAt: Date) => `twabibu:lock:${agendaId}:${startsAt.toISOString()}`;

// Delete the key only if it still belongs to this booking session.
const RELEASE_IF_OWNER = `
local v = redis.call('GET', KEYS[1])
if v and string.sub(v, 1, string.len(ARGV[1])) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0`;

/**
 * Holds a slot for 10 minutes while the patient signs in (SPEC-12 §Verrous).
 * Value format: `<sessionId>|<motiveId>|<endsAtISO>`. The SQL exclusion constraint remains the final guard.
 */
@Injectable()
export class SlotLockService {
  constructor(private readonly redis: RedisService) {}

  /** True when the slot is now held by this session (also true if it already was). */
  async acquire(lock: SlotLock): Promise<boolean> {
    const k = key(lock.agendaId, lock.startsAt);
    const value = `${lock.sessionId}|${lock.motiveId}|${lock.endsAt.toISOString()}`;
    const ok = await this.redis.client.set(k, value, 'EX', LOCK_TTL_SECONDS, 'NX');
    if (ok === 'OK') return true;
    const current = await this.redis.client.get(k);
    if (current?.startsWith(`${lock.sessionId}|`)) {
      await this.redis.client.set(k, value, 'EX', LOCK_TTL_SECONDS);
      return true;
    }
    return false;
  }

  async release(agendaId: string, startsAt: Date, sessionId: string): Promise<void> {
    await this.redis.client.eval(RELEASE_IF_OWNER, 1, key(agendaId, startsAt), `${sessionId}|`);
  }

  async owner(agendaId: string, startsAt: Date): Promise<{ sessionId: string; motiveId: string; ttlSeconds: number } | null> {
    const k = key(agendaId, startsAt);
    const [value, ttl] = await Promise.all([this.redis.client.get(k), this.redis.client.ttl(k)]);
    if (!value) return null;
    const [sessionId, motiveId] = value.split('|') as [string, string];
    return { sessionId, motiveId, ttlSeconds: ttl };
  }

  /** Locks currently held on an agenda, optionally ignoring one booking session's own locks. */
  async list(agendaId: string, exceptSessionId?: string): Promise<(Interval & { sessionId: string })[]> {
    const out: (Interval & { sessionId: string })[] = [];
    const prefix = `twabibu:lock:${agendaId}:`;
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.client.scan(cursor, 'MATCH', `twabibu:lock:${agendaId}:*`, 'COUNT', 200);
      cursor = next;
      if (keys.length === 0) continue;
      const values = await this.redis.client.mget(...keys);
      keys.forEach((k, i) => {
        const v = values[i];
        if (!v) return;
        const [sessionId, , endsAt] = v.split('|') as [string, string, string];
        if (sessionId === exceptSessionId) return;
        out.push({ startsAt: new Date(k.slice(prefix.length)), endsAt: new Date(endsAt), sessionId });
      });
    } while (cursor !== '0');
    return out;
  }

  /** Frees every other lock this session holds on the agenda (one slot at a time per patient). */
  async releaseOthers(agendaId: string, sessionId: string, keep: Date): Promise<void> {
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.client.scan(cursor, 'MATCH', `twabibu:lock:${agendaId}:*`, 'COUNT', 200);
      cursor = next;
      for (const k of keys) {
        if (k.endsWith(keep.toISOString())) continue;
        await this.redis.client.eval(RELEASE_IF_OWNER, 1, k, `${sessionId}|`);
      }
    } while (cursor !== '0');
  }
}
