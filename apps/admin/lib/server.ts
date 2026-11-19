import 'server-only';
import { cookies } from 'next/headers';

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

export interface AdminMe {
  email: string | null;
  roles: string[];
  areas: string[];
  mfa: { enrolled: boolean; verified: boolean };
  devCode: boolean;
}

export async function adminMe(): Promise<AdminMe | null> {
  const jar = await cookies();
  const cookie = jar
    .getAll()
    .filter((c) => c.name.startsWith('tw_'))
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join('; ');
  try {
    const res = await fetch(`${API}/v1/admin/auth/me`, { headers: cookie ? { cookie } : {}, cache: 'no-store' });
    return res.ok ? ((await res.json()) as AdminMe) : null;
  } catch {
    return null;
  }
}
