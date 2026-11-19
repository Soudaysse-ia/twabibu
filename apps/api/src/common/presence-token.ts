import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Token of the « Je confirme ma présence » link sent in reminders. Signed with the server secret and bound to
 * the appointment time: moving the appointment invalidates old links. 128 bits, URL-safe.
 */
export function presenceToken(secret: string, appointmentId: string, startsAt: Date): string {
  return createHmac('sha256', secret).update(`presence:${appointmentId}:${startsAt.toISOString()}`).digest('base64url').slice(0, 22);
}

export function verifyPresenceToken(secret: string, appointmentId: string, startsAt: Date, token: string): boolean {
  if (!/^[A-Za-z0-9_-]{22}$/.test(token)) return false;
  const expected = Buffer.from(presenceToken(secret, appointmentId, startsAt));
  return timingSafeEqual(expected, Buffer.from(token));
}
