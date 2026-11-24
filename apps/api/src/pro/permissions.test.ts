import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canForceOverlap, canManageAgendaSettings, canMarkNoShow, canTransition, canViewAgenda, type MembershipContext } from './permissions.js';

const mine = { id: 'a1', practitionerId: 'p1' };
const colleague = { id: 'a2', practitionerId: 'p2' };
const m = (role: MembershipContext['role'], extra: Partial<MembershipContext> = {}): MembershipContext => ({
  id: 'm', organizationId: 'o', role, practitionerId: role === 'PRACTITIONER' ? 'p1' : null, permissions: {}, ...extra,
});

describe('practice permissions', () => {
  it('owners and admins see and configure every agenda', () => {
    for (const role of ['OWNER', 'ADMIN'] as const) {
      assert.equal(canViewAgenda(m(role), colleague), true);
      assert.equal(canManageAgendaSettings(m(role), colleague), true);
      assert.equal(canForceOverlap(m(role)), true);
    }
  });

  it('a practitioner manages only their own agenda, and sees colleagues only when allowed', () => {
    assert.equal(canViewAgenda(m('PRACTITIONER'), mine), true);
    assert.equal(canViewAgenda(m('PRACTITIONER'), colleague), false);
    assert.equal(canViewAgenda(m('PRACTITIONER', { permissions: { allAgendas: true } }), colleague), true);
    assert.equal(canManageAgendaSettings(m('PRACTITIONER', { permissions: { allAgendas: true } }), colleague), false);
    assert.equal(canForceOverlap(m('PRACTITIONER')), true);
  });

  it('a secretary sees the agendas she is assigned, and needs explicit rights for settings and overbooking', () => {
    assert.equal(canViewAgenda(m('SECRETARY'), colleague), true);
    assert.equal(canViewAgenda(m('SECRETARY', { permissions: { agendaIds: ['a1'] } }), colleague), false);
    assert.equal(canManageAgendaSettings(m('SECRETARY'), mine), false);
    assert.equal(canManageAgendaSettings(m('SECRETARY', { permissions: { manageSettings: true } }), mine), true);
    assert.equal(canForceOverlap(m('SECRETARY')), false);
    assert.equal(canForceOverlap(m('SECRETARY', { permissions: { forceOverlap: true } })), true);
  });

  it('pharmacy staff never reach a practice agenda', () => {
    assert.equal(canViewAgenda(m('PHARMACIST'), mine), false);
    assert.equal(canManageAgendaSettings(m('PHARMACY_STAFF'), mine), false);
  });

  it('only allows sensible status changes', () => {
    assert.equal(canTransition('CONFIRMED', 'ARRIVED'), true);
    assert.equal(canTransition('CONFIRMED', 'NO_SHOW'), true);
    assert.equal(canTransition('NO_SHOW', 'CONFIRMED'), true);
    assert.equal(canTransition('PENDING_VALIDATION', 'DONE'), false);
    assert.equal(canTransition('CANCELLED_BY_PATIENT', 'CONFIRMED'), false);
    assert.equal(canTransition('DONE', 'NO_SHOW'), false);
  });

  it('records a no-show only once the appointment time has passed', () => {
    const startsAt = new Date('2026-11-24T07:00:00Z');
    assert.equal(canMarkNoShow(startsAt, new Date('2026-11-24T06:59:59Z')), false);
    assert.equal(canMarkNoShow(startsAt, startsAt), true);
    assert.equal(canMarkNoShow(startsAt, new Date('2026-11-24T18:00:00Z')), true);
  });
});
