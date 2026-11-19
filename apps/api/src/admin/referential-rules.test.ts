import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { drugFlags, drugSlug, isInComoros, motivesProblem, specialitySlug } from './referential-rules.js';

describe('reference data rules', () => {
  it('builds the same slugs as the seed', () => {
    assert.equal(specialitySlug('Médecin généraliste'), 'medecin-generaliste');
    assert.equal(drugSlug({ dci: 'Paracétamol', strength: '500 mg', form: 'comprimé' }), 'paracetamol-500-mg-comprime');
  });

  it('keeps localities inside the Comoros', () => {
    assert.equal(isInComoros(-11.7015, 43.256), true); // Moroni
    assert.equal(isInComoros(-12.28, 43.7425), true); // Fomboni
    assert.equal(isInComoros(43.256, -11.7015), false); // swapped
    assert.equal(isInComoros(11.7015, 43.256), false); // wrong sign
    assert.equal(isInComoros(-12.78, 45.2), false); // Mayotte
  });

  it('checks motive templates', () => {
    assert.equal(motivesProblem([{ name: 'Consultation', durationMinutes: 20 }, { name: 'Vaccination', durationMinutes: 15 }]), null);
    assert.match(motivesProblem([{ name: 'Consultation', durationMinutes: 20 }, { name: 'consultation ', durationMinutes: 30 }])!, /double/);
    assert.match(motivesProblem([{ name: 'Suivi', durationMinutes: 7 }])!, /Durée invalide/);
    assert.match(motivesProblem([{ name: 'Suivi', durationMinutes: 300 }])!, /Durée invalide/);
    assert.match(motivesProblem([{ name: ' ', durationMinutes: 20 }])!, /nom/);
  });

  it('never lets a controlled drug be sold without prescription', () => {
    assert.deepEqual(drugFlags({ prescriptionOnly: false, controlled: true }), { prescriptionOnly: true, controlled: true });
    assert.deepEqual(drugFlags({ prescriptionOnly: false, controlled: false }), { prescriptionOnly: false, controlled: false });
  });
});
