import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { presenceToken } from '../common/presence-token.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppointmentMessagesService } from './appointment-messages.service.js';
import { DEFAULT_REMINDER_HOUR, DEFAULT_REMINDER_OFFSETS, LOOKAHEAD_DAYS, MIN_LEAD_MINUTES, reminderDecision, reminderDueAt } from './reminder-rules.js';

/** Upper bound per run; a backlog is caught up over the next runs (every 15 minutes). */
const BATCH_SIZE = 1000;

export interface ReminderRunReport {
  checked: number;
  sent: number;
  optedOut: number;
  failed: number;
}

/**
 * Sends the reminders that are due (SPEC-08 §Planification). Safe to run twice at the same time:
 * an AppointmentReminder row is claimed (unique key) before anything is sent.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messages: AppointmentMessagesService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async runDue(now: Date = new Date()): Promise<ReminderRunReport> {
    const report: ReminderRunReport = { checked: 0, sent: 0, optedOut: 0, failed: 0 };
    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: 'CONFIRMED',
        startsAt: { gt: new Date(now.getTime() + MIN_LEAD_MINUTES * 60_000), lte: new Date(now.getTime() + LOOKAHEAD_DAYS * 86_400_000) },
      },
      select: {
        id: true,
        startsAt: true,
        createdAt: true,
        patientProfileId: true,
        // Booked at the desk: the account (and its preferences) is only on the practice's patient file.
        patientRecord: { select: { patientProfileId: true } },
        agenda: { select: { practitioner: { select: { organizationId: true } } } },
        reminders: { select: { offsetHours: true, startsAt: true } },
      },
      orderBy: { startsAt: 'asc' },
      take: BATCH_SIZE,
    });
    if (!appointments.length) return report;

    const orgIds = [...new Set(appointments.map((a) => a.agenda.practitioner.organizationId))];
    const settings = new Map((await this.prisma.organizationNotificationSettings.findMany({ where: { organizationId: { in: orgIds } } })).map((s) => [s.organizationId, s]));
    const accountOf = (a: (typeof appointments)[number]) => a.patientProfileId ?? a.patientRecord.patientProfileId;
    const profileIds = appointments.map(accountOf).filter((id): id is string => !!id);
    const optedOutProfiles = new Set(
      (await this.prisma.patientProfile.findMany({ where: { id: { in: profileIds }, user: { notificationPreferences: { reminderOptOut: true } } }, select: { id: true } })).map((p) => p.id),
    );

    for (const a of appointments) {
      report.checked++;
      const s = settings.get(a.agenda.practitioner.organizationId);
      const offsets = s?.reminderOffsetsHours ?? DEFAULT_REMINDER_OFFSETS;
      const hour = s?.reminderHour ?? DEFAULT_REMINDER_HOUR;
      const due = offsets.filter((offset) => {
        if (a.reminders.some((r) => r.offsetHours === offset && r.startsAt.getTime() === a.startsAt.getTime())) return false;
        return reminderDecision({ startsAt: a.startsAt, createdAt: a.createdAt, dueAt: reminderDueAt(a.startsAt, offset, hour), now }) === 'SEND';
      });
      if (!due.length) continue;
      const account = accountOf(a);
      if (account && optedOutProfiles.has(account)) {
        report.optedOut++;
        continue;
      }
      // Claim every due offset at once: after downtime, the patient gets one reminder, not two.
      const claimed = await this.claim(a.id, a.startsAt, due);
      if (!claimed) continue;
      try {
        const confirmUrl = s?.askConfirmation ? `${this.config.APP_URL}/rendez-vous/${a.id}/confirmer?t=${presenceToken(this.config.SESSION_SECRET, a.id, a.startsAt)}` : undefined;
        const channel = await this.messages.send(a.id, 'reminder', { confirmUrl });
        await this.prisma.appointmentReminder.updateMany({ where: { appointmentId: a.id, startsAt: a.startsAt, offsetHours: { in: due } }, data: { channel } });
        report.sent++;
      } catch (error) {
        // Release the claim so the next run tries again.
        await this.prisma.appointmentReminder.deleteMany({ where: { appointmentId: a.id, startsAt: a.startsAt, offsetHours: { in: due } } });
        report.failed++;
        this.logger.error(`Reminder for appointment ${a.id} failed: ${(error as Error).message}`);
      }
    }
    if (report.sent || report.failed) this.logger.log(`Reminders: ${report.sent} sent, ${report.failed} failed, ${report.optedOut} opted out, ${report.checked} checked`);
    return report;
  }

  /** True when this run owns the reminder; false when another run already took it. */
  private async claim(appointmentId: string, startsAt: Date, offsets: number[]): Promise<boolean> {
    try {
      await this.prisma.appointmentReminder.createMany({ data: offsets.map((offsetHours) => ({ appointmentId, offsetHours, startsAt })) });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false;
      throw error;
    }
  }
}
