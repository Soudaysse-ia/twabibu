import { Logger } from '@nestjs/common';
import { maskPhone } from '@twabibu/utils';

export interface SmsProvider {
  readonly name: string;
  send(to: string, text: string): Promise<{ providerId: string }>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

/** A slow provider must not hold a queue worker: the job fails and BullMQ retries it later. */
const TIMEOUT_MS = 10_000;

/**
 * A provider's error body can quote the recipient's number: it goes to the logs and the Notification table, so
 * every long run of digits is hidden before the message is kept anywhere.
 */
export function scrubbedError(provider: string, status: number, body: string): Error {
  return new Error(`${provider} ${status}: ${body.slice(0, 200).replace(/\+?\d{6,}/g, '***')}`);
}

/** Development and test provider: nothing leaves the machine, texts stay in the Notification table. */
export class FakeSmsProvider implements SmsProvider {
  readonly name = 'fake';
  private readonly logger = new Logger('FakeSms');

  async send(to: string, text: string): Promise<{ providerId: string }> {
    this.logger.log(`SMS to ${maskPhone(to)} (${text.length} chars)`);
    return { providerId: `fake-${Date.now()}` };
  }
}

/** Twilio Programmable Messaging (https://www.twilio.com/docs/messaging/api/message-resource#create-a-message-resource). */
export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly from: string,
  ) {}

  async send(to: string, text: string): Promise<{ providerId: string }> {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: this.from, Body: text }).toString(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) throw scrubbedError('Twilio', res.status, await res.text());
    const body = (await res.json()) as { sid?: string };
    return { providerId: body.sid ?? 'twilio' };
  }
}

/** Infobip SMS API (https://www.infobip.com/docs/api/channels/sms/sms-messaging/outbound-sms/send-sms-message). */
export class InfobipSmsProvider implements SmsProvider {
  readonly name = 'infobip';
  constructor(
    private readonly host: string,
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(to: string, text: string): Promise<{ providerId: string }> {
    const res = await fetch(`https://${this.host}/sms/2/text/advanced`, {
      method: 'POST',
      headers: {
        authorization: `App ${this.apiKey}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      // Infobip wants the international number without the « + ».
      body: JSON.stringify({
        messages: [{ destinations: [{ to: to.replace(/^\+/, '') }], from: this.from, text }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw scrubbedError('Infobip', res.status, await res.text());
    const body = (await res.json()) as {
      messages?: { messageId?: string; status?: { groupName?: string; description?: string } }[];
    };
    const message = body.messages?.[0];
    // Accepted with HTTP 200 but refused for this number (unknown network, blocked sender): a failure, not a send.
    if (message?.status?.groupName === 'REJECTED')
      throw scrubbedError('Infobip', 200, message.status.description ?? 'rejected');
    return { providerId: message?.messageId ?? 'infobip' };
  }
}
