import { describe, expect, it } from 'vitest';
import { buildIcs } from './ics';

describe('buildIcs', () => {
  it('builds a valid event in UTC and escapes text', () => {
    const ics = buildIcs({ uid: 'abc', startsAt: '2026-11-16T05:00:00.000Z', endsAt: '2026-11-16T05:20:00.000Z', title: 'RDV, Dr Saïd', location: 'Route de la Corniche; Moroni' });
    expect(ics).toContain('DTSTART:20261116T050000Z');
    expect(ics).toContain('DTEND:20261116T052000Z');
    expect(ics).toContain('SUMMARY:RDV\\, Dr Saïd');
    expect(ics).toContain('LOCATION:Route de la Corniche\\; Moroni');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });
});
