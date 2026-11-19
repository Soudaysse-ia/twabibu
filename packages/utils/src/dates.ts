/** All user-facing dates are shown in the Comoros time zone. Storage is always UTC. */
export const DEFAULT_TIMEZONE = 'Indian/Comoro';
export const DEFAULT_LOCALE = 'fr-FR';

function parts(date: Date, timeZone: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  return out;
}

/** Offset of `timeZone` from UTC, in minutes, at the given instant (+180 for Indian/Comoro). */
export function timeZoneOffsetMinutes(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  const p = parts(date, timeZone);
  const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** Local calendar day of an instant: `2026-11-13`. */
export function toDateKey(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const p = parts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Minutes since local midnight (0–1439). */
export function toMinutesOfDay(date: Date, timeZone: string = DEFAULT_TIMEZONE): number {
  const p = parts(date, timeZone);
  return +p.hour! * 60 + +p.minute!;
}

/** Converts a local day + minutes since midnight to the UTC instant. */
export function zonedToUtc(dateKey: string, minutesOfDay: number, timeZone: string = DEFAULT_TIMEZONE): Date {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, 0, minutesOfDay);
  const first = guess - timeZoneOffsetMinutes(new Date(guess), timeZone) * 60000;
  const second = guess - timeZoneOffsetMinutes(new Date(first), timeZone) * 60000;
  return new Date(second);
}

/** Day of week of a date key, 0 = Sunday … 6 = Saturday. */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** `jeudi 13 novembre 2026` */
export function formatDateLong(date: Date, timeZone: string = DEFAULT_TIMEZONE, locale: string = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** `10:20` (24 h) */
export function formatTime(date: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const p = parts(date, timeZone);
  return `${p.hour}:${p.minute}`;
}

/** `{ weekday: 'jeudi', day: '13 nov.' }` for availability grid headers. */
export function formatDayHeader(date: Date, timeZone: string = DEFAULT_TIMEZONE, locale: string = DEFAULT_LOCALE): { weekday: string; day: string } {
  return {
    weekday: new Intl.DateTimeFormat(locale, { timeZone, weekday: 'long' }).format(date),
    day: new Intl.DateTimeFormat(locale, { timeZone, day: 'numeric', month: 'short' }).format(date),
  };
}

/** `jeu. 13 nov. 10:20` — compact form for SMS. */
export function formatSmsDateTime(date: Date, timeZone: string = DEFAULT_TIMEZONE, locale: string = DEFAULT_LOCALE): string {
  const d = new Intl.DateTimeFormat(locale, { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(date);
  return `${d} ${formatTime(date, timeZone)}`;
}
