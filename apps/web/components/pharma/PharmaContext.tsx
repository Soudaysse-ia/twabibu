'use client';

import { createContext, useContext } from 'react';
import type { PharmaMembership } from '@/lib/pharma-types';

const Ctx = createContext<PharmaMembership | null>(null);

export function PharmaProvider({ membership, children }: { membership: PharmaMembership; children: React.ReactNode }) {
  return <Ctx.Provider value={membership}>{children}</Ctx.Provider>;
}

/** The pharmacy and role of the signed-in member. */
export function usePharma(): PharmaMembership & { base: string; pharmacist: boolean } {
  const m = useContext(Ctx);
  if (!m) throw new Error('usePharma outside PharmaProvider');
  return { ...m, base: `/v1/pharma/orgs/${m.organizationId}`, pharmacist: m.role !== 'PHARMACY_STAFF' };
}
