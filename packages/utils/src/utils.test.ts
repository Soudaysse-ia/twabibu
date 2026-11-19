import { describe, expect, it } from 'vitest';
import {
  addDaysToDateKey, formatDateLong, formatKmf, formatPhone, formatTime, isComorianMobile, maskPhone,
  normalizePhone, searchKey, slugify, timeZoneOffsetMinutes, toDateKey, toMinutesOfDay, weekdayOf, zonedToUtc,
} from './index.js';

describe('phone', () => {
  it('normalizes Comorian numbers in every common spelling', () => {
    expect(normalizePhone('321 12 34')).toBe('+2693211234');
    expect(normalizePhone('+269 321 12 34')).toBe('+2693211234');
    expect(normalizePhone('00269-432-10-00')).toBe('+2694321000');
  });
  it('rejects invalid Comorian numbers', () => {
    expect(normalizePhone('12')).toBeNull();
    expect(normalizePhone('5211234')).toBeNull();
    expect(normalizePhone('+269 32 11')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
  it('accepts foreign numbers for the diaspora', () => {
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('+33612345678');
    expect(normalizePhone('0612345678', '33')).toBe('+33612345678');
  });
  it('formats and masks', () => {
    expect(formatPhone('+2693211234')).toBe('+269 321 12 34');
    expect(isComorianMobile('+2693211234')).toBe(true);
    expect(isComorianMobile('+2697731234')).toBe(false);
    expect(maskPhone('+2693211234')).toBe('+269321****');
  });
});

describe('money', () => {
  it('formats KMF with non-breaking spaces', () => {
    expect(formatKmf(5000)).toBe('5 000 KMF');
    expect(formatKmf(1250000)).toBe('1 250 000 KMF');
    expect(formatKmf(500)).toBe('500 KMF');
  });
});

describe('dates in Indian/Comoro (UTC+3)', () => {
  const instant = new Date('2026-11-12T21:30:00Z'); // 00:30 on the 13th in Moroni
  it('computes the local day and time', () => {
    expect(timeZoneOffsetMinutes(instant)).toBe(180);
    expect(toDateKey(instant)).toBe('2026-11-13');
    expect(toMinutesOfDay(instant)).toBe(30);
    expect(formatTime(instant)).toBe('00:30');
  });
  it('converts local time back to UTC', () => {
    expect(zonedToUtc('2026-11-13', 10 * 60 + 20).toISOString()).toBe('2026-11-13T07:20:00.000Z');
    expect(zonedToUtc('2026-11-13', 23 * 60 + 50).toISOString()).toBe('2026-11-13T20:50:00.000Z');
  });
  it('handles a zone with daylight saving time', () => {
    expect(zonedToUtc('2026-07-01', 9 * 60, 'Europe/Paris').toISOString()).toBe('2026-07-01T07:00:00.000Z');
    expect(zonedToUtc('2026-01-15', 9 * 60, 'Europe/Paris').toISOString()).toBe('2026-01-15T08:00:00.000Z');
  });
  it('formats in French', () => {
    expect(formatDateLong(new Date('2026-11-13T07:20:00Z'))).toBe('vendredi 13 novembre 2026');
    expect(weekdayOf('2026-11-13')).toBe(5);
    expect(addDaysToDateKey('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('slug', () => {
  it('slugifies French labels', () => {
    expect(slugify('Médecin généraliste')).toBe('medecin-generaliste');
    expect(slugify("Chirurgien-dentiste d'Anjouan")).toBe('chirurgien-dentiste-d-anjouan');
    expect(searchKey('  Pédiatre ')).toBe('pediatre');
  });
});
