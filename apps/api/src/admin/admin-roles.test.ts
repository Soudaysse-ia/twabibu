import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { areasFor, canAccess, mfaFresh } from './admin-roles.js';

describe('back-office roles', () => {
  it('gives each role its own areas and keeps audit and flags for super admins', () => {
    assert.equal(canAccess(['VERIFIER'], 'verification'), true);
    assert.equal(canAccess(['VERIFIER'], 'patients'), false);
    assert.equal(canAccess(['SUPPORT'], 'patients'), true);
    assert.equal(canAccess(['VERIFIER'], 'referentials'), true);
    assert.equal(canAccess(['SUPPORT'], 'referentials'), false);
    assert.equal(canAccess(['SUPPORT'], 'placements'), false);
    assert.equal(canAccess(['FINANCE'], 'placements'), true);
    assert.equal(canAccess(['FINANCE', 'SUPPORT'], 'audit'), false);
    assert.equal(canAccess(['SUPERADMIN'], 'flags'), true);
    assert.equal(canAccess([], 'dashboard'), false);
    assert.deepEqual(areasFor(['SUPPORT']), ['dashboard', 'structures', 'patients', 'notifications', 'reports']);
    assert.equal(canAccess(['VERIFIER'], 'reports'), true);
    assert.equal(canAccess(['FINANCE'], 'reports'), false);
  });

  it('asks for the second factor again after 12 hours', () => {
    const now = new Date('2026-11-14T12:00:00Z');
    assert.equal(mfaFresh(new Date('2026-11-14T01:00:00Z'), now), true);
    assert.equal(mfaFresh(new Date('2026-11-13T23:00:00Z'), now), false);
    assert.equal(mfaFresh(null, now), false);
  });
});
