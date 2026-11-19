import { addDaysToDateKey, toDateKey, weekdayOf } from '@twabibu/utils';
import type { AgendaEvents } from './pro-types';

export interface MonthDay {
  date: string;
  appointments: number;
  pending: number;
  /** Booked minutes ÷ online window minutes, 0–100. Null when the day has no online window. */
  fill: number | null;
  holiday: string | null;
  absent: boolean;
}

/** First and last local dates of the month containing `dateKey` (≤ 31 days: one events request). */
export function monthRange(dateKey: string): { from: string; to: string } {
  const from = `${dateKey.slice(0, 7)}-01`;
  let to = from;
  while (addDaysToDateKey(to, 1).slice(0, 7) === from.slice(0, 7)) to = addDaysToDateKey(to, 1);
  return { from, to };
}

/** Moves to the same day number of another month, clamped to that month's last day. */
export function shiftMonth(dateKey: string, months: number): string {
  const [y, m] = dateKey.split('-').map(Number) as [number, number];
  const total = y * 12 + (m - 1) + months;
  const first = `${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}-01`;
  const { to } = monthRange(first);
  const day = Math.min(Number(dateKey.slice(8, 10)), Number(to.slice(8, 10)));
  return `${first.slice(0, 8)}${String(day).padStart(2, '0')}`;
}

/**
 * Month grid of the agenda (SPEC-05 « Vue mois »): one cell per day, weeks starting on Monday.
 * `null` cells pad the first and last weeks.
 */
export function monthGrid(dateKey: string, events: AgendaEvents | null): (MonthDay | null)[] {
  const { from, to } = monthRange(dateKey);
  const lead = (weekdayOf(from) + 6) % 7; // Monday = 0
  const cells: (MonthDay | null)[] = Array.from({ length: lead }, () => null);
  const holidays = new Map(events?.holidays.map((h) => [h.date, h.name]) ?? []);
  for (let day = from; day <= to; day = addDaysToDateKey(day, 1)) {
    const appts = events?.appointments.filter((a) => toDateKey(new Date(a.startsAt)) === day) ?? [];
    const windowMinutes = events?.windows.filter((w) => w.date === day).reduce((s, w) => s + (w.endMinutes - w.startMinutes), 0) ?? 0;
    const booked = appts.reduce((s, a) => s + (new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000, 0);
    cells.push({
      date: day,
      appointments: appts.length,
      pending: appts.filter((a) => a.status === 'PENDING_VALIDATION').length,
      fill: windowMinutes > 0 ? Math.min(100, Math.round((booked / windowMinutes) * 100)) : null,
      holiday: holidays.get(day) ?? null,
      absent: !!events?.absences.some((a) => toDateKey(new Date(a.startsAt)) <= day && toDateKey(new Date(a.endsAt)) >= day),
    });
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}
