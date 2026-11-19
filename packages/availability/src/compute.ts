import { addDaysToDateKey, toDateKey, weekdayOf, zonedToUtc } from '@twabibu/utils';
import type { AvailabilityRuleInput, ComputeInput, ComputeResult, DaySlots, Interval, Slot } from './types.js';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const DEFAULT_PRACTICE_HOURS = { startMinutes: 7 * 60, endMinutes: 20 * 60 };

function overlaps(aStart: number, aEnd: number, b: Interval): boolean {
  return b.startsAt.getTime() < aEnd && b.endsAt.getTime() > aStart;
}

function countOverlaps(start: number, end: number, intervals: readonly Interval[]): number {
  let n = 0;
  for (const i of intervals) if (overlaps(start, end, i)) n++;
  return n;
}

function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / DAY);
}

/** Monday-based week index, used to alternate BIWEEKLY rules. */
function weekIndex(dateKey: string): number {
  // 1970-01-01 is a Thursday; shift by 3 days so that weeks start on Monday.
  return Math.floor((dayNumber(dateKey) + 3) / 7);
}

function ruleAppliesOn(rule: AvailabilityRuleInput, dateKey: string, motiveId: string | null): boolean {
  if (rule.weekday !== weekdayOf(dateKey)) return false;
  if (motiveId !== null && rule.motiveIds.length > 0 && !rule.motiveIds.includes(motiveId)) return false;
  if (rule.validFrom && dateKey < rule.validFrom) return false;
  if (rule.validUntil && dateKey > rule.validUntil) return false;
  if (rule.recurrence === 'BIWEEKLY') {
    const anchor = rule.anchorDate ?? rule.validFrom;
    if (!anchor) return false;
    if ((weekIndex(dateKey) - weekIndex(anchor)) % 2 !== 0) return false;
  }
  return rule.endMinutes > rule.startMinutes;
}

/**
 * Computes the bookable slots of one agenda for one motive.
 * Pure function: no clock, no database, no cache. Everything comes from `input`.
 */
export function computeSlots(input: ComputeInput): ComputeResult {
  const { agenda, motive, rules, absences, holidays, appointments, locks, range, now, context } = input;
  const online = context.source === 'ONLINE';

  if (online) {
    if (!agenda.onlineBookingEnabled) return { slots: [], reason: 'ONLINE_BOOKING_DISABLED' };
    if (!motive.isOnline) return { slots: [], reason: 'MOTIVE_NOT_ONLINE' };
    if (!motive.newPatientsAllowed && !context.isKnownPatient) return { slots: [], reason: 'NEW_PATIENTS_NOT_ACCEPTED' };
  }
  if (motive.durationMinutes <= 0 || agenda.slotStepMinutes <= 0) return { slots: [], reason: null };

  const notice = (motive.minNoticeMinutes ?? agenda.minNoticeMinutes) * MINUTE;
  const lower = online ? Math.max(range.from.getTime(), now.getTime() + notice) : range.from.getTime();
  const upper = online ? Math.min(range.to.getTime(), now.getTime() + agenda.bookingHorizonDays * DAY) : range.to.getTime();
  if (upper <= lower) return { slots: [], reason: null };

  const tz = agenda.timezone;
  const duration = motive.durationMinutes * MINUTE;
  const step = agenda.slotStepMinutes;
  const holidaySet = new Set(holidays);
  const practiceHours = input.practiceHours ?? DEFAULT_PRACTICE_HOURS;
  const busy = [...appointments, ...locks];
  const byStart = new Map<number, Slot>();

  const lastDay = toDateKey(new Date(upper - 1), tz);
  for (let day = toDateKey(new Date(lower), tz); day <= lastDay; day = addDaysToDateKey(day, 1)) {
    const isHoliday = holidaySet.has(day);
    const dayRules = isHoliday && agenda.blockHolidays ? [] : rules.filter((r) => ruleAppliesOn(r, day, motive.id));

    // Windows to scan: the online rules, plus the practice's own hours when the practice books.
    const windows: { start: number; end: number; capacity: number; withinOnlineRules: boolean }[] = dayRules.map((r) => ({
      start: r.startMinutes,
      end: r.endMinutes,
      capacity: Math.max(1, r.capacity),
      withinOnlineRules: true,
    }));
    if (!online) windows.push({ start: practiceHours.startMinutes, end: practiceHours.endMinutes, capacity: 1, withinOnlineRules: false });

    for (const w of windows) {
      for (let minute = w.start; minute + motive.durationMinutes <= w.end; minute += step) {
        const start = zonedToUtc(day, minute, tz).getTime();
        const end = start + duration;
        if (start < lower || start >= upper) continue;
        if (countOverlaps(start, end, absences) > 0) continue;
        const remaining = w.capacity - countOverlaps(start, end, busy);
        if (remaining <= 0) continue;
        const existing = byStart.get(start);
        // A slot inside an online rule wins over the same slot seen through practice hours.
        if (existing && (existing.withinOnlineRules || !w.withinOnlineRules) && existing.remainingCapacity >= remaining) continue;
        byStart.set(start, {
          startsAt: new Date(start),
          endsAt: new Date(end),
          remainingCapacity: remaining,
          withinOnlineRules: w.withinOnlineRules || (existing?.withinOnlineRules ?? false),
        });
      }
    }
  }

  const slots = [...byStart.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return { slots, reason: null };
}

/** Online-booking windows active on a local day, whatever the motive (used to tint the practice agenda). */
export function activeRulesOn(rules: readonly AvailabilityRuleInput[], dateKey: string): AvailabilityRuleInput[] {
  return rules.filter((r) => ruleAppliesOn(r, dateKey, null));
}

/** Groups slots by local day, keeping empty days out. */
export function groupSlotsByDay(slots: readonly Slot[], timezone: string): DaySlots[] {
  const days = new Map<string, Slot[]>();
  for (const slot of slots) {
    const key = toDateKey(slot.startsAt, timezone);
    const list = days.get(key);
    if (list) list.push(slot);
    else days.set(key, [slot]);
  }
  return [...days.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, list]) => ({ date, slots: list }));
}

/** True when `startsAt` is one of the bookable slots: the server-side check before locking or booking. */
export function isSlotBookable(input: ComputeInput, startsAt: Date): boolean {
  const target = startsAt.getTime();
  const windowed: ComputeInput = { ...input, range: { from: new Date(target), to: new Date(target + 1) } };
  return computeSlots(windowed).slots.some((s) => s.startsAt.getTime() === target);
}
