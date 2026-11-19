import { Logger } from '@nestjs/common';
import { maskPhone } from '@twabibu/utils';

export interface SmsProvider {
  readonly name: string;
  send(to: string, text: string): Promise<{ providerId: string }>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

/** Development and test provider: nothing leaves the machine, texts stay in the Notification table. */
export class FakeSmsProvider implements SmsProvider {
  readonly name = 'fake';
  private readonly logger = new Logger('FakeSms');

  async send(to: string, text: string): Promise<{ providerId: string }> {
    this.logger.log(`SMS to ${maskPhone(to)} (${text.length} chars)`);
    return { providerId: `fake-${Date.now()}` };
  }
}
