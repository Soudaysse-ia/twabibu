import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { practitionerName } from '../booking/appointment-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { emailTemplates } from './email-templates.js';
import { NotificationsService } from './notifications.service.js';
import { smsTemplates } from './sms-templates.js';

export type AppointmentMessageKind = 'booked' | 'pending' | 'rescheduled' | 'cancelledByPractice' | 'cancelledByPatient' | 'reminder';

const TEMPLATE_KEY: Record<AppointmentMessageKind, string> = {
  booked: 'appointment.booked',
  pending: 'appointment.pending',
  rescheduled: 'appointment.rescheduled',
  cancelledByPractice: 'appointment.cancelled_by_practice',
  cancelledByPatient: 'appointment.cancelled_by_patient',
  reminder: 'appointment.reminder',
};

const EMAIL = {
  booked: emailTemplates.appointmentBooked,
  pending: emailTemplates.appointmentPending,
  rescheduled: emailTemplates.appointmentRescheduled,
  cancelledByPractice: emailTemplates.appointmentCancelledByPractice,
  cancelledByPatient: emailTemplates.appointmentCancelledByPatient,
  reminder: emailTemplates.appointmentReminder,
} as const;

const SMS = {
  booked: smsTemplates.appointmentBooked,
  pending: smsTemplates.appointmentPending,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

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
    const manageUrl = account
      ? `${this.config.APP_URL}/mon-compte/rendez-vous`
      : `${this.config.APP_URL}/${p.speciality.slug}/${practice.locality.slug}/${p.slug}`;
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
          manageUrl,
          // Reminders only (other templates ignore these fields).
          confirmUrl: options.confirmUrl,
          preferencesUrl: account ? `${this.config.APP_URL}/mon-compte/rendez-vous#rappels` : undefined,
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
