import { REFERENCE_ISLANDS, REFERENCE_LOCALITIES, REFERENCE_SPECIALITIES } from '@twabibu/contracts';
import { searchKey } from '@twabibu/utils';

export interface WhatSuggestion {
  kind: 'speciality' | 'practitioner';
  slug: string;
  label: string;
  detail?: string;
}

export interface WhereSuggestion {
  kind: 'island' | 'locality';
  slug: string;
  label: string;
  detail?: string;
}

/** Prefix matches first, then substring matches, accent- and case-insensitive. */
function rank<T>(items: readonly T[], label: (t: T) => string, term: string, limit: number): T[] {
  const key = searchKey(term);
  if (key.length < 2) return [];
  const scored = items
    .map((item) => ({ item, k: searchKey(label(item)) }))
    .filter(({ k }) => k.includes(key))
    .sort((a, b) => Number(b.k.startsWith(key)) - Number(a.k.startsWith(key)) || a.k.localeCompare(b.k));
  return scored.slice(0, limit).map(({ item }) => item);
}

/** Offline fallback for the "what" field, from the reference list shipped with the site. */
export function localWhatSuggestions(term: string): WhatSuggestion[] {
  return rank(REFERENCE_SPECIALITIES, (s) => s.name, term, 6).map((s) => ({ kind: 'speciality', slug: s.slug, label: s.name }));
}

/** Offline fallback for the "where" field. */
export function localWhereSuggestions(term: string): WhereSuggestion[] {
  const islandName = (code: string) => REFERENCE_ISLANDS.find((i) => i.code === code)?.name ?? '';
  const islands = rank(REFERENCE_ISLANDS, (i) => `${i.name} ${i.frenchName}`, term, 3).map(
    (i): WhereSuggestion => ({ kind: 'island', slug: i.slug, label: i.name, detail: i.frenchName }),
  );
  const localities = rank(REFERENCE_LOCALITIES, (l) => l.name, term, 8).map(
    (l): WhereSuggestion => ({ kind: 'locality', slug: l.slug, label: l.name, detail: islandName(l.island) }),
  );
  return [...islands, ...localities];
}
