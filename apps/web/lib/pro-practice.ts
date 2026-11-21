/**
 * Which practice the Pro space shows when the account belongs to several (owner of one, invited in another).
 * The choice is a plain cookie: it grants nothing, the API checks the membership on every /v1/pro/orgs/:orgId route.
 */
export const PRO_PRACTICE_COOKIE = 'tw_pro_org';
const ONE_YEAR = 365 * 24 * 3600;

/** The membership named by the cookie when the account still has it, otherwise the first one. */
export function currentMembership<T extends { organizationId: string }>(
  memberships: readonly T[],
  chosen: string | undefined,
): T | undefined {
  return memberships.find((m) => m.organizationId === chosen) ?? memberships[0];
}

/** Browser side: remember the practice for the next pages. */
export function rememberPractice(organizationId: string): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${PRO_PRACTICE_COOKIE}=${encodeURIComponent(organizationId)}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax${secure}`;
}
