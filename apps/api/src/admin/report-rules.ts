/**
 * Profile reports (SPEC-02, PROFILE-06; back-office SPEC-11 §6, ADMIN-07). Pure rules and labels, tested on their own.
 * A report never says who sent it to the practitioner, and never carries medical information on purpose: the form
 * asks for none, and only the back-office reads the free text.
 */
import type { ReportDecision, ReportReason } from '@twabibu/contracts';

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  WRONG_INFO: 'Informations inexactes (adresse, téléphone, horaires, tarifs)',
  CLOSED: 'Le cabinet est fermé ou a déménagé',
  NOT_A_PRACTITIONER: 'Cette personne n’est pas un soignant',
  BEHAVIOUR: 'Comportement inapproprié',
  OTHER: 'Autre problème',
};

/** Where a report goes after the decision: « contacter » keeps it under review until the profile is fixed. */
export function statusAfter(action: ReportDecision['action']): 'IN_REVIEW' | 'CLOSED' {
  return action === 'CONTACT' ? 'IN_REVIEW' : 'CLOSED';
}

/** Decisions apply to reports still open or under review; a closed report is history. */
export function canDecide(status: string): boolean {
  return status === 'OPEN' || status === 'IN_REVIEW';
}
