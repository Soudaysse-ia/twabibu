import { describe, expect, it } from 'vitest';
import { formatTime, toDateKey, zonedToUtc } from '@twabibu/utils';
import { dropTarget } from './agenda-drag';

const at = (day: string, h: number, m = 0) => zonedToUtc(day, h * 60 + m).toISOString();
const bounds = { dayStart: 7 * 60, dayEnd: 20 * 60, step: 5 };

describe('dropTarget', () => {
  it('moves by the dragged minutes, snapped to the step, in Comoros time', () => {
    const t = dropTarget(at('2026-11-23', 9), at('2026-11-23', 9, 20), { deltaMinutes: 47, dayOffset: 0 }, bounds)!;
    expect(formatTime(t)).toBe('09:45');
    expect(toDateKey(t)).toBe('2026-11-23');
  });

  it('changes day in the week view and keeps the time', () => {
    const t = dropTarget(at('2026-11-23', 9), at('2026-11-23', 9, 20), { deltaMinutes: 0, dayOffset: 2 }, bounds)!;
    expect([toDateKey(t), formatTime(t)]).toEqual(['2026-11-25', '09:00']);
  });

  it('keeps the whole appointment inside the visible day', () => {
    const late = dropTarget(at('2026-11-23', 19), at('2026-11-23', 19, 30), { deltaMinutes: 120, dayOffset: 0 }, bounds)!;
    expect(formatTime(late)).toBe('19:30');
    const early = dropTarget(at('2026-11-23', 8), at('2026-11-23', 8, 20), { deltaMinutes: -180, dayOffset: 0 }, bounds)!;
    expect(formatTime(early)).toBe('07:00');
  });

  it('returns null when the appointment lands where it was', () => {
    expect(dropTarget(at('2026-11-23', 9), at('2026-11-23', 9, 20), { deltaMinutes: 2, dayOffset: 0 }, bounds)).toBeNull();
  });
});
