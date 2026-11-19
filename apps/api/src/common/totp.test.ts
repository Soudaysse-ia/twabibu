import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { base32Decode, base32Encode, hotp, totp, verifyTotp } from './totp.js';

describe('TOTP (RFC 6238)', () => {
  it('matches the RFC test vectors (SHA-1, 8 digits)', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    assert.equal(totp(secret, 59_000, 8), '94287082');
    assert.equal(totp(secret, 1_111_111_109_000, 8), '07081804');
    assert.equal(totp(secret, 2_000_000_000_000, 8), '69279037');
    assert.equal(hotp(Buffer.from('12345678901234567890'), 0), '755224'); // RFC 4226
  });

  it('round-trips base32 and accepts ±30 s of drift only', () => {
    const raw = Buffer.from('Twabibu admin secret');
    assert.deepEqual(base32Decode(base32Encode(raw)), raw);
    const secret = base32Encode(raw);
    const now = 1_800_000_000_000;
    assert.equal(verifyTotp(secret, totp(secret, now - 30_000), now), true);
    assert.equal(verifyTotp(secret, totp(secret, now - 90_000), now), false);
    assert.equal(verifyTotp(secret, 'abcdef', now), false);
  });
});
