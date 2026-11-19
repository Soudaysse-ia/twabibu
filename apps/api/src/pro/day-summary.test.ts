import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { summarizeDay } from './day-summary.js';

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 19, h - 3, m)); // Indian/Comoro = UTC+3
const row = (id: string, status: string, endHour: number) => ({ id, status, endsAt: at(endHour) });

describe('summarizeDay (practitioner home)', () => {
  const rows = [
    row('morning-forgotten', 'CONFIRMED', 9),
    row('morning-done', 'DONE', 10),
    row('late-still-inside', 'IN_CONSULTATION', 11),
    row('no-show', 'NO_SHOW', 12),
    row('afternoon', 'CONFIRMED', 15),
    row('to-validate', 'PENDING_VALIDATION', 16),
  ];

  it('does not count a past appointment that was never closed as « à venir »', () => {
    const s = summarizeDay(rows, at(14));
    assert.equal(s.remaining, 3);
    assert.deepEqual(s.toClose, ['morning-forgotten']);
    assert.equal(s.next?.id, 'afternoon');
  });

  it('keeps a patient still in consultation as under way, even past the planned end', () => {
    const s = summarizeDay(rows, at(14));
    assert.ok(!s.toClose.includes('late-still-inside'));
  });

  it('counts everything open as remaining at the start of the day', () => {
    const s = summarizeDay(rows, at(7));
    assert.equal(s.remaining, 4);
    assert.deepEqual(s.toClose, []);
    assert.equal(s.next?.id, 'morning-forgotten');
  });

  it('has nothing left at the end of the day except what must be closed', () => {
    const s = summarizeDay(rows, at(20));
    assert.equal(s.remaining, 1);
    assert.deepEqual(s.toClose, ['morning-forgotten', 'afternoon', 'to-validate']);
    assert.equal(s.next?.id, 'late-still-inside');
  });
});
