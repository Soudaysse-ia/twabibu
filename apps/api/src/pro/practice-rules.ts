import { WEEKDAYS, type OpeningHoursInput } from '@twabibu/contracts';

/** Pure rules for a place of consultation edited in Twabibu Pro (PRO-06). No database here. */

export type OpeningHours = Partial<Record<(typeof WEEKDAYS)[number], [string, string][]>>;

/**
 * Checks and tidies the week: each range must end after it starts and not overlap the next one; ranges are sorted;
 * a day without ranges is closed and left out. Returns the faulty day instead when something does not hold.
 */
export function cleanOpeningHours(
  input: OpeningHoursInput,
): { ok: true; hours: OpeningHours } | { ok: false; day: string } {
  const hours: OpeningHours = {};
  for (const day of WEEKDAYS) {
    const ranges = [...(input[day] ?? [])].sort((a, b) => a[0].localeCompare(b[0]));
    if (!ranges.length) continue;
    // "HH:MM" strings compare like times.
    for (let i = 0; i < ranges.length; i++) {
      const [start, end] = ranges[i]!;
      if (start >= end) return { ok: false, day };
      if (i > 0 && start < ranges[i - 1]![1]) return { ok: false, day };
    }
    hours[day] = ranges.map(([s, e]) => [s, e]);
  }
  return { ok: true, hours };
}

/** Access information without empty text, so that the public page shows only what was filled in. */
export function cleanAccessInfo(input: {
  floor?: string;
  wheelchair?: boolean;
  elevator?: boolean;
  parking?: boolean;
  notes?: string;
}) {
  const out: Record<string, string | boolean> = {};
  if (input.floor?.trim()) out.floor = input.floor.trim();
  if (input.notes?.trim()) out.notes = input.notes.trim();
  for (const key of ['wheelchair', 'elevator', 'parking'] as const) if (input[key]) out[key] = true;
  return out;
}
