import 'server-only';
import { cookies } from 'next/headers';
import { API_INTERNAL_URL } from './env';

/** Server-side GET to the API, forwarding the visitor's cookies (session, booking session). */
export async function apiGet<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .filter((c) => c.name.startsWith('tw_'))
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join('; ');
  try {
    const res = await fetch(`${API_INTERNAL_URL}${path}`, { headers: cookieHeader ? { cookie: cookieHeader } : {}, cache: 'no-store' });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 503 };
  }
}
