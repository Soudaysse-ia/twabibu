import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isWithinSendWindow, normaliseReminderSettings, reminderDecision, reminderDueAt } from './reminder-rules.js';

// Comoros = UTC+3, no daylight saving. 2026-11-13 is a Friday.
const at = (iso: string) => new Date(iso);

describe('appointment reminders', () => {
  it('is due the day before at 17:00 Comoros time by default', () => {
    const startsAt = at('2026-11-14T07:20:00Z'); // Sat 14 Nov, 10:20 local
    assert.equal(reminderDueAt(startsAt, 24, 17).toISOString(), '2026-11-13T14:00:00.000Z'); // Fri 17:00 local
    assert.equal(reminderDueAt(startsAt, 48, 9).toISOString(), '2026-11-12T06:00:00.000Z'); // Thu 09:00 local
    // An early-morning appointment (00:30 local) still belongs to its local day.
    assert.equal(reminderDueAt(at('2026-11-13T21:30:00Z'), 24, 17).toISOString(), '2026-11-13T14:00:00.000Z');
  });

  it('confirmed at 10:00 for tomorrow 10:20: reminded at 17:00 the same day (simulated clock)', () => {
    const startsAt = at('2026-11-14T07:20:00Z');
    const createdAt = at('2026-11-13T07:00:00Z'); // Fri 10:00 local
    const dueAt = reminderDueAt(startsAt, 24, 17);
    assert.equal(reminderDecision({ startsAt, createdAt, dueAt, now: at('2026-11-13T13:45:00Z') }), 'WAIT'); // 16:45
    assert.equal(reminderDecision({ startsAt, createdAt, dueAt, now: at('2026-11-13T14:00:00Z') }), 'SEND'); // 17:00
    assert.equal(reminderDecision({ startsAt, createdAt, dueAt, now: at('2026-11-13T17:59:00Z') }), 'SEND'); // 20:59, catching up
  });

  it('never sends at night, and skips what is booked late or too close', () => {
    const startsAt = at('2026-11-14T07:20:00Z');
    const dueAt = reminderDueAt(startsAt, 24, 17);
    const createdAt = at('2026-11-12T07:00:00Z');
    assert.equal(reminderDecision({ startsAt, createdAt, dueAt, now: at('2026-11-13T19:30:00Z') }), 'WAIT'); // 22:30 local
    assert.equal(reminderDecision({ startsAt, createdAt, dueAt, now: at('2026-11-14T03:00:00Z') }), 'WAIT'); // 06:00 local
    assert.equal(reminderDecision({ startsAt, createdAt, dueAt, now: at('2026-11-14T04:30:00Z') }), 'SEND'); // 07:30 local, server was down
    assert.equal(reminderDecision({ startsAt, createdAt, dueAt, now: at('2026-11-14T06:40:00Z') }), 'SKIP'); // 40 min before
    assert.equal(reminderDecision({ startsAt, createdAt: at('2026-11-13T15:00:00Z'), dueAt, now: at('2026-11-13T15:05:00Z') }), 'SKIP'); // booked at 18:00
    assert.equal(isWithinSendWindow(at('2026-11-13T04:00:00Z')), true); // 07:00 local
    assert.equal(isWithinSendWindow(at('2026-11-13T18:00:00Z')), false); // 21:00 local
  });

  it('accepts only known offsets and an hour inside the send window', () => {
    assert.deepEqual(normaliseReminderSettings({ reminderOffsetsHours: [48, 24, 24], reminderHour: 17 }), { reminderOffsetsHours: [24, 48], reminderHour: 17 });
    assert.deepEqual(normaliseReminderSettings({ reminderOffsetsHours: [], reminderHour: 9 }), { reminderOffsetsHours: [], reminderHour: 9 });
    assert.equal(normaliseReminderSettings({ reminderOffsetsHours: [2], reminderHour: 17 }), null);
    assert.equal(normaliseReminderSettings({ reminderOffsetsHours: [24], reminderHour: 21 }), null);
    assert.equal(normaliseReminderSettings({ reminderOffsetsHours: [24], reminderHour: 6 }), null);
  });
});
