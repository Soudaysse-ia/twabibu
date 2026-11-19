import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatTime, zonedToUtc } from '@twabibu/utils';
import { activeRulesOn, computeSlots, groupSlotsByDay, isSlotBookable } from './index.js';
import type { AvailabilityRuleInput, ComputeInput, Interval } from './index.js';

const TZ = 'Indian/Comoro';
// Friday 13 November 2026. Local midnight = 12 Nov 21:00 UTC.
const DAY = '2026-11-13';
const at = (day: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return zonedToUtc(day, h * 60 + m, TZ);
};
const span = (day: string, from: string, to: string): Interval => ({ startsAt: at(day, from), endsAt: at(day, to) });
const rule = (over: Partial<AvailabilityRuleInput> = {}): AvailabilityRuleInput => ({
  weekday: 5, startMinutes: 8 * 60, endMinutes: 12 * 60, motiveIds: [], capacity: 1, recurrence: 'WEEKLY', ...over,
});
const base = (over: Partial<ComputeInput> = {}): ComputeInput => ({
  agenda: { timezone: TZ, slotStepMinutes: 15, bookingHorizonDays: 90, minNoticeMinutes: 0, onlineBookingEnabled: true, blockHolidays: true },
  motive: { id: 'm1', durationMinutes: 30, isOnline: true, newPatientsAllowed: true },
  rules: [rule()],
  absences: [],
  holidays: [],
  appointments: [],
  locks: [],
  range: { from: at(DAY, '00:00'), to: at('2026-11-14', '00:00') },
  now: at('2026-11-10', '09:00'),
  context: { isKnownPatient: false, source: 'ONLINE' },
  ...over,
});
const times = (input: ComputeInput) => computeSlots(input).slots.map((s) => formatTime(s.startsAt, TZ));

