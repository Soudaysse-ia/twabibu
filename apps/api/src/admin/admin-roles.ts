/**
 * Back-office roles (SPEC-11 §Accès). Pure functions, tested in admin-roles.test.ts.
 * No area gives access to medical records: the back-office never reads clinical data.
 */
export const ADMIN_ROLES = ['SUPERADMIN', 'VERIFIER', 'SUPPORT', 'FINANCE'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export type AdminArea = 'dashboard' | 'verification' | 'structures' | 'pharmacies' | 'referentials' | 'patients' | 'notifications' | 'placements' | 'audit' | 'flags';

const AREAS: Record<AdminArea, readonly AdminRole[]> = {
  dashboard: ['VERIFIER', 'SUPPORT', 'FINANCE'],
  verification: ['VERIFIER'],
  structures: ['VERIFIER', 'SUPPORT'],
  pharmacies: ['VERIFIER'],
  referentials: ['VERIFIER'],
  patients: ['SUPPORT'],
  notifications: ['SUPPORT'],
  placements: ['FINANCE'],
  audit: [],
  flags: [],
};

/** SUPERADMIN can do everything; audit log and feature flags are SUPERADMIN only. */
export function canAccess(roles: readonly string[], area: AdminArea): boolean {
  if (roles.includes('SUPERADMIN')) return true;
  return AREAS[area].some((r) => roles.includes(r));
}

export function areasFor(roles: readonly string[]): AdminArea[] {
  return (Object.keys(AREAS) as AdminArea[]).filter((a) => canAccess(roles, a));
}

/** A second factor validated more than 12 hours ago must be entered again. */
export const MFA_MAX_AGE_MS = 12 * 3600 * 1000;
export const mfaFresh = (verifiedAt: Date | null | undefined, now = new Date()) => !!verifiedAt && now.getTime() - verifiedAt.getTime() < MFA_MAX_AGE_MS;
