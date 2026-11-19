export const fieldClass =
  'h-11 w-full rounded-md border border-border bg-surface px-3 text-base text-ink focus:border-primary focus:outline-2 focus:outline-primary/30 sm:text-sm';

/** `vendredi 13 nov. 2026, 22:41` in Comoros time. */
export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { timeZone: 'Indian/Comoro', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const dateOnly = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Indian/Comoro', day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export const ISLAND: Record<string, string> = { NGAZIDJA: 'Ngazidja', NDZUANI: 'Ndzuani', MWALI: 'Mwali' };
export const SLOT: Record<string, string> = { LOCALITY_TOP: 'En tête de l’annuaire', DUTY_PAGE: 'Page des gardes', DRUG_PAGE: 'Pages médicaments' };
export const VERIFICATION: Record<string, string> = { UNVERIFIED: 'Non vérifié', PENDING: 'En attente', CHANGES_REQUESTED: 'Compléments demandés', VERIFIED: 'Vérifié', REJECTED: 'Refusé' };
export const ORG_TYPE: Record<string, string> = { SOLO_PRACTICE: 'Cabinet individuel', GROUP_PRACTICE: 'Cabinet de groupe', HEALTH_CENTER: 'Centre de santé', CLINIC: 'Clinique', HOSPITAL: 'Hôpital', LAB: 'Laboratoire', PHARMACY: 'Pharmacie' };
export const ORG_STATUS: Record<string, string> = { PENDING: 'En création', ACTIVE: 'Active', SUSPENDED: 'Suspendue' };
