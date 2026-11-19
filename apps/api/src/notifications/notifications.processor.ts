import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { EMAIL_PROVIDER, type EmailProvider } from './email-provider.js';
import { NOTIFICATIONS_QUEUE, type NotificationJob } from './notifications.service.js';
import { SMS_PROVIDER, type SmsProvider } from './sms-provider.js';

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
  ) {
    super();
  }

  async process(job: Job<NotificationJob>): Promise<void> {
    const n = await this.prisma.notification.findUnique({ where: { id: job.data.notificationId } });
    if (!n || n.status === 'SENT' || n.status === 'DELIVERED' || !n.recipient) return;
    const payload = n.payload as { text?: string; subject?: string; html?: string };
    const provider = n.channel === 'EMAIL' ? this.email.name : this.sms.name;
    try {
      const { providerId } =
        n.channel === 'EMAIL'
          ? await this.email.send({ to: n.recipient, subject: payload.subject ?? '', text: payload.text ?? '', html: payload.html ?? '' })
          : await this.sms.send(n.recipient, payload.text ?? '');
      await this.prisma.notification.update({ where: { id: n.id }, data: { status: 'SENT', provider, providerId, sentAt: new Date(), error: null } });
    } catch (error) {
      const last = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      await this.prisma.notification.update({ where: { id: n.id }, data: { status: last ? 'FAILED' : 'QUEUED', provider, error: (error as Error).message.slice(0, 500) } });
      throw error;
    }
  }
}
