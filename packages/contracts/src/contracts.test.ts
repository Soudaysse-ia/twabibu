import { describe, expect, it } from 'vitest';
import { ERROR_CODES, OtpVerifySchema, REFERENCE_ISLANDS, REFERENCE_LOCALITIES, REFERENCE_SPECIALITIES, pageQuerySchema } from './index.js';

describe('contracts', () => {
  it('validates an e-mail code verification payload', () => {
    expect(OtpVerifySchema.parse({ email: ' Amina@Gmail.com ', purpose: 'SIGNUP', code: '482193' }).email).toBe('amina@gmail.com');
    expect(OtpVerifySchema.safeParse({ email: 'pas-une-adresse', purpose: 'SIGNUP', code: '482193' }).success).toBe(false);
    expect(OtpVerifySchema.safeParse({ email: 'amina@gmail.com', purpose: 'SIGNUP', code: '12' }).success).toBe(false);
  });
  it('coerces pagination from query strings', () => {
    expect(pageQuerySchema.parse({ page: '2' })).toEqual({ page: 2, pageSize: 20 });
    expect(pageQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });
  it('has unique error codes and reference slugs', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
    expect(new Set(REFERENCE_LOCALITIES.map((l) => l.slug)).size).toBe(REFERENCE_LOCALITIES.length);
    expect(new Set(REFERENCE_SPECIALITIES.map((s) => s.slug)).size).toBe(REFERENCE_SPECIALITIES.length);
  });
  it('places every locality on one of the three islands, inside the archipelago', () => {
    const codes = REFERENCE_ISLANDS.map((i) => i.code);
    for (const l of REFERENCE_LOCALITIES) {
      expect(codes).toContain(l.island);
      expect(l.lat).toBeGreaterThan(-12.5);
      expect(l.lat).toBeLessThan(-11.3);
      expect(l.lng).toBeGreaterThan(43.2);
      expect(l.lng).toBeLessThan(44.6);
    }
  });
});
