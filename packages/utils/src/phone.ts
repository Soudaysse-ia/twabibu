/** Phone helpers. Comoros: country code +269, 7-digit national numbers. */
export const COMOROS_COUNTRY_CODE = '269';

/** Mobile numbers start with 3 or 4, landlines with 7 (to verify against the current numbering plan). */
const COMOROS_NATIONAL = /^[347]\d{6}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

/** Returns the number in E.164 (`+2693211234`) or null when it cannot be a valid number. */
export function normalizePhone(input: string, defaultCountryCode: string = COMOROS_COUNTRY_CODE): string | null {
  const raw = input.trim();
  if (raw === '') return null;
  let digits = raw.replace(/[\s().-]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (digits.startsWith('+')) {
    if (!/^\+\d+$/.test(digits)) return null;
    if (digits.startsWith(`+${COMOROS_COUNTRY_CODE}`)) {
      return COMOROS_NATIONAL.test(digits.slice(4)) ? digits : null;
    }
    return E164.test(digits) ? digits : null;
  }
  if (!/^\d+$/.test(digits)) return null;
  if (defaultCountryCode === COMOROS_COUNTRY_CODE) {
    return COMOROS_NATIONAL.test(digits) ? `+${COMOROS_COUNTRY_CODE}${digits}` : null;
  }
  const candidate = `+${defaultCountryCode}${digits.replace(/^0/, '')}`;
  return E164.test(candidate) ? candidate : null;
}

export function isComorianNumber(e164: string): boolean {
  return e164.startsWith(`+${COMOROS_COUNTRY_CODE}`) && COMOROS_NATIONAL.test(e164.slice(4));
}

export function isComorianMobile(e164: string): boolean {
  return isComorianNumber(e164) && /^[34]/.test(e164.slice(4));
}

/** `+2693211234` → `+269 321 12 34`. Foreign numbers are returned unchanged. */
export function formatPhone(e164: string): string {
  if (!isComorianNumber(e164)) return e164;
  const n = e164.slice(4);
  return `+${COMOROS_COUNTRY_CODE} ${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)}`;
}

/** Masks a number for logs: `+269 321 ** **`. Never log a full phone number. */
export function maskPhone(e164: string): string {
  if (e164.length < 6) return '***';
  return `${e164.slice(0, e164.length - 4)}****`;
}
