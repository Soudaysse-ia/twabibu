/** Statuses of an appointment that still needs the practice to act (receive, consult or close it). */
export const OPEN_STATUSES = ['CONFIRMED', 'PENDING_VALIDATION', 'ARRIVED', 'IN_CONSULTATION'] as const;
const IN_PROGRESS = ['ARRIVED', 'IN_CONSULTATION'];

interface DayRow {
  id: string;
  status: string;
  endsAt: Date;
}

/**
 * Splits today's open appointments at `now` (SPEC-05 home).
 * - `remaining`: still to come or under way (the patient is in the waiting room or in consultation).
 * - `toClose`: already over but never marked done or no-show, so they are not counted as « à venir ».
 * `next` is the first remaining one, which the home page highlights.
 */
export function summarizeDay<T extends DayRow>(rows: readonly T[], now: Date) {
  const open = rows.filter((a) => (OPEN_STATUSES as readonly string[]).includes(a.status));
  const isRemaining = (a: T) => a.endsAt > now || IN_PROGRESS.includes(a.status);
  const remaining = open.filter(isRemaining);
  return {
    remaining: remaining.length,
    toClose: open.filter((a) => !isRemaining(a)).map((a) => a.id),
    next: remaining.find((a) => a.endsAt > now) ?? remaining[0] ?? null,
  };
}
