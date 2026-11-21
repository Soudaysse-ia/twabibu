import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { MembershipContext, ProRole } from './permissions.js';
import {
  canEditSecretary,
  canInvite,
  canRemoveMember,
  invitationExpiry,
  invitationState,
} from './team-rules.js';

const member = (role: ProRole, id = role.toLowerCase()): MembershipContext => ({
  id,
  organizationId: 'org',
  role,
  practitionerId: null,
  permissions: {},
});

describe('team rules (PRO-05)', () => {
  const now = new Date('2026-11-21T10:00:00Z');

  it('tells pending, expired, accepted and revoked invitations apart', () => {
    const base = { expiresAt: invitationExpiry(now), acceptedAt: null, revokedAt: null };
    assert.equal(invitationState(base, now), 'PENDING');
    assert.equal(invitationState(base, new Date('2026-11-28T09:59:59Z')), 'PENDING');
    assert.equal(invitationState(base, new Date('2026-11-28T10:00:00Z')), 'EXPIRED');
    assert.equal(invitationState({ ...base, acceptedAt: now }, now), 'ACCEPTED');
    assert.equal(invitationState({ ...base, revokedAt: now }, now), 'REVOKED');
  });

  it('lets the owner invite anyone, an administrator only secretaries, and nobody else', () => {
    assert.equal(canInvite(member('OWNER'), 'ADMIN'), true);
    assert.equal(canInvite(member('OWNER'), 'SECRETARY'), true);
    assert.equal(canInvite(member('ADMIN'), 'SECRETARY'), true);
    assert.equal(canInvite(member('ADMIN'), 'ADMIN'), false);
    assert.equal(canInvite(member('PRACTITIONER'), 'SECRETARY'), false);
    assert.equal(canInvite(member('SECRETARY'), 'SECRETARY'), false);
  });

  it('never lets anyone remove the owner or themselves', () => {
    const owner = member('OWNER');
    const admin = member('ADMIN');
    assert.equal(canRemoveMember(owner, { id: 'secretary', role: 'SECRETARY' }), true);
    assert.equal(canRemoveMember(owner, { id: 'other-admin', role: 'ADMIN' }), true);
    assert.equal(canRemoveMember(owner, { id: owner.id, role: 'OWNER' }), false);
    assert.equal(canRemoveMember(admin, { id: 'owner', role: 'OWNER' }), false);
    assert.equal(canRemoveMember(admin, { id: 'other-admin', role: 'ADMIN' }), false);
    assert.equal(canRemoveMember(admin, { id: admin.id, role: 'ADMIN' }), false);
    assert.equal(canRemoveMember(admin, { id: 'dr', role: 'PRACTITIONER' }), true);
    assert.equal(canRemoveMember(member('PRACTITIONER'), { id: 'secretary', role: 'SECRETARY' }), false);
    assert.equal(canRemoveMember(member('SECRETARY'), { id: 'dr', role: 'PRACTITIONER' }), false);
  });

  it('lets managers change a secretary’s rights only', () => {
    assert.equal(canEditSecretary(member('ADMIN'), { role: 'SECRETARY' }), true);
    assert.equal(canEditSecretary(member('OWNER'), { role: 'PRACTITIONER' }), false);
    assert.equal(canEditSecretary(member('PRACTITIONER'), { role: 'SECRETARY' }), false);
  });
});
