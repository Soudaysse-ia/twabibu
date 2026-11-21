import { z } from 'zod';
import { emailSchema } from './auth.js';

/** Team of a practice (SPEC-07, PRO-05). Practitioners join through their own sign-up, never by invitation. */
export const InvitableRole = z.enum(['SECRETARY', 'ADMIN']);
export type InvitableRole = z.infer<typeof InvitableRole>;

/** A secretary's rights: allowed agendas (all of them when absent) and settings management. */
export const SecretaryRightsSchema = z.object({
  agendaIds: z.array(z.uuid()).max(50).optional(),
  manageSettings: z.boolean().optional(),
});
export type SecretaryRights = z.infer<typeof SecretaryRightsSchema>;

export const InviteMemberSchema = SecretaryRightsSchema.extend({ email: emailSchema, role: InvitableRole });
export type InviteMember = z.infer<typeof InviteMemberSchema>;

/** Accepting an invitation: signed in with the invited address, or a sign-up token from the e-mail code. */
export const AcceptInvitationSchema = z.object({ signupToken: z.string().min(20).max(200).optional() });
export type AcceptInvitation = z.infer<typeof AcceptInvitationSchema>;
