import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@twabibu/contracts';

const STATUS: Partial<Record<ErrorCode, HttpStatus>> = {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  UNAUTHENTICATED: HttpStatus.UNAUTHORIZED,
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  RECORD_CONSENT_REQUIRED: HttpStatus.FORBIDDEN,
  PRESCRIBER_NOT_ALLOWED: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  SLOT_UNAVAILABLE: HttpStatus.CONFLICT,
  PRESCRIPTION_IMMUTABLE: HttpStatus.CONFLICT,
  ORDER_STATUS_INVALID: HttpStatus.CONFLICT,
  INVITATION_INVALID: HttpStatus.NOT_FOUND,
  INVITATION_EXPIRED: HttpStatus.GONE,
  INVITATION_EMAIL_MISMATCH: HttpStatus.FORBIDDEN,
  PHARMACY_NOT_VERIFIED: HttpStatus.FORBIDDEN,
  PHONE_ALREADY_REGISTERED: HttpStatus.CONFLICT,
  SLOT_LOCK_EXPIRED: HttpStatus.GONE,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  OTP_TOO_MANY_ATTEMPTS: HttpStatus.TOO_MANY_REQUESTS,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
};

/** The only exception business code should throw. The body always matches ApiErrorSchema. */
export class ApiException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    status: HttpStatus = STATUS[code] ?? HttpStatus.UNPROCESSABLE_ENTITY,
  ) {
    super({ code, message, ...(details === undefined ? {} : { details }) }, status);
  }
}
