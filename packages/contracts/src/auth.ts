import { z } from 'zod';

export const OtpPurpose = z.enum(['SIGNUP', 'LOGIN', 'PHONE_CHANGE', 'BOOKING_GUEST']);
export type OtpPurpose = z.infer<typeof OtpPurpose>;

/** Phone numbers travel in E.164; normalise with `normalizePhone` from @twabibu/utils before validating. */
export const e164Schema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Expected an E.164 phone number');

/** Sign-in identifier (ADR-016): an e-mail address, lower case. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const OtpRequestSchema = z.object({ email: emailSchema, purpose: OtpPurpose });
export type OtpRequest = z.infer<typeof OtpRequestSchema>;

export const OtpVerifySchema = OtpRequestSchema.extend({ code: z.string().regex(/^\d{6}$/) });
export type OtpVerify = z.infer<typeof OtpVerifySchema>;