describe('computeSlots', () => {
  it('1. generates the grid of a simple window (08:00–12:00, step 15, duration 30)', () => {
    const t = times(base());
    expect(t).toHaveLength(15);
    expect(t[0]).toBe('08:00');
    expect(t.at(-1)).toBe('11:30');
  });

  it('1b. step equal to the duration gives back-to-back slots', () => {
    const t = times(base({ agenda: { ...base().agenda, slotStepMinutes: 30 } }));
    expect(t).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30']);
  });

  it('2. a duration longer than the step never overflows the window', () => {
    const t = times(base({ motive: { ...base().motive, durationMinutes: 20 } }));
    expect(t[0]).toBe('08:00');
    expect(t[1]).toBe('08:15');
    expect(t.at(-1)).toBe('11:30'); // 11:45 + 20 min would end after 12:00
  });

  it('3. an appointment removes every slot it overlaps', () => {
    const t = times(base({ appointments: [span(DAY, '09:00', '09:30')] }));
    expect(t).not.toContain('08:45');
    expect(t).not.toContain('09:00');
    expect(t).not.toContain('09:15');
    expect(t).toContain('08:30');
    expect(t).toContain('09:30');
  });

  it('4. an absence removes every slot that intersects it', () => {
    const t = times(base({ absences: [span(DAY, '10:00', '11:00')] }));
    expect(t).toContain('09:30');
    expect(t).not.toContain('09:45');
    expect(t).not.toContain('10:30');
    expect(t).toContain('11:00');
  });

  it('5. respects the minimum notice (and the motive override)', () => {
    const now = at(DAY, '07:30');
    const agenda = { ...base().agenda, minNoticeMinutes: 120 };
    expect(times(base({ now, agenda }))[0]).toBe('09:30');
    expect(times(base({ now, agenda, motive: { ...base().motive, minNoticeMinutes: 30 } }))[0]).toBe('08:00');
  });

  it('6. offers nothing beyond the booking horizon', () => {
    const agenda = { ...base().agenda, bookingHorizonDays: 2 };
    expect(times(base({ agenda }))).toHaveLength(0);
    expect(times(base({ agenda: { ...agenda, bookingHorizonDays: 4 } }))).toHaveLength(15);
  });

  it('7. public holidays block online booking only when configured to', () => {
    expect(times(base({ holidays: [DAY] }))).toHaveLength(0);
    expect(times(base({ holidays: [DAY], agenda: { ...base().agenda, blockHolidays: false } }))).toHaveLength(15);
  });

  it('8. honours validity periods and biweekly rules', () => {
    expect(times(base({ rules: [rule({ validFrom: '2026-12-01', validUntil: '2026-12-31' })] }))).toHaveLength(0);
    expect(times(base({ rules: [rule({ validFrom: '2026-11-01', validUntil: '2026-11-30' })] }))).toHaveLength(15);
    const biweekly = rule({ recurrence: 'BIWEEKLY', anchorDate: '2026-11-13' });
    const week = (day: string) => base({ rules: [biweekly], range: { from: at(day, '00:00'), to: at(day, '23:59') } });
    expect(times(week('2026-11-13'))).toHaveLength(15);
    expect(times(week('2026-11-20'))).toHaveLength(0);
    expect(times(week('2026-11-27'))).toHaveLength(15);
  });

  it('9. counts capacity, and a lock weighs as much as an appointment', () => {
    const rules = [rule({ capacity: 2 })];
    const one = computeSlots(base({ rules, appointments: [span(DAY, '09:00', '09:30')] })).slots;
    expect(one.find((s) => formatTime(s.startsAt, TZ) === '09:00')?.remainingCapacity).toBe(1);
    const full = times(base({ rules, appointments: [span(DAY, '09:00', '09:30')], locks: [span(DAY, '09:00', '09:30')] }));
    expect(full).not.toContain('09:00');
    expect(full).toContain('09:30');
  });

  it('10. applies booking policies with an explicit reason', () => {
    expect(computeSlots(base({ agenda: { ...base().agenda, onlineBookingEnabled: false } })).reason).toBe('ONLINE_BOOKING_DISABLED');
    expect(computeSlots(base({ motive: { ...base().motive, isOnline: false } })).reason).toBe('MOTIVE_NOT_ONLINE');
    const followUp = { ...base().motive, newPatientsAllowed: false };
    expect(computeSlots(base({ motive: followUp })).reason).toBe('NEW_PATIENTS_NOT_ACCEPTED');
    expect(times(base({ motive: followUp, context: { isKnownPatient: true, source: 'ONLINE' } }))).toHaveLength(15);
  });

  it('10b. only offers a motive on the windows that allow it', () => {
    expect(times(base({ rules: [rule({ motiveIds: ['other'] })] }))).toHaveLength(0);
    expect(times(base({ rules: [rule({ motiveIds: ['m1', 'other'] })] }))).toHaveLength(15);
  });

  it('11. keeps late-evening slots on the right local day', () => {
    const late = rule({ startMinutes: 23 * 60, endMinutes: 24 * 60 });
    const result = computeSlots(base({ rules: [late] })).slots;
    expect(result.map((s) => formatTime(s.startsAt, TZ))).toEqual(['23:00', '23:15', '23:30']);
    expect(result[0]?.startsAt.toISOString()).toBe('2026-11-13T20:00:00.000Z');
    expect(groupSlotsByDay(result, TZ)).toHaveLength(1);
    expect(groupSlotsByDay(result, TZ)[0]?.date).toBe(DAY);
  });

  it('12. lets the practice book outside the online rules, without notice or horizon', () => {
    const input = base({
      context: { isKnownPatient: false, source: 'PRACTICE' },
      agenda: { ...base().agenda, onlineBookingEnabled: false, minNoticeMinutes: 600, bookingHorizonDays: 1 },
      appointments: [span(DAY, '14:00', '14:30')],
    });
    const slots = computeSlots(input).slots;
    const byTime = new Map(slots.map((s) => [formatTime(s.startsAt, TZ), s]));
    expect(byTime.get('09:00')?.withinOnlineRules).toBe(true);
    expect(byTime.get('15:00')?.withinOnlineRules).toBe(false);
    expect(byTime.has('14:00')).toBe(false);
    expect(byTime.has('07:00')).toBe(true);
    expect(byTime.has('19:30')).toBe(true);
    expect(byTime.has('19:45')).toBe(false);
  });

  it('groups a multi-day range by local day and validates a single slot', () => {
    const input = base({
      rules: [rule(), rule({ weekday: 1 })], // Friday and Monday
      range: { from: at(DAY, '00:00'), to: at('2026-11-17', '00:00') },
    });
    const days = groupSlotsByDay(computeSlots(input).slots, TZ);
    expect(days.map((d) => d.date)).toEqual(['2026-11-13', '2026-11-16']);
    expect(isSlotBookable(input, at(DAY, '09:15'))).toBe(true);
    expect(isSlotBookable(input, at(DAY, '09:10'))).toBe(false);
    expect(isSlotBookable(input, at(DAY, '13:00'))).toBe(false);
  });
});

