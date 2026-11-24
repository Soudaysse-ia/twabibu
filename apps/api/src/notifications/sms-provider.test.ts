import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { loadConfig, smsConfigProblem } from '../config.js';
import { smsProvider } from './notifications.module.js';
import { FakeSmsProvider, InfobipSmsProvider, scrubbedError, TwilioSmsProvider } from './sms-provider.js';

// SMS providers (SPEC-08 NOTIF-02). The network is replaced by a stub: no message ever leaves the machine here.
const realFetch = globalThis.fetch;
let calls: { url: string; init: RequestInit }[] = [];
function stubFetch(status: number, body: unknown) {
  calls = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  }) as typeof fetch;
}
afterEach(() => {
  globalThis.fetch = realFetch;
});

const SID = `AC${'0'.repeat(32)}`;
const base = { DATABASE_URL: 'postgresql://x@localhost/x' };

describe('SMS settings', () => {
  it('needs the key, the sender, and the account or the host of the chosen provider', () => {
    const ok = {
      SMS_API_KEY: 'k',
      SMS_FROM: 'Twabibu',
      SMS_ACCOUNT_SID: SID,
      SMS_BASE_URL: 'abc12.api.infobip.com',
    };
    assert.equal(smsConfigProblem({ ...ok, SMS_PROVIDER: 'fake', SMS_API_KEY: '' }), null);
    assert.equal(smsConfigProblem({ ...ok, SMS_PROVIDER: 'twilio' }), null);
    assert.equal(smsConfigProblem({ ...ok, SMS_PROVIDER: 'infobip' }), null);
    assert.match(smsConfigProblem({ ...ok, SMS_PROVIDER: 'twilio', SMS_API_KEY: '' })!, /SMS_API_KEY/);
    assert.match(
      smsConfigProblem({ ...ok, SMS_PROVIDER: 'twilio', SMS_ACCOUNT_SID: 'nope' })!,
      /SMS_ACCOUNT_SID/,
    );
    // A typo or another host is refused: the key would be sent there.
    assert.match(
      smsConfigProblem({
        ...ok,
        SMS_PROVIDER: 'infobip',
        SMS_BASE_URL: 'https://evil.example/api.infobip.com',
      })!,
      /SMS_BASE_URL/,
    );
    assert.throws(() => loadConfig({ ...base, SMS_PROVIDER: 'infobip', SMS_API_KEY: 'k' }), /SMS_BASE_URL/);
  });

  it('builds the provider named in the settings', () => {
    const config = (extra: Record<string, string>) =>
      loadConfig({
        ...base,
        SMS_API_KEY: 'k',
        SMS_ACCOUNT_SID: SID,
        SMS_BASE_URL: 'abc12.api.infobip.com',
        ...extra,
      });
    assert.ok(smsProvider(config({})) instanceof FakeSmsProvider);
    assert.ok(smsProvider(config({ SMS_PROVIDER: 'twilio' })) instanceof TwilioSmsProvider);
    assert.ok(smsProvider(config({ SMS_PROVIDER: 'infobip' })) instanceof InfobipSmsProvider);
  });
});

describe('Twilio', () => {
  it('posts a form with basic authentication and returns the message id', async () => {
    stubFetch(201, { sid: 'SM123' });
    const res = await new TwilioSmsProvider(SID, 'token', 'Twabibu').send(
      '+2693211234',
      'Rappel : RDV demain 09:00',
    );
    assert.deepEqual(res, { providerId: 'SM123' });
    assert.equal(calls[0]!.url, `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`);
    const headers = calls[0]!.init.headers as Record<string, string>;
    assert.equal(headers.authorization, `Basic ${Buffer.from(`${SID}:token`).toString('base64')}`);
    const form = new URLSearchParams(String(calls[0]!.init.body));
    assert.deepEqual(
      [form.get('To'), form.get('From'), form.get('Body')],
      ['+2693211234', 'Twabibu', 'Rappel : RDV demain 09:00'],
    );
    assert.ok(calls[0]!.init.signal, 'a request that hangs is abandoned');
  });

  it('fails with the status and without the phone number', async () => {
    stubFetch(400, { message: "The 'To' number +2693211234 is not a valid phone number." });
    await assert.rejects(
      new TwilioSmsProvider(SID, 'token', 'Twabibu').send('+2693211234', 'x'),
      (e: Error) => e.message.startsWith('Twilio 400') && !e.message.includes('3211234'),
    );
  });
});

describe('Infobip', () => {
  it('posts to the account host with the App key, number without « + »', async () => {
    stubFetch(200, { bulkId: 'b', messages: [{ messageId: 'M1', status: { groupName: 'PENDING' } }] });
    const res = await new InfobipSmsProvider('abc12.api.infobip.com', 'key', 'Twabibu').send(
      '+2693211234',
      'Bonjour',
    );
    assert.deepEqual(res, { providerId: 'M1' });
    assert.equal(calls[0]!.url, 'https://abc12.api.infobip.com/sms/2/text/advanced');
    assert.equal((calls[0]!.init.headers as Record<string, string>).authorization, 'App key');
    assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), {
      messages: [{ destinations: [{ to: '2693211234' }], from: 'Twabibu', text: 'Bonjour' }],
    });
  });

  it('treats a message rejected inside a 200 answer as a failure', async () => {
    stubFetch(200, {
      messages: [
        {
          messageId: 'M2',
          status: { groupName: 'REJECTED', description: 'Destination 2693211234 not registered' },
        },
      ],
    });
    await assert.rejects(
      new InfobipSmsProvider('abc12.api.infobip.com', 'key', 'Twabibu').send('+2693211234', 'x'),
      (e: Error) => e.message.startsWith('Infobip 200') && !e.message.includes('3211234'),
    );
  });
});

describe('Errors', () => {
  it('hide every long run of digits', () => {
    assert.equal(
      scrubbedError('X', 500, 'to +2693211234 and 0033612345678 failed (code 21211)').message,
      'X 500: to *** and *** failed (code 21211)',
    );
  });
});
