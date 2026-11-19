import { slugify } from '@twabibu/utils';

/**
 * Reference data rules (SPEC-11 §5). Pure functions, tested in referential-rules.test.ts.
 * Slugs are part of public URLs (/{speciality}/{locality}/{practitioner}): created once, never renamed.
 */

/** The Union of the Comoros, with a margin: a point outside is a typing error (lat/lng swapped, wrong sign). */
export const COMOROS_BOUNDS = { latMin: -12.75, latMax: -11.25, lngMin: 43.0, lngMax: 44.75 } as const;

export const LOCALITY_KINDS = ['town', 'village', 'district'] as const;
export const DRUG_ROUTES = ['oral', 'injectable', 'cutanee', 'inhalee', 'rectale', 'ophtalmique', 'auriculaire', 'nasale', 'vaginale'] as const;
export const MOTIVE_DURATIONS = { min: 5, max: 240, step: 5 } as const;
export const MAX_DEFAULT_MOTIVES = 10;

export function isInComoros(lat: number, lng: number): boolean {
  return lat >= COMOROS_BOUNDS.latMin && lat <= COMOROS_BOUNDS.latMax && lng >= COMOROS_BOUNDS.lngMin && lng <= COMOROS_BOUNDS.lngMax;
}

export const specialitySlug = (name: string) => slugify(name);
export const localitySlug = (name: string) => slugify(name);
/** Same rule as the seed: `Paracétamol 500 mg comprimé` → `paracetamol-500-mg-comprime`. */
export const drugSlug = (d: { dci: string; strength: string; form: string }) => slugify(`${d.dci} ${d.strength} ${d.form}`);

export interface DefaultMotive {
  name: string;
  durationMinutes: number;
}

/** Motive templates offered to a new practitioner of the speciality. Returns an error message or null. */
export function motivesProblem(motives: DefaultMotive[]): string | null {
  if (motives.length > MAX_DEFAULT_MOTIVES) return `${MAX_DEFAULT_MOTIVES} motifs au plus`;
  const names = new Set<string>();
  for (const m of motives) {
    const name = m.name.trim();
    if (name.length < 2) return 'Un motif doit avoir un nom';
    const key = slugify(name);
    if (names.has(key)) return `Motif en double : ${name}`;
    names.add(key);
    const d = m.durationMinutes;
    if (!Number.isInteger(d) || d < MOTIVE_DURATIONS.min || d > MOTIVE_DURATIONS.max || d % MOTIVE_DURATIONS.step !== 0) return `Durée invalide pour « ${name} » : de 5 à 240 minutes, par pas de 5`;
  }
  return null;
}

/** A controlled drug is always prescription-only (and counter-only in pharmacies, SPEC-15 §7.3). */
export function drugFlags(input: { prescriptionOnly: boolean; controlled: boolean }) {
  return { prescriptionOnly: input.prescriptionOnly || input.controlled, controlled: input.controlled };
}
