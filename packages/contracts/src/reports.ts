import { z } from 'zod';

/** Reporting a practitioner's profile (SPEC-02 §Sections, PROFILE-06; handled in the back-office, ADMIN-07). */
export const ReportReason = z.enum(['WRONG_INFO', 'CLOSED', 'NOT_A_PRACTITIONER', 'BEHAVIOUR', 'OTHER']);
export type ReportReason = z.infer<typeof ReportReason>;

// Only tab and line breaks among control characters: anything else would break the back-office display.
const CONTROL = /\p{Cc}/u;

export const ProfileReportSchema = z.object({
  reason: ReportReason,
  details: z
    .string()
    .trim()
    .max(1000)
    .refine((s) => !CONTROL.test(s.replace(/[\t\r\n]/g, '')))
    .optional(),
  /** Honeypot, as on the contact form: filled in by robots only, accepted silently and dropped. */
  website: z.string().max(200).optional(),
});
export type ProfileReport = z.infer<typeof ProfileReportSchema>;

/** Back-office decision: ignore, write to the practitioner, or take the profile off the site. */
export const ReportDecisionSchema = z.object({ action: z.enum(['DISMISS', 'CONTACT', 'UNPUBLISH']) });
export type ReportDecision = z.infer<typeof ReportDecisionSchema>;
