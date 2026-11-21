/**
 * Team and invitations of a practice (SPEC-07 §Équipe, PRO-05). Pure rules, tested on their own; TeamService applies
 * them. A practitioner joins through their own sign-up (their licence must be verified by Twabibu), so invitations
 * only bring secretaries and administrators.
 */
import type { MembershipContext, ProRole } from './permissions.js';

export const INVITATION_TTL_DAYS = 7;
export const INVITABLE_ROLES = ['SECRETARY', 'ADMIN'] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export type InvitationState = 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED';

export function invitationState(
  inv: { expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null },
  now: Date,
): InvitationState {
  if (inv.acceptedAt) return 'ACCEPTED';
  if (inv.revokedAt) return 'REVOKED';
  return inv.expiresAt <= now ? 'EXPIRED' : 'PENDING';
}

export function invitationExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 3600 * 1000);
}

/** Owner and administrators manage the team; only the owner may bring in another administrator. */
export function canInvite(actor: MembershipContext, role: InvitableRole): boolean {
  if (actor.role === 'OWNER') return true;
  return actor.role === 'ADMIN' && role === 'SECRETARY';
}

/**
 * Removing someone: managers only, never yourself (ask a colleague), never the owner, and an administrator cannot
 * remove another administrator (only the owner can).
 */
export function canRemoveMember(actor: MembershipContext, target: { id: string; role: ProRole }): boolean {
  if (actor.role !== 'OWNER' && actor.role !== 'ADMIN') return false;
  if (target.id === actor.id || target.role === 'OWNER') return false;
  if (target.role === 'ADMIN') return actor.role === 'OWNER';
  return true;
}

/** Secretaries' rights (allowed agendas, settings) can be changed by the managers. */
export function canEditSecretary(actor: MembershipContext, target: { role: ProRole }): boolean {
  return (actor.role === 'OWNER' || actor.role === 'ADMIN') && target.role === 'SECRETARY';
}