describe('activeRulesOn', () => {
  it('returns the windows of a day whatever the motive, honouring validity and biweekly rules', () => {
    const rules = [rule({ motiveIds: ['other'] }), rule({ weekday: 1 }), rule({ recurrence: 'BIWEEKLY', anchorDate: '2026-11-20' })];
    expect(activeRulesOn(rules, DAY)).toHaveLength(1);
    expect(activeRulesOn(rules, '2026-11-20')).toHaveLength(2);
    expect(activeRulesOn(rules, '2026-11-16')).toHaveLength(1);
  });
});

describe('computeSlots — properties', () => {
  const minutes = fc.integer({ min: 0, max: 24 * 60 - 1 });
  const interval = fc.tuple(minutes, fc.integer({ min: 5, max: 180 })).map(([start, len]): Interval => {
    const s = zonedToUtc(DAY, start, TZ);
    return { startsAt: s, endsAt: new Date(s.getTime() + len * 60_000) };
  });
  const ruleArb = fc
    .tuple(minutes, fc.integer({ min: 15, max: 600 }), fc.integer({ min: 1, max: 3 }))
    .map(([start, len, capacity]) => rule({ startMinutes: start, endMinutes: Math.min(start + len, 24 * 60), capacity }));

  it('never returns a slot that overlaps an absence, exceeds capacity or leaves its window', () => {
    fc.assert(
      fc.property(
        fc.array(ruleArb, { minLength: 1, maxLength: 3 }),
        fc.array(interval, { maxLength: 6 }),
        fc.array(interval, { maxLength: 4 }),
        fc.constantFrom(5, 10, 15, 20, 30),
        fc.constantFrom(10, 15, 20, 30, 45, 60),
        (rules, appointments, absences, step, duration) => {
          const input = base({
            rules,
            appointments,
            absences,
            agenda: { ...base().agenda, slotStepMinutes: step },
            motive: { ...base().motive, durationMinutes: duration },
          });
          const { slots } = computeSlots(input);
          const maxCapacity = Math.max(...rules.map((r) => r.capacity));
          for (let i = 0; i < slots.length; i++) {
            const s = slots[i]!;
            const start = s.startsAt.getTime();
            const end = s.endsAt.getTime();
            expect(end - start).toBe(duration * 60_000);
            expect(absences.some((a) => a.startsAt.getTime() < end && a.endsAt.getTime() > start)).toBe(false);
            const taken = appointments.filter((a) => a.startsAt.getTime() < end && a.endsAt.getTime() > start).length;
            expect(s.remainingCapacity).toBeGreaterThanOrEqual(1);
            expect(taken + s.remainingCapacity).toBeLessThanOrEqual(maxCapacity);
            expect(rules.some((r) => start >= zonedToUtc(DAY, r.startMinutes, TZ).getTime() && end <= zonedToUtc(DAY, r.endMinutes, TZ).getTime())).toBe(true);
            if (i > 0) expect(start).toBeGreaterThan(slots[i - 1]!.startsAt.getTime());
          }
        },
      ),
      { numRuns: 300 },
    );
    // 300 random runs take ~5 s on slower machines (cloud, CI): Vitest's 5 s default is too tight.
  }, 30_000);
});
