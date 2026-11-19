/**
 * Who may do what inside a practice (SPEC-07 §Rôles). Pure functions: easy to test, used by every /v1/pro route.
 * The secretary never reaches clinical data; that rule lives in the medical-records module (SPEC-13).
 */
export type ProRole = 'OWNER' | 'ADMIN' | 'PRACTITIONER' | 'SECRETARY' | 'PHARMACIST' | 'PHARMACY_STAFF';

export interface MembershipPermissions {
  /** Practitioner: may see colleagues' agendas. */
  allAgendas?: boolean;
  /** Secretary: limited to these agendas (all agendas of the practice when absent). */
  agendaIds?: string[];
  /** Secretary: may change motives, online windows and absences. */
  manageSettings?: boolean;
  /** Secretary: may book over an existing appointment. */
  forceOverlap?: boolean;
}

export interface MembershipContext {
  id: string;
  organizationId: string;
  role: ProRole;
  practitionerId: string | null;
  permissions: MembershipPermissions;
}

interface AgendaRef {
  id: string;
  practitionerId: string;
}

const isManager = (m: MembershipContext) => m.role === 'OWNER' || m.role === 'ADMIN';

/** Practice-wide settings (reminders, team): owner and administrators only. */
export function canManagePractice(m: MembershipContext): boolean {
  return isManager(m);
}

export function canViewAgenda(m: MembershipContext, agenda: AgendaRef): boolean {
  if (isManager(m)) return true;
  if (m.role === 'PRACTITIONER') return agenda.practitionerId === m.practitionerId || !!m.permissions.allAgendas;
  if (m.role === 'SECRETARY') return !m.permissions.agendaIds || m.permissions.agendaIds.includes(agenda.id);
  return false;
}

export function canManageAgendaSettings(m: MembershipContext, agenda: AgendaRef): boolean {
  if (isManager(m)) return true;
  if (m.role === 'PRACTITIONER') return agenda.practitionerId === m.practitionerId;
  if (m.role === 'SECRETARY') return !!m.permissions.manageSettings && canViewAgenda(m, agenda);
  return false;
}

export function canForceOverlap(m: MembershipContext): boolean {
  if (isManager(m) || m.role === 'PRACTITIONER') return true;
  return m.role === 'SECRETARY' && !!m.permissions.forceOverlap;
}

export function isPracticeRole(m: MembershipContext): boolean {
  return m.role === 'OWNER' || m.role === 'ADMIN' || m.role === 'PRACTITIONER' || m.role === 'SECRETARY';
}

/** Allowed status changes made by the practice (SPEC-05 §Règles 4). Cancellation has its own route. */
const TRANSITIONS: Record<string, readonly string[]> = {
  PENDING_VALIDATION: ['CONFIRMED'],
  CONFIRMED: ['ARRIVED', 'IN_CONSULTATION', 'DONE', 'NO_SHOW'],
  ARRIVED: ['IN_CONSULTATION', 'DONE', 'CONFIRMED'],
  IN_CONSULTATION: ['DONE', 'ARRIVED'],
  DONE: ['IN_CONSULTATION'],
  NO_SHOW: ['CONFIRMED'],
};

export function canTransition(from: string, to: string): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
