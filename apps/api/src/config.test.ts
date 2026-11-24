import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appEnvFrom, demoAdminsAllowed, demoDataAllowed } from './common/environment.js';
import { loadConfig } from './config.js';

const base = { DATABASE_URL: 'postgresql://x@localhost/x' };
const secrets = { SESSION_SECRET: 'a-long-random-session-secret', ENCRYPTION_KEY: 'a-long-random-encryption-key' };

describe('Configuration (ADR-020)', () => {
  it('refuses a production build without APP_ENV', () => {
    assert.throws(() => loadConfig({ ...base, ...secrets, NODE_ENV: 'production' }), /APP_ENV/);
  });

  it('lets the hosted demo (staging) use fake providers, never production', () => {
    assert.equal(loadConfig({ ...base, ...secrets, NODE_ENV: 'production', APP_ENV: 'staging', EMAIL_PROVIDER: 'fake' }).APP_ENV, 'staging');
    assert.throws(() => loadConfig({ ...base, ...secrets, NODE_ENV: 'production', APP_ENV: 'production', EMAIL_PROVIDER: 'fake' }), /EMAIL_PROVIDER=fake/);
    const prod = loadConfig({ ...base, ...secrets, NODE_ENV: 'production', APP_ENV: 'production', EMAIL_PROVIDER: 'brevo', EMAIL_API_KEY: 'key' });
    assert.equal(prod.SMS_PROVIDER, 'fake', 'SMS is only a fallback: production may start without a provider');
  });

  it('still requires real secrets in any production build', () => {
    assert.throws(() => loadConfig({ ...base, NODE_ENV: 'production', APP_ENV: 'staging' }), /ENCRYPTION_KEY|SESSION_SECRET/);
  });

  it('keeps demo data off production and shared back-office accounts off everything but a developer machine', () => {
    assert.equal(appEnvFrom({ NODE_ENV: 'development' }), 'local');
    assert.equal(appEnvFrom({ NODE_ENV: 'production' }), 'production', 'a production build without APP_ENV is treated as production');
    assert.equal(appEnvFrom({ NODE_ENV: 'production', APP_ENV: 'staging' }), 'staging');
    assert.equal(appEnvFrom({ NODE_ENV: 'production', APP_ENV: 'demo' }), 'production', 'an unknown value is not trusted');
    assert.deepEqual(['local', 'staging', 'production'].map((e) => demoDataAllowed(e as 'local')), [true, true, false]);
    assert.deepEqual(['local', 'staging', 'production'].map((e) => demoAdminsAllowed(e as 'local')), [true, false, false]);
  });
});
