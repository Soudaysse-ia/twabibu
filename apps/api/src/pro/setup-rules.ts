/**
 * « Votre cabinet est prêt à X % » (SPEC-07 PRO-02): the six things a practice sets up before patients book.
 * Pure function over facts gathered by SetupService; the order is the order of SPEC-07 §Inscription 3.
 */

export type SetupStepKey = 'verification' | 'place' | 'hours' | 'motives' | 'availability' | 'profile';

export interface PractitionerFacts {
  verificationStatus: string;
  activeMotives: number;
  /** Active motives bookable online without a price: patients like to know the fee before they come. */
  onlineMotivesWithoutPrice: number;
  availabilityRules: number;
  hasBio: boolean;
}

export interface PlaceFacts {
  hasAddress: boolean;
  /** The pin is still at the centre of the town, where sign-up puts it. */
  pinAtLocalityCentre: boolean;
  openDays: number;
}

export interface SetupStep {
  key: SetupStepKey;
  done: boolean;
  /** Verification is Twabibu's job: the practice waits, it has nothing to do. */
  waiting?: boolean;
  href: string;
}

const HREF: Record<SetupStepKey, string> = {
  verification: '/aide/inscrire-mon-cabinet',
  place: '/pro/app/reglages/cabinet',
  hours: '/pro/app/reglages/cabinet',
  motives: '/pro/app/reglages#motifs',
  availability: '/pro/app/reglages#plages',
  profile: '/pro/app/reglages/profil',
};

/**
 * Steps for the practitioners in scope (one for a practitioner, all of them for the direction) and, for those who
 * manage the practice, its places. A step shared by several practitioners or places is done when it is done for all.
 */
export function setupSteps(input: { practitioners: PractitionerFacts[]; places: PlaceFacts[] | null }): {
  percent: number;
  steps: SetupStep[];
} {
  const all = <T>(list: T[], test: (x: T) => boolean) => list.length > 0 && list.every(test);
  const ps = input.practitioners;
  const steps: SetupStep[] = [];
  if (ps.length) {
    const verified = all(ps, (p) => p.verificationStatus === 'VERIFIED');
    steps.push({
      key: 'verification',
      done: verified,
      waiting: !verified && ps.some((p) => p.verificationStatus === 'PENDING'),
      href: HREF.verification,
    });
  }
  if (input.places) {
    steps.push({
      key: 'place',
      done: all(input.places, (p) => p.hasAddress && !p.pinAtLocalityCentre),
      href: HREF.place,
    });
    steps.push({ key: 'hours', done: all(input.places, (p) => p.openDays > 0), href: HREF.hours });
  }
  if (ps.length) {
    steps.push({
      key: 'motives',
      done: all(ps, (p) => p.activeMotives > 0 && p.onlineMotivesWithoutPrice === 0),
      href: HREF.motives,
    });
    steps.push({
      key: 'availability',
      done: all(ps, (p) => p.availabilityRules > 0),
      href: HREF.availability,
    });
    steps.push({ key: 'profile', done: all(ps, (p) => p.hasBio), href: HREF.profile });
  }
  const done = steps.filter((s) => s.done).length;
  return { percent: steps.length ? Math.round((done / steps.length) * 100) : 100, steps };
}
