import { Logger } from '@nestjs/common';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ providerId: string }>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

function parseFrom(from: string): { name: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1] || 'Twabibu', email: m[2]! } : { name: 'Twabibu', email: from.trim() };
}

/** Development and tests: nothing is sent, the message stays in the Notification table. */
export class FakeEmailProvider implements EmailProvider {
  readonly name = 'fake';
  private readonly logger = new Logger('FakeEmail');

  async send(message: EmailMessage): Promise<{ providerId: string }> {
    this.logger.log(`E-mail to ${message.to.replace(/^(.).*(@.*)$/, '$1***$2')}: ${message.subject}`);
    return { providerId: `fake-${Date.now()}` };
  }
}

/** Brevo transactional API (https://developers.brevo.com/reference/sendtransacemail). */
export class BrevoEmailProvider implements EmailProvider {
  readonly name = 'brevo';
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(m: EmailMessage): Promise<{ providerId: string }> {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': this.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: parseFrom(this.from), to: [{ email: m.to }], subject: m.subject, htmlContent: m.html, textContent: m.text }),
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { messageId?: string };
    return { providerId: body.messageId ?? 'brevo' };
  }
}

/** Resend API (https://resend.com/docs/api-reference/emails/send-email). */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(m: EmailMessage): Promise<{ providerId: string }> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = (await res.json()) as { id?: string };
    return { providerId: body.id ?? 'resend' };
  }
}
