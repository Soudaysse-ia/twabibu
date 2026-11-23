import { Inject, Injectable, Logger } from '@nestjs/common';
import { addDaysToDateKey, toDateKey } from '@twabibu/utils';
import { AvailabilityService } from '../availability/availability.service.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { practitionerName } from '../booking/appointment-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { emailTemplates } from './email-templates.js';
import { NotificationsService } from './notifications.service.js';
import { smsTemplates } from './sms-templates.js';

export type AppointmentMessageKind = 'booked' | 'pending' | 'accepted' | 'refused' | 'rescheduled' | 'cancelledByPractice' | 'cancelledByPatient' | 'reminder';

const TEMPLATE_KEY: Record<AppointmentMessageKind, string> = {
  booked: 'appointment.booked',
  pending: 'appointment.pending',
  accepted: 'appointment.accepted',
  refused: 'appointment.refused',
  rescheduled: 'appointment.rescheduled',
  cancelledByPractice: 'appointment.cancelled_by_practice',
  cancelledByPatient: 'appointment.cancelled_by_patient',
  reminder: 'appointment.reminder',
};

const EMAIL = {
  booked: emailTemplates.appointmentBooked,
  pending: emailTemplates.appointmentPending,
  accepted: emailTemplates.appointmentAccepted,
  refused: emailTemplates.appointmentRefused,
  rescheduled: emailTemplates.appointmentRescheduled,
  cancelledByPractice: emailTemplates.appointmentCancelledByPractice,
  cancelledByPatient: emailTemplates.appointmentCancelledByPatient,
  reminder: emailTemplates.appointmentReminder,
} as const;

const SMS = {
  booked: smsTemplates.appointmentBooked,
  pending: smsTemplates.appointmentPending,
  accepted: smsTemplates.appointmentAccepted,
  refused: smsTemplates.appointmentRefused,
  rescheduled: smsTemplates.appointmentRescheduled,
  cancelledByPractice: smsTemplates.appointmentCancelledByPractice,
  cancelledByPatient: smsTemplates.appointmentCancelledByPatient,
  reminder: smsTemplates.appointmentReminder,
} as const;

/**
 * Tells the patient about their appointment, by e-mail first (ADR-016).
 * SMS is only a fallback for people registered at the desk with a phone number and no e-mail.
 */
@Injectable()
export class AppointmentMessagesService {
  private readonly logger = new Logger(AppointmentMessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly availability: AvailabilityService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Up to 3 free online times in the next 14 days with the same practitioner and motive, as booking links with the
   * time preselected. None when the practitioner or the motive is not bookable online. Best effort: a failure here
   * never stops the cancellation message.
   */
  private async alternatives(a: { agendaId: string; motiveId: string; patientProfileId: string | null }, bookingUrl: string) {
    try {
      const motive = await this.prisma.motive.findFirst({
        where: { id: a.motiveId, isActive: true, isOnline: true, agenda: { onlineBookingEnabled: true, practitioner: { isPublished: true, verificationStatus: 'VERIFIED', deletedAt: null } } },
        select: { id: true },
      });
      if (!motive) return [];
      const today = toDateKey(new Date());
      const result = await this.availability.days(a.agendaId, a.motiveId, today, addDaysToDateKey(today, 13), { source: 'ONLINE', patientProfileId: a.patientProfileId });
      return (result?.days ?? [])
        .flatMap((d) => d.slots)
        .slice(0, 3)
        .map((s) => ({ startsAt: s.startsAt, url: `${bookingUrl}?motif=${a.motiveId}&creneau=${encodeURIComponent(s.startsAt.toISOString())}` }));
    } catch (error) {
      this.logger.warn(`No alternative times for appointment cancellation: ${(error as Error).message}`);
      return [];
    }
  }

  async send(appointmentId: string, kind: AppointmentMessageKind, options: { confirmUrl?: string } = {}): Promise<'EMAIL' | 'SMS' | null> {
    const a = await this.prisma.appointment.findUniqueOrThrow({
      where: { id: appointmentId },
      include: {
        patientRecord: true,
        agenda: { include: { practitioner: { include: { speciality: true } }, practice: { include: { locality: true } } } },
      },
    });
    const account = a.patientProfileId
      ? await this.prisma.patientProfile.findUnique({ where: { id: a.patientProfileId }, include: { user: { select: { id: true, email: true, phone: true } } } })
      : null;
    const p = a.agenda.practitioner;
    const practice = a.agenda.practice;
    // A refused request sends the patient back to the practitioner's page to pick another time.
    const manageUrl = account && kind !== 'refused'
      ? `${this.config.APP_URL}/mon-compte/rendez-vous`
      : `${this.config.APP_URL}/${p.speciality.slug}/${practice.locality.slug}/${p.slug}`;
    // Cancelled by the practice: offer other times right away (P5), and point the button at the booking page.
    const profileUrl = `${this.config.APP_URL}/${p.speciality.slug}/${practice.locality.slug}/${p.slug}`;
    const alternatives = kind === 'cancelledByPractice' ? await this.alternatives(a, `${profileUrl}/reserver`) : [];
    const emailManageUrl = alternatives.length ? `${profileUrl}/reserver?motif=${a.motiveId}` : manageUrl;
    const email = account?.user.email ?? a.patientRecord.email;
    const phone = account?.user.phone ?? a.patientRecord.phone;
    const userId = account?.user.id ?? null;
    const template = TEMPLATE_KEY[kind];

    if (email) {
      await this.notifications.sendEmail({
        to: email,
        email: EMAIL[kind]({
          firstName: account?.firstName ?? a.patientRecord.firstName,
          practitionerName: practitionerName(p),
          address: `${practice.name}, ${practice.addressLine}, ${practice.locality.name}`,
          startsAt: a.startsAt,
          manageUrl: emailManageUrl,
          alternatives,
          // Reminders only (other templates ignore these fields).
          confirmUrl: options.confirmUrl,
          preferencesUrl: account ? `${this.config.APP_URL}/mon-compte/profil#rappels` : undefined,
        }),
        template,
        userId,
        appointmentId: a.id,
      });
      return 'EMAIL';
    }
    if (phone) {
      await this.notifications.sendSms({
        to: phone,
        text: SMS[kind]({ practitionerName: practitionerName(p), locality: practice.locality.name, startsAt: a.startsAt, manageUrl: manageUrl.replace(/^https?:\/\//, '') }),
        template,
        userId,
        appointmentId: a.id,
      });
      return 'SMS';
    }
    return null;
  }
}
