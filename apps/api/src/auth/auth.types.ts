import type { Request } from 'express';

export interface SessionUser {
  id: string;
  kind: 'PATIENT' | 'PROFESSIONAL' | 'PHARMACY_STAFF' | 'PLATFORM_ADMIN';
  phone: string | null;
  email: string | null;
  sessionId: string;
  patientProfileId: string | null;
}

export interface AuthedRequest extends Request {
  user?: SessionUser;
}
