/** Shapes of the /v1/pro API (apps/api/src/pro). */

export type ProRole = 'OWNER' | 'ADMIN' | 'PRACTITIONER' | 'SECRETARY';

export interface ProMembership {
  organizationId: string;
  organizationName: string;
  role: ProRole;
  practitionerId: string | null;
  displayName: string;
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'CHANGES_REQUESTED' | 'VERIFIED' | 'REJECTED' | null;
}

export interface ProMe {
  userId: string;
  email: string | null;
  memberships: ProMembership[];
}

export interface ProAgenda {
  id: string;
  name: string;
  color: string;
  slotStepMinutes: number;
  practiceName: string;
  practitioner: { id: string; name: string; speciality: string };
  motives: { id: string; name: string; durationMinutes: number; color: string; isOnline: boolean }[];
  mine: boolean;
}

export type AppointmentStatus = 'PENDING_VALIDATION' | 'CONFIRMED' | 'ARRIVED' | 'IN_CONSULTATION' | 'DONE' | 'NO_SHOW' | 'CANCELLED_BY_PATIENT' | 'CANCELLED_BY_PRACTICE';

export interface ProAppointment {
  id: string;
  agendaId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  source: 'ONLINE' | 'PRACTICE' | 'PHONE' | 'WALK_IN';
  allowOverlap: boolean;
  confirmedByPatientAt: string | null;
  notes: string | null;
  patientMessage: string | null;
  motive: { id: string; name: string; color: string };
  patient: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null; birthDate: string | null; noShowCount: number; hasAccount: boolean };
}

export interface AgendaEvents {
  agendaIds: string[];
  appointments: ProAppointment[];
  absences: { id: string; agendaId: string; startsAt: string; endsAt: string; reason: string | null }[];
  windows: { agendaId: string; date: string; startMinutes: number; endMinutes: number }[];
  holidays: { date: string; name: string }[];
}

export interface PatientHit {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  isBlocked: boolean;
  noShowCount: number;
  hasAccount: boolean;
  nextAppointmentAt: string | null;
}

export interface AgendaSettings {
  canEdit: boolean;
  agenda: {
    id: string;
    name: string;
    slotStepMinutes: number;
    bookingHorizonDays: number;
    minNoticeMinutes: number;
    maxActiveAppointmentsPerPatient: number;
    onlineBookingEnabled: boolean;
    requiresValidation: boolean;
  };
  motives: {
    id: string;
    name: string;
    durationMinutes: number;
    color: string;
    isOnline: boolean;
    newPatientsAllowed: boolean;
    instructions: string | null;
    priceKmf: number | null;
    cancellationDeadlineHours: number;
    isActive: boolean;
    sortOrder: number;
  }[];
  rules: { id: string; weekday: number; startMinutes: number; endMinutes: number; motiveIds: string[] }[];
}

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING_VALIDATION: 'À valider',
  CONFIRMED: 'Confirmé',
  ARRIVED: 'Arrivé',
  IN_CONSULTATION: 'En consultation',
  DONE: 'Terminé',
  NO_SHOW: 'Non honoré',
  CANCELLED_BY_PATIENT: 'Annulé par le patient',
  CANCELLED_BY_PRACTICE: 'Annulé par le cabinet',
};

export const SOURCE_LABEL: Record<ProAppointment['source'], string> = {
  ONLINE: 'En ligne',
  PRACTICE: 'Cabinet',
  PHONE: 'Téléphone',
  WALK_IN: 'Sur place',
};

/** Status changes the API accepts (mirror of apps/api/src/pro/permissions.ts). */
export const NEXT_STATUSES: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  PENDING_VALIDATION: ['CONFIRMED'],
  CONFIRMED: ['ARRIVED', 'IN_CONSULTATION', 'DONE', 'NO_SHOW'],
  ARRIVED: ['IN_CONSULTATION', 'DONE', 'CONFIRMED'],
  IN_CONSULTATION: ['DONE', 'ARRIVED'],
  DONE: ['IN_CONSULTATION'],
  NO_SHOW: ['CONFIRMED'],
};

/** Eight pastel colours of the design tokens (`calendar-*`), one per agenda when several are shown. */
export const AGENDA_COLORS = ['blue', 'teal', 'green', 'yellow', 'orange', 'pink', 'purple', 'grey'] as const;

/** GET /v1/pro/orgs/:orgId/dashboard: administrative only, no medical data. */
export interface ProDashboard {
  date: string;
  today: {
    total: number;
    done: number;
    remaining: number;
    /** Over but never marked done or no-show. */
    toClose: number;
    noShow: number;
    items: {
      id: string;
      startsAt: string;
      endsAt: string;
      status: AppointmentStatus;
      toClose: boolean;
      source: string;
      motive: string;
      color: string;
      confirmedByPatient: boolean;
      practitioner: string;
      patient: { id: string; name: string; age: number | null; noShowCount: number };
    }[];
  };
  nextAppointmentId: string | null;
  pending: { id: string; startsAt: string; motive: string; patient: { id: string; name: string } }[];
  nextSevenDays: number;
  last30Days: { appointments: number; noShows: number; online: number };
  recentPatients: { id: string; name: string; age: number | null; lastVisitAt: string }[];
}

/** GET /v1/pro/orgs/:orgId/patients/:id: contact and appointments (for the whole team). */
export interface ProPatientOverview {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  age: number | null;
  phone: string | null;
  email: string | null;
  hasAccount: boolean;
  noShowCount: number;
  isBlocked: boolean;
  canOpenRecord: boolean;
  appointments: { id: string; startsAt: string; status: AppointmentStatus; motive: string; practitioner: string; upcoming: boolean }[];
}
