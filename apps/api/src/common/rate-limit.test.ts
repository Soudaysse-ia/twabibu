import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rateLimitKey, secondsToNextWindow } from './rate-limit.js';

describe('rate limit windows', () => {
  const t0 = Date.UTC(2026, 10, 21, 8, 0, 0);

  it('keeps one key per address and per minute', () => {
    assert.equal(rateLimitKey('search', '41.1.2.3', t0), rateLimitKey('search', '41.1.2.3', t0 + 59_999));
    assert.notEqual(rateLimitKey('search', '41.1.2.3', t0), rateLimitKey('search', '41.1.2.3', t0 + 60_000));
    assert.notEqual(rateLimitKey('search', '41.1.2.3', t0), rateLimitKey('search', '41.1.2.4', t0));
    assert.notEqual(rateLimitKey('search', '41.1.2.3', t0), rateLimitKey('publicRead', '41.1.2.3', t0));
  });

  it('tells the client when to retry, never 0', () => {
    assert.equal(secondsToNextWindow(t0), 60);
    assert.equal(secondsToNextWindow(t0 + 45_500), 15);
    assert.equal(secondsToNextWindow(t0 + 59_999), 1);
  });
});
