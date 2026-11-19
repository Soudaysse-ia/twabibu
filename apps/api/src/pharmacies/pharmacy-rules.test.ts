import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cartProblem, deliveryFee, hoursOn, isOpenAt, nextStatuses, onDutyAt, overlaps, patientCanCancel, placementActive, type ProductForCart } from './pharmacy-rules.js';

// 2026-11-13 is a Friday. Comoros = UTC+3.
const at = (iso: string) => new Date(iso);
const hours = { fri: [['08:00', '11:30']] as [string, string][], sat: [['08:30', '12:00']] as [string, string][] };

describe('pharmacy rules', () => {
  it('reads opening hours in Comoros time', () => {
    assert.equal(isOpenAt(hours, at('2026-11-13T05:00:00Z')), true); // 08:00 local
    assert.equal(isOpenAt(hours, at('2026-11-13T08:30:00Z')), false); // 11:30 local, closing time
    assert.equal(isOpenAt(hours, at('2026-11-15T07:00:00Z')), false); // Sunday
    assert.equal(hoursOn(hours, at('2026-11-14T07:00:00Z')), '08:30–12:00');
    assert.equal(hoursOn({}, at('2026-11-14T07:00:00Z')), null);
  });

  it('finds duties on a day and right now', () => {
    const duty = { startsAt: at('2026-11-13T15:00:00Z'), endsAt: at('2026-11-14T05:00:00Z') }; // 18:00 → 08:00 local
    assert.equal(onDutyAt(duty, at('2026-11-13T20:00:00Z')), true);
    assert.equal(onDutyAt(duty, at('2026-11-14T05:00:00Z')), false);
    assert.equal(overlaps(duty, at('2026-11-13T21:00:00Z'), at('2026-11-14T21:00:00Z')), true); // Saturday local
    assert.equal(overlaps(duty, at('2026-11-14T21:00:00Z'), at('2026-11-15T21:00:00Z')), false); // Sunday local
  });

  it('moves an order forward along its mode', () => {
    assert.deepEqual(nextStatuses('PREPARING', 'PICKUP'), ['READY', 'CANCELLED']);
    assert.deepEqual(nextStatuses('PREPARING', 'DELIVERY'), ['OUT_FOR_DELIVERY', 'CANCELLED']);
    assert.deepEqual(nextStatuses('DELIVERED', 'DELIVERY'), []);
    assert.equal(patientCanCancel('ACCEPTED'), true);
    assert.equal(patientCanCancel('PREPARING'), false);
  });

  it('never lets a controlled product into an online cart', () => {
    const base: ProductForCart = { availability: 'IN_STOCK', prescriptionOnly: false, controlled: false, drugId: 'd1' };
    assert.equal(cartProblem(base, new Set()), null);
    assert.equal(cartProblem({ ...base, controlled: true, prescriptionOnly: true }, new Set(['d1'])), 'CONTROLLED');
    assert.equal(cartProblem({ ...base, availability: 'OUT_OF_STOCK' }, new Set()), 'OUT_OF_STOCK');
    assert.equal(cartProblem({ ...base, prescriptionOnly: true }, new Set()), 'PRESCRIPTION_REQUIRED');
    assert.equal(cartProblem({ ...base, prescriptionOnly: true }, new Set(['d1'])), null);
  });

  it('prices delivery by zone and shows partners only while active', () => {
    assert.equal(deliveryFee([{ localityId: 'l1', feeKmf: 1000 }], 'l1'), 1000);
    assert.equal(deliveryFee([{ localityId: 'l1', feeKmf: 1000 }], 'l2'), null);
    const p = { startsAt: at('2026-11-01T00:00:00Z'), endsAt: at('2026-12-01T00:00:00Z') };
    assert.equal(placementActive(p, at('2026-11-13T00:00:00Z')), true);
    assert.equal(placementActive(p, at('2026-12-01T00:00:00Z')), false);
  });
});
