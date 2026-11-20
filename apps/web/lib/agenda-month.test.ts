import { describe, expect, it } from 'vitest';
import { zonedToUtc } from '@twabibu/utils';
import { monthGrid, monthRange, shiftMonth } from './agenda-month';
import type { AgendaEvents, ProAppointment } from './pro-types';

const appt = (day: string, minutes: number, duration: number, status: ProAppointment['status'] = 'CONFIRMED') =>
  ({ startsAt: zonedToUtc(day, minutes).toISOString(), endsAt: zonedToUtc(day, minutes + duration).toISOString(), status }) as ProAppointment;

describe('agenda month view', () => {
  it('covers the whole month in one request', () => {
    expect(monthRange('2026-11-19')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthRange('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('moves between months and keeps a valid day', () => {
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftMonth('2026-12-15', 1)).toBe('2027-01-15');
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('starts weeks on Monday and counts, fills and flags each day', () => {
    const events: AgendaEvents = {
      agendaIds: ['a'],
      appointments: [appt('2026-11-02', 9 * 60, 60), appt('2026-11-02', 10 * 60, 60, 'PENDING_VALIDATION'), appt('2026-11-03', 9 * 60, 30)],
      windows: [{ agendaId: 'a', date: '2026-11-02', startMinutes: 8 * 60, endMinutes: 12 * 60 }],
      absences: [{ id: 'x', agendaId: 'a', startsAt: zonedToUtc('2026-11-05', 0).toISOString(), endsAt: zonedToUtc('2026-11-06', 23 * 60).toISOString(), reason: null }],
      holidays: [{ date: '2026-11-04', name: 'Fête test' }],
    };
    const cells = monthGrid('2026-11-19', events);
    // 1 November 2026 is a Sunday: six empty cells before it.
    expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(cells.length % 7).toBe(0);
    const day = (d: string) => cells.find((c) => c?.date === d)!;
    expect(day('2026-11-02')).toMatchObject({ appointments: 2, pending: 1, fill: 50 });
    expect(day('2026-11-03')).toMatchObject({ appointments: 1, fill: null });
    expect(day('2026-11-04').holiday).toBe('Fête test');
    expect([day('2026-11-05').absent, day('2026-11-06').absent, day('2026-11-07').absent]).toEqual([true, true, false]);
  });
});
