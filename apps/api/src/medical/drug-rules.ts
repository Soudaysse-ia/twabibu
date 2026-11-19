import { searchKey } from '@twabibu/utils';

/**
 * Rule-based prescription alerts (SPEC-14 §Rédaction 3). Deliberately simple and explainable:
 * no interaction database, no AI. A practitioner can always override an allergy alert with a justification.
 */
const CLASSES: Record<string, readonly string[]> = {
  penicilline: ['amoxicilline', 'ampicilline', 'penicilline', 'cloxacilline', 'oxacilline', 'benzathine'],
  sulfamide: ['cotrimoxazole', 'sulfamethoxazole', 'sulfadoxine'],
  ains: ['ibuprofene', 'diclofenac', 'ketoprofene', 'naproxene', 'aspirine', 'acide acetylsalicylique'],
};

/** True when a drug (its DCI) belongs to what the patient is allergic to (a DCI or a drug class). */
export function allergyMatches(allergy: { substance: string; drugDci: string | null }, dci: string): boolean {
  const drug = searchKey(dci);
  const target = searchKey(allergy.drugDci ?? allergy.substance);
  if (!target) return false;
  if (drug.includes(target) || target.includes(drug)) return true;
  for (const [cls, members] of Object.entries(CLASSES)) {
    if (target.includes(cls) && members.some((m) => drug.includes(m))) return true;
  }
  return false;
}

/** Components of a combination: "Amoxicilline + acide clavulanique" → ["amoxicilline", "acide clavulanique"]. */
export function dciComponents(dci: string): string[] {
  return dci.split('+').map((p) => searchKey(p)).filter(Boolean);
}

export function sharesComponent(a: string, b: string): boolean {
  const ca = dciComponents(a);
  return dciComponents(b).some((x) => ca.includes(x));
}
