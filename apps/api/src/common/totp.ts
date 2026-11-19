import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Time-based one-time passwords (RFC 6238, SHA-1, 6 digits, 30 s), as read by any authenticator app
 * (Google Authenticator, Microsoft Authenticator, Aegis…). Used for the back-office second factor.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = ALPHABET.indexOf(char);
    if (idx < 0) throw new Error('Invalid base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

/** HOTP value for a counter (RFC 4226). `digits` defaults to 6. */
export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', secret).update(msg).digest();
  const offset = h[h.length - 1]! & 0xf;
  const code = ((h[offset]! & 0x7f) << 24) | (h[offset + 1]! << 16) | (h[offset + 2]! << 8) | h[offset + 3]!;
  return String(code % 10 ** digits).padStart(digits, '0');
}

export const totp = (secretBase32: string, at = Date.now(), digits = 6) => hotp(base32Decode(secretBase32), Math.floor(at / 30_000), digits);

/** Accepts the current code and the one just before or after (clock drift of ±30 s). */
export function verifyTotp(secretBase32: string, code: string, at = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const secret = base32Decode(secretBase32);
  const step = Math.floor(at / 30_000);
  return [-1, 0, 1].some((d) => timingSafeEqual(Buffer.from(hotp(secret, step + d)), Buffer.from(code)));
}

/** URI shown as a QR code in the authenticator app. */
export const otpauthUri = (secretBase32: string, account: string) =>
  `otpauth://totp/${encodeURIComponent(`Twabibu Admin:${account}`)}?secret=${secretBase32}&issuer=${encodeURIComponent('Twabibu Admin')}&algorithm=SHA1&digits=6&period=30`;
