import 'server-only';
import { cookies, headers } from 'next/headers';
import { API_INTERNAL_URL } from './env';

/**
 * Server-side GET to the API, forwarding the visitor's cookies (session, booking session) and address. Without the
 * address every page render would count against the site's own address in the API rate limits (SEC, api.md). Caddy
 * writes X-Forwarded-For with the visitor's address only, replacing anything the client sent.
 */
export async function apiGet<T>(
  path: string,
): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .filter((c) => c.name.startsWith('tw_'))
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join('; ');
  const visitor = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim();
  const forward: Record<string, string> = {};
  if (cookieHeader) forward.cookie = cookieHeader;
  if (visitor) forward['x-forwarded-for'] = visitor;
  try {
    const res = await fetch(`${API_INTERNAL_URL}${path}`, { headers: forward, cache: 'no-store' });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 503 };
  }
}
