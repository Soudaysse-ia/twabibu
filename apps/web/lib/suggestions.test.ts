import { describe, expect, it } from 'vitest';
import { localWhatSuggestions, localWhereSuggestions } from './suggestions';

describe('local search suggestions', () => {
  it('finds specialities without accents, prefix matches first', () => {
    const r = localWhatSuggestions('pedi');
    expect(r[0]).toMatchObject({ kind: 'speciality', slug: 'pediatre', label: 'Pédiatre' });
    expect(localWhatSuggestions('p')).toEqual([]);
  });
  it('finds islands by Comorian or French name and localities with their island', () => {
    expect(localWhereSuggestions('anjouan')[0]).toMatchObject({ kind: 'island', slug: 'ndzuani' });
    expect(localWhereSuggestions('MORO')[0]).toMatchObject({ kind: 'locality', slug: 'moroni', detail: 'Ngazidja' });
    expect(localWhereSuggestions('mutsa')[0]).toMatchObject({ slug: 'mutsamudu', detail: 'Ndzuani' });
  });
});
