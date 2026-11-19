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
import { FakeSmsProvider, SMS_PROVIDER } from './sms-provider.js';

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

@Module({})
export class NotificationsModule {
  static forRoot(config: AppConfig): DynamicModule {
    if (config.SMS_PROVIDER !== 'fake') throw new Error(`SMS provider "${config.SMS_PROVIDER}" is not implemented yet (ticket NOTIF-02)`);
    const devTools = config.NODE_ENV !== 'production' && config.EMAIL_PROVIDER === 'fake';
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
        { provide: SMS_PROVIDER, useClass: FakeSmsProvider },
        { provide: EMAIL_PROVIDER, useValue: emailProvider(config) },
      ],
      exports: [NotificationsService, AppointmentMessagesService, RemindersService],
    };
  }
}
