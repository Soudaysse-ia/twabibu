import { z } from 'zod';

/** Every error the API can return. User-facing messages live in @twabibu/i18n (`errors.<CODE>`). */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  // auth
  'OTP_INVALID',
  'OTP_EXPIRED',
  'OTP_TOO_MANY_ATTEMPTS',
  'PHONE_ALREADY_REGISTERED',
  'INVALID_CREDENTIALS',
  // booking
  'SLOT_UNAVAILABLE',
  'SLOT_LOCK_EXPIRED',
  'CANCELLATION_DEADLINE_PASSED',
  'NEW_PATIENTS_NOT_ACCEPTED',
  'TOO_MANY_ACTIVE_APPOINTMENTS',
  'BOOKING_BLOCKED',
  'ONLINE_BOOKING_DISABLED',
  // medical record & prescriptions
  'RECORD_CONSENT_REQUIRED',
  'ALLERGY_CONFLICT',
  'PRESCRIPTION_IMMUTABLE',
  'PRESCRIBER_NOT_ALLOWED',
  // pharmacies
  'CONTROLLED_PRODUCT_NOT_ORDERABLE',
  'PRESCRIPTION_REQUIRED',
  'PHARMACY_NOT_VERIFIED',
  'PRODUCT_UNAVAILABLE',
  'DELIVERY_NOT_AVAILABLE',
  'ORDER_STATUS_INVALID',
  // team
  'INVITATION_INVALID',
  'INVITATION_EXPIRED',
  'INVITATION_EMAIL_MISMATCH',
] as const;

export const ErrorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiErrorSchema = z.object({
  code: ErrorCode,
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
