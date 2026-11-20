/**
 * Contact form limits (WEB-02). A public write route must be rate limited (securite-et-donnees-sante.md §5):
 * enough for a person who sends a follow-up, too little for a robot to flood the support inbox.
 */
import type { ContactTopic } from '@twabibu/contracts';

export const CONTACT_WINDOW_SECONDS = 60 * 60;
export const CONTACT_MAX_PER_IP = 5;
export const CONTACT_MAX_PER_EMAIL = 3;

export const CONTACT_TOPIC_LABELS: Record<ContactTopic, string> = {
  PATIENT: 'Patient',
  PRACTITIONER: 'Soignant',
  PHARMACY: 'Pharmacie',
  OTHER: 'Autre',
};

/** True when the honeypot field was filled in: a robot, accepted silently so it does not learn to adapt. */
export function isRobot(website: string | undefined): boolean {
  return website !== undefined && website.trim() !== '';
}
