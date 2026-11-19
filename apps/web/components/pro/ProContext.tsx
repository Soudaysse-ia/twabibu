'use client';

import { createContext, useContext } from 'react';
import type { ProMembership } from '@/lib/pro-types';

const Ctx = createContext<ProMembership | null>(null);

export function ProProvider({ membership, children }: { membership: ProMembership; children: React.ReactNode }) {
  return <Ctx.Provider value={membership}>{children}</Ctx.Provider>;
}

/** The practice and role the signed-in professional is working in. */
export function useMembership(): ProMembership {
  const m = useContext(Ctx);
  if (!m) throw new Error('useMembership outside ProProvider');
  return m;
}

export function canOverbook(m: ProMembership): boolean {
  return m.role !== 'SECRETARY';
}
