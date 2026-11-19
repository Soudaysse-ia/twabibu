import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allergyMatches, sharesComponent } from './drug-rules.js';

describe('prescription rules', () => {
  it('matches an allergy by DCI, combination, or class', () => {
    assert.equal(allergyMatches({ substance: 'Amoxicilline', drugDci: 'Amoxicilline' }, 'Amoxicilline + acide clavulanique'), true);
    assert.equal(allergyMatches({ substance: 'Pénicillines', drugDci: null }, 'Amoxicilline'), true);
    assert.equal(allergyMatches({ substance: 'Sulfamides', drugDci: null }, 'Cotrimoxazole'), true);
    assert.equal(allergyMatches({ substance: 'AINS', drugDci: null }, 'Ibuprofène'), true);
    assert.equal(allergyMatches({ substance: 'Pénicillines', drugDci: null }, 'Paracétamol'), false);
    assert.equal(allergyMatches({ substance: 'Arachide', drugDci: null }, 'Métronidazole'), false);
  });

  it('detects the same active ingredient in two lines', () => {
    assert.equal(sharesComponent('Paracétamol', 'Paracétamol'), true);
    assert.equal(sharesComponent('Amoxicilline', 'Amoxicilline + acide clavulanique'), true);
    assert.equal(sharesComponent('Ibuprofène', 'Paracétamol'), false);
  });
});
