import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkCrossSiteWrite, originsFrom } from './csrf.js';

const allowed = originsFrom(['https://twabibu.km', 'https://admin.twabibu.km/']);

describe('Cross-site write guard (SEC-03)', () => {
  it('lets reads through whatever their origin', () => {
    assert.deepEqual(checkCrossSiteWrite('GET', { origin: 'https://evil.example' }, allowed), { allowed: true });
    assert.deepEqual(checkCrossSiteWrite('head', { 'sec-fetch-site': 'cross-site' }, allowed), { allowed: true });
  });

  it('accepts writes from the site and the back-office', () => {
    assert.equal(checkCrossSiteWrite('POST', { origin: 'https://twabibu.km' }, allowed).allowed, true);
    assert.equal(checkCrossSiteWrite('DELETE', { origin: 'https://admin.twabibu.km' }, allowed).allowed, true);
  });

  it('refuses writes from another origin, a sibling sub-domain, plain http or an opaque origin', () => {
    for (const origin of ['https://evil.example', 'https://old.twabibu.km', 'http://twabibu.km', 'https://twabibu.km.evil.example', 'null']) {
      assert.equal(checkCrossSiteWrite('POST', { origin }, allowed).allowed, false, origin);
    }
  });

  it('falls back on Sec-Fetch-Site when there is no Origin', () => {
    assert.equal(checkCrossSiteWrite('PUT', { 'sec-fetch-site': 'cross-site' }, allowed).allowed, false);
    assert.equal(checkCrossSiteWrite('PATCH', { 'sec-fetch-site': 'same-site' }, allowed).allowed, false);
    assert.equal(checkCrossSiteWrite('POST', { 'sec-fetch-site': 'same-origin' }, allowed).allowed, true);
  });

  it('lets non-browser clients through (no Origin, no Sec-Fetch-Site)', () => {
    assert.equal(checkCrossSiteWrite('POST', {}, allowed).allowed, true);
  });
});
