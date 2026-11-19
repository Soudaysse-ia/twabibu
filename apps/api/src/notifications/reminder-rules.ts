import { addDaysToDateKey, toDateKey, toMinutesOfDay, zonedToUtc } from '@twabibu/utils';

/**
 * Appointment reminders (SPEC-08 §Planification). Pure functions, tested in reminder-rules.test.ts.
 * A reminder goes out N days before the appointment at the practice's reminder hour (default: the day
 * before at 17:00, Comoros time), never at night, never for an appointment booked after that moment.
 */

/** Allowed offsets: the day before, two days before, three days before. */
export const REMINDER_OFFSETS_HOURS = [24, 48, 72] as const;
export const DEFAULT_REMINDER_OFFSETS = [24];
export const DEFAULT_REMINDER_HOUR = 17;
/** Reminder hours the practice can choose: inside the send window, with a margin before 21:00. */
export const REMINDER_HOUR_MIN = 7;
export const REMINDER_HOUR_MAX = 20;
/** Quiet hours (SPEC-08 §Règles 2): nothing non-urgent between 21:00 and 07:00. */
export const SEND_WINDOW_START_MINUTES = 7 * 60;
export const SEND_WINDOW_END_MINUTES = 21 * 60;
/** A reminder caught up later than this before the appointment is pointless. */
export const MIN_LEAD_MINUTES = 60;
/** How far ahead the scheduler looks: the largest offset plus one day. */
export const LOOKAHEAD_DAYS = 4;

/** Local day of the appointment minus `offsetHours / 24` days, at `hour`:00 (Comoros time). */
export function reminderDueAt(startsAt: Date, offsetHours: number, hour: number): Date {
  const days = Math.round(offsetHours / 24);
  return zonedToUtc(addDaysToDateKey(toDateKey(startsAt), -days), hour * 60);
}

export function isWithinSendWindow(at: Date): boolean {
  const m = toMinutesOfDay(at);
  return m >= SEND_WINDOW_START_MINUTES && m < SEND_WINDOW_END_MINUTES;
}

export type ReminderDecision = 'SEND' | 'WAIT' | 'SKIP';

/**
 * WAIT: not yet (or quiet hours, the next run will send). SKIP: never for this appointment and offset.
 * Booked after the reminder time → only the confirmation (« RDV créé moins de 24 h avant »).
 */
export function reminderDecision(input: { startsAt: Date; createdAt: Date; dueAt: Date; now: Date }): ReminderDecision {
  const { startsAt, createdAt, dueAt, now } = input;
  if (createdAt >= dueAt) return 'SKIP';
  if (startsAt.getTime() - now.getTime() < MIN_LEAD_MINUTES * 60_000) return 'SKIP';
  if (now < dueAt) return 'WAIT';
  if (!isWithinSendWindow(now)) return 'WAIT';
  return 'SEND';
}

/** Validates practice settings: known offsets only, no duplicates, hour inside the window. */
export function normaliseReminderSettings(input: { reminderOffsetsHours: number[]; reminderHour: number }) {
  const offsets = [...new Set(input.reminderOffsetsHours)].sort((a, b) => a - b);
  if (offsets.some((o) => !(REMINDER_OFFSETS_HOURS as readonly number[]).includes(o))) return null;
  if (!Number.isInteger(input.reminderHour) || input.reminderHour < REMINDER_HOUR_MIN || input.reminderHour > REMINDER_HOUR_MAX) return null;
  return { reminderOffsetsHours: offsets, reminderHour: input.reminderHour };
}
