import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FieldCrypto } from './field-crypto.js';

describe('FieldCrypto', () => {
  const crypto = new FieldCrypto('a-long-test-secret');

  it('round-trips text and JSON, with a fresh IV each time', () => {
    const a = crypto.encrypt('Toux depuis 3 jours, fièvre 38,5 °C');
    const b = crypto.encrypt('Toux depuis 3 jours, fièvre 38,5 °C');
    assert.notEqual(a, b);
    assert.ok(!a.includes('Toux'));
    assert.equal(crypto.decrypt(a), 'Toux depuis 3 jours, fièvre 38,5 °C');
    assert.deepEqual(crypto.decryptJson(crypto.encryptJson({ plan: 'Repos' })), { plan: 'Repos' });
  });

  it('refuses tampered data and the wrong key', () => {
    const value = crypto.encrypt('secret');
    const parts = value.split(':');
    parts[3] = Buffer.from('tampered').toString('base64');
    assert.throws(() => crypto.decrypt(parts.join(':')));
    assert.throws(() => new FieldCrypto('another-secret-value').decrypt(value));
  });
});
