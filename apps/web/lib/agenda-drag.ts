import { addDaysToDateKey, toDateKey, toMinutesOfDay, zonedToUtc } from '@twabibu/utils';

/** Statuses an appointment may be dragged from: still to come and not yet answered or started. */
export const DRAGGABLE = ['CONFIRMED'] as const;

/**
 * Where a dragged appointment lands (SPEC-05 « glisser-déposer »).
 * `deltaMinutes` and `dayOffset` come from the pointer; the start is snapped to `step` minutes
 * and kept inside the visible day [`dayStart`, `dayEnd`] with its full duration.
 * Returns null when nothing changes.
 */
export function dropTarget(
  startsAt: string,
  endsAt: string,
  move: { deltaMinutes: number; dayOffset: number },
  bounds: { dayStart: number; dayEnd: number; step: number },
): Date | null {
  const start = new Date(startsAt);
  const duration = Math.round((new Date(endsAt).getTime() - start.getTime()) / 60_000);
  const raw = toMinutesOfDay(start) + move.deltaMinutes;
  const snapped = Math.round(raw / bounds.step) * bounds.step;
  const minutes = Math.max(bounds.dayStart, Math.min(bounds.dayEnd - duration, snapped));
  const day = addDaysToDateKey(toDateKey(start), move.dayOffset);
  const target = zonedToUtc(day, minutes);
  return target.getTime() === start.getTime() ? null : target;
}
