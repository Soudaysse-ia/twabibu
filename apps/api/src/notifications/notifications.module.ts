import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import type { AppConfig } from '../config.js';
import { AppointmentMessagesService } from './appointment-messages.service.js';
import { DevSmsController } from './dev-sms.controller.js';
import { BrevoEmailProvider, EMAIL_PROVIDER, FakeEmailProvider, ResendEmailProvider, type EmailProvider } from './email-provider.js';
import { NotificationsProcessor } from './notifications.processor.js';
import { NOTIFICATIONS_QUEUE, NotificationsService } from './notifications.service.js';
import { REMINDERS_QUEUE, RemindersProcessor } from './reminders.processor.js';
import { RemindersService } from './reminders.service.js';
import { FakeSmsProvider, InfobipSmsProvider, SMS_PROVIDER, TwilioSmsProvider, type SmsProvider } from './sms-provider.js';

function emailProvider(config: AppConfig): EmailProvider {
  switch (config.EMAIL_PROVIDER) {
    case 'brevo':
      return new BrevoEmailProvider(config.EMAIL_API_KEY, config.EMAIL_FROM);
    case 'resend':
      return new ResendEmailProvider(config.EMAIL_API_KEY, config.EMAIL_FROM);
    default:
      return new FakeEmailProvider();
  }
}

/** Settings are checked by loadConfig (smsConfigProblem) before this runs. */
export function smsProvider(config: AppConfig): SmsProvider {
  switch (config.SMS_PROVIDER) {
    case 'twilio':
      return new TwilioSmsProvider(config.SMS_ACCOUNT_SID, config.SMS_API_KEY, config.SMS_FROM);
    case 'infobip':
      return new InfobipSmsProvider(config.SMS_BASE_URL, config.SMS_API_KEY, config.SMS_FROM);
    default:
      return new FakeSmsProvider();
  }
}

@Module({})
export class NotificationsModule {
  static forRoot(config: AppConfig): DynamicModule {
    // The dev mailbox shows message texts: only while nothing real is sent, by e-mail or by SMS.
    const devTools = config.NODE_ENV !== 'production' && config.EMAIL_PROVIDER === 'fake' && config.SMS_PROVIDER === 'fake';
    return {
      module: NotificationsModule,
      global: true,
      imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }, { name: REMINDERS_QUEUE })],
      controllers: devTools ? [DevSmsController] : [],
      providers: [
        NotificationsService,
        NotificationsProcessor,
        AppointmentMessagesService,
        RemindersService,
        RemindersProcessor,
        { provide: SMS_PROVIDER, useValue: smsProvider(config) },
        { provide: EMAIL_PROVIDER, useValue: emailProvider(config) },
      ],
      exports: [NotificationsService, AppointmentMessagesService, RemindersService],
    };
  }
}
