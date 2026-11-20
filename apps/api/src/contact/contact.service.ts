import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ContactRequest } from '@twabibu/contracts';
import { ApiException } from '../common/api-exception.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { emailTemplates } from '../notifications/email-templates.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RedisService } from '../redis/redis.service.js';
import {
  CONTACT_MAX_PER_EMAIL,
  CONTACT_MAX_PER_IP,
  CONTACT_TOPIC_LABELS,
  CONTACT_WINDOW_SECONDS,
  isRobot,
} from './contact-rules.js';

/** Contact form (WEB-02): one e-mail to the support address, through the notification journal (SPEC-08). */
@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Counts one more message for `key` in the current window; true while under `max`. */
  private async underLimit(key: string, max: number): Promise<boolean> {
    const count = await this.redis.client.incr(key);
    if (count === 1) await this.redis.client.expire(key, CONTACT_WINDOW_SECONDS);
    return count <= max;
  }

  async send(body: ContactRequest, ip: string | undefined): Promise<void> {
    if (isRobot(body.website)) {
      this.logger.warn('Contact message dropped: honeypot filled');
      return;
    }
    // Both counters move on every attempt, so a refused message still counts: no way to probe the limit for free.
    const ipOk = await this.underLimit(`twabibu:contact-rate:ip:${ip ?? 'unknown'}`, CONTACT_MAX_PER_IP);
    const emailOk = await this.underLimit(`twabibu:contact-rate:email:${body.email}`, CONTACT_MAX_PER_EMAIL);
    if (!ipOk || !emailOk) throw new ApiException('RATE_LIMITED', 'Too many contact messages');

    // The message is the sender's own words: never logged, only kept in the notification journal for support.
    await this.notifications.sendEmail({
      to: this.config.SUPPORT_EMAIL,
      template: 'contact.message',
      email: emailTemplates.contactMessage({
        name: body.name,
        email: body.email,
        topicLabel: CONTACT_TOPIC_LABELS[body.topic],
        message: body.message,
        receivedAt: new Date(),
      }),
    });
  }
}
