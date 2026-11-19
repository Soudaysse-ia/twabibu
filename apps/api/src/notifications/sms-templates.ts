import { formatSmsDateTime } from '@twabibu/utils';

/**
 * SMS texts (SPEC-08). Rules: ≤ 160 GSM-7 characters, no accents, never any medical information
 * (no motive, no diagnosis), always the practitioner, the date and where to manage the appointment.
 */
export function toGsm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘]/g, "'")
    .replace(/[«»“”]/g, '"')
    .replace(/\u00a0/g, ' ');
}

function shorten(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}.`;
}

export interface AppointmentSmsData {
  practitionerName: string;
  locality: string;
  startsAt: Date;
  manageUrl: string;
}

export const smsTemplates = {
  otp: (code: string) => toGsm(`Twabibu : votre code est ${code}. Valable 5 min. Ne le partagez avec personne.`),

  appointmentBooked: (d: AppointmentSmsData) =>
    toGsm(`Twabibu : RDV confirme ${formatSmsDateTime(d.startsAt)} avec ${shorten(d.practitionerName, 28)}, ${shorten(d.locality, 16)}. Gerer : ${d.manageUrl}`),

  appointmentPending: (d: AppointmentSmsData) =>
    toGsm(`Twabibu : demande de RDV envoyee a ${shorten(d.practitionerName, 28)} pour ${formatSmsDateTime(d.startsAt)}. Vous recevrez une confirmation.`),

  appointmentRescheduled: (d: AppointmentSmsData) =>
    toGsm(`Twabibu : votre RDV avec ${shorten(d.practitionerName, 28)} est deplace au ${formatSmsDateTime(d.startsAt)}, ${shorten(d.locality, 16)}. Infos : ${d.manageUrl}`),

  appointmentCancelledByPractice: (d: AppointmentSmsData) =>
    toGsm(`Twabibu : ${shorten(d.practitionerName, 28)} a du annuler votre RDV du ${formatSmsDateTime(d.startsAt)}. Reprendre RDV : ${d.manageUrl}`),

  appointmentCancelledByPatient: (d: AppointmentSmsData) =>
    toGsm(`Twabibu : votre RDV du ${formatSmsDateTime(d.startsAt)} avec ${shorten(d.practitionerName, 28)} est annule. Reprendre RDV : ${d.manageUrl}`),

  /** Reminder (SPEC-08): no confirmation by SMS reply yet (needs an inbound SMS provider). */
  // A link is never cut: with a long name, place and link, the place goes first.
  appointmentReminder: (d: AppointmentSmsData) => {
    const full = toGsm(`Twabibu : rappel RDV ${formatSmsDateTime(d.startsAt)} avec ${shorten(d.practitionerName, 28)}, ${shorten(d.locality, 16)}. Gerer : ${d.manageUrl}`);
    return full.length <= 160 ? full : toGsm(`Twabibu : rappel RDV ${formatSmsDateTime(d.startsAt)} avec ${shorten(d.practitionerName, 28)}. Gerer : ${d.manageUrl}`);
  },
} as const;

export type SmsTemplate = keyof typeof smsTemplates;
