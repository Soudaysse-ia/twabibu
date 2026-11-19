/** Inputs and outputs of the availability engine. See docs/04-specs/SPEC-12-moteur-disponibilites.md. */

export interface AgendaSettings {
  /** IANA zone, `Indian/Comoro` for every Twabibu agenda today. */
  timezone: string;
  /** Grid step between two slot starts, in minutes (5, 10, 15, 20, 30). */
  slotStepMinutes: number;
  /** Patients cannot book further ahead than this. */
  bookingHorizonDays: number;
  /** Patients cannot book closer to the slot than this. */
  minNoticeMinutes: number;
  onlineBookingEnabled: boolean;
  /** When true, public holidays produce no online slot. */
  blockHolidays: boolean;
}

export interface MotiveInput {
  id: string;
  durationMinutes: number;
  isOnline: boolean;
  newPatientsAllowed: boolean;
  /** Overrides the agenda's notice when set. */
  minNoticeMinutes?: number | null;
}

export interface AvailabilityRuleInput {
  /** 0 = Sunday … 6 = Saturday, in the agenda's time zone. */
  weekday: number;
  /** Minutes since local midnight. */
  startMinutes: number;
  endMinutes: number;
  /** Empty = every motive. */
  motiveIds: readonly string[];
  /** Simultaneous appointments allowed on one slot. */
  capacity: number;
  /** Inclusive local dates (`YYYY-MM-DD`). */
  validFrom?: string | null;
  validUntil?: string | null;
  recurrence: 'WEEKLY' | 'BIWEEKLY';
  /** First active week of a BIWEEKLY rule (any date inside that week). Defaults to `validFrom`. */
  anchorDate?: string | null;
}

export interface Interval {
  startsAt: Date;
  endsAt: Date;
}

export type BookingSource = 'ONLINE' | 'PRACTICE';

export interface ComputeInput {
  agenda: AgendaSettings;
  motive: MotiveInput;
  rules: readonly AvailabilityRuleInput[];
  /** Absences, already expanded to concrete UTC intervals. */
  absences: readonly Interval[];
  /** Local dates of public holidays. */
  holidays: readonly string[];
  /** Appointments that occupy the agenda (cancelled ones excluded by the caller). */
  appointments: readonly Interval[];
  /** Slots currently held by someone in the booking funnel. */
  locks: readonly Interval[];
  /** Window to compute, `from` inclusive, `to` exclusive. */
  range: { from: Date; to: Date };
  now: Date;
  context: { isKnownPatient: boolean; source: BookingSource };
  /** Hours offered to the practice when it books outside the online rules. Default 07:00–20:00. */
  practiceHours?: { startMinutes: number; endMinutes: number };
}

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  remainingCapacity: number;
  /** False only for PRACTICE bookings made outside the online availability rules. */
  withinOnlineRules: boolean;
}

export type UnavailableReason = 'ONLINE_BOOKING_DISABLED' | 'MOTIVE_NOT_ONLINE' | 'NEW_PATIENTS_NOT_ACCEPTED';

export interface ComputeResult {
  slots: Slot[];
  /** Why the list is empty for policy reasons; null when slots were simply computed. */
  reason: UnavailableReason | null;
}

export interface DaySlots {
  /** Local date, `YYYY-MM-DD`. */
  date: string;
  slots: Slot[];
}
