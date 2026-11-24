import type { Education, PractitionerProfileUpdate } from '@twabibu/contracts';

/** Pure rules for the public profile written in Twabibu Pro (PRO-07). No database here. */

export type CleanProfile = Omit<PractitionerProfileUpdate, 'insurances'> & { insurancesAccepted: string[] };

const unique = <T>(values: T[], key: (v: T) => string) => {
  const seen = new Set<string>();
  return values.filter((v) => {
    const k = key(v);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Tidies what the practitioner typed: an empty presentation is no presentation, tags and lists lose duplicates
 * (« Échographie » and « échographie » are one tag), diplomas are listed from the most recent.
 * Returns the problem instead when a diploma is dated in the future.
 */
export function cleanProfile(
  input: PractitionerProfileUpdate,
  currentYear: number,
): { ok: true; profile: CleanProfile } | { ok: false; reason: string } {
  const educations: Education[] = input.educations.map((e) => ({
    year: e.year,
    diploma: squash(e.diploma),
    school: squash(e.school),
  }));
  if (educations.some((e) => e.year > currentYear))
    return { ok: false, reason: 'A diploma cannot be dated in the future' };
  const bio = input.bio?.replace(/\r\n/g, '\n').trim() ?? '';
  return {
    ok: true,
    profile: {
      bio: bio || null,
      acceptsNewPatients: input.acceptsNewPatients,
      expertises: unique(input.expertises.map(squash), (e) => e.toLocaleLowerCase('fr')),
      languages: unique(input.languages, (l) => l),
      paymentMethods: unique(input.paymentMethods, (m) => m),
      insurancesAccepted: unique(input.insurances.map(squash), (i) => i),
      educations: [...educations].sort((a, b) => b.year - a.year),
    },
  };
}

/** Names of the fields that changed, for the audit log (never their content). */
export function changedFields(before: CleanProfile, after: CleanProfile): string[] {
  return (Object.keys(after) as (keyof CleanProfile)[]).filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
  );
}
