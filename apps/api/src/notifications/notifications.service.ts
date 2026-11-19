import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RenderedEmail } from './email-templates.js';

export const NOTIFICATIONS_QUEUE = 'notifications';

export interface NotificationJob {
  notificationId: string;
}

/** Every outgoing message goes through here: a Notification row, then an async job (SPEC-08 §Règles 1). */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue<NotificationJob>,
  ) {}

  private async enqueue(notificationId: string): Promise<void> {
    try {
      await this.queue.add('send', { notificationId }, { attempts: 3, backoff: { type: 'exponential', delay: 60_000 }, removeOnComplete: 1000, removeOnFail: 5000 });
    } catch (error) {
      // Redis down: keep the row QUEUED so a later sweep can resend it, never fail the user action.
      this.logger.error(`Could not enqueue notification ${notificationId}: ${(error as Error).message}`);
    }
  }

  async sendEmail(params: { to: string; email: RenderedEmail; template: string; userId?: string | null; appointmentId?: string | null; orderId?: string | null }): Promise<string> {
    const n = await this.prisma.notification.create({
      data: {
        channel: 'EMAIL',
        recipient: params.to,
        userId: params.userId ?? null,
        template: params.template,
        payload: { subject: params.email.subject, text: params.email.text, html: params.email.html },
        relatedAppointmentId: params.appointmentId ?? null,
        relatedOrderId: params.orderId ?? null,
      },
    });
    await this.enqueue(n.id);
    return n.id;
  }

  /** Back-office: send a failed message again (same content, new attempts). */
  async requeue(notificationId: string): Promise<void> {
    await this.prisma.notification.update({ where: { id: notificationId }, data: { status: 'QUEUED', error: null } });
    await this.enqueue(notificationId);
  }

  async sendSms(params: { to: string; text: string; template: string; userId?: string | null; appointmentId?: string | null }): Promise<string> {
    const n = await this.prisma.notification.create({
      data: {
        channel: 'SMS',
        recipient: params.to,
        userId: params.userId ?? null,
        template: params.template,
        payload: { text: params.text },
        relatedAppointmentId: params.appointmentId ?? null,
      },
    });
    await this.enqueue(n.id);
    return n.id;
  }
}
