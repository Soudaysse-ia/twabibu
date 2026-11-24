import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /**
   * Where a production build runs. `staging` is the hosted demo (ADR-020): fake e-mail and SMS allowed, code 000000.
   * `production` refuses fake providers.
   */
  APP_ENV: z.enum(['local', 'staging', 'production']).default('local'),
  API_PORT: z.coerce.number().int().default(4000),
  APP_URL: z.url().default('http://localhost:3100'),
  /** Back-office origin (apps/admin). Writes from any other origin are refused (SEC-03). */
  ADMIN_URL: z.url().default('http://localhost:3200'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  DEFAULT_TIMEZONE: z.string().default('Indian/Comoro'),
  /** SMS is the fallback for patients of a practice without an e-mail address (ADR-016). fake = only logged. */
  SMS_PROVIDER: z.enum(['fake', 'twilio', 'infobip']).default('fake'),
  /** Twilio: auth token. Infobip: API key. */
  SMS_API_KEY: z.string().default(''),
  /** Twilio only: account SID (AC…). */
  SMS_ACCOUNT_SID: z.string().default(''),
  /** Infobip only: the account's own API host, e.g. xxxxx.api.infobip.com. */
  SMS_BASE_URL: z.string().default(''),
  /** Sender shown on the phone: a number in E.164, or a name such as « Twabibu » where the operator allows it. */
  SMS_FROM: z.string().default('Twabibu'),
  /** E-mail is the primary channel (ADR-016). fake = nothing leaves the machine. */
  EMAIL_PROVIDER: z.enum(['fake', 'brevo', 'resend']).default('fake'),
  EMAIL_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('Twabibu <rendez-vous@twabibu.km>'),
  /** Where contact-form messages go (WEB-02). */
  SUPPORT_EMAIL: z.email().default('support@twabibu.km'),
  /** Pepper for OTP hashes. Long random value in production. */
  SESSION_SECRET: z.string().min(16).default('dev-only-session-secret-change-me'),
  /** Key for medical free text (AES-256-GCM). Any long random string; never change it without re-encrypting. */
  ENCRYPTION_KEY: z.string().min(16).default('dev-only-encryption-key-change-me'),
});

export type AppConfig = z.infer<typeof EnvSchema>;

/** Reads and validates the environment once. Fails fast with a readable message. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment (see .env.example):\n${issues}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.APP_ENV === 'local') {
    throw new Error('Set APP_ENV=staging or APP_ENV=production for a production build');
  }
  // E-mail carries the sign-in codes (ADR-016): production must send real ones. SMS is only a fallback, so
  // production may still start with SMS_PROVIDER=fake (messages are only logged) until a provider is chosen.
  if (parsed.data.APP_ENV === 'production' && parsed.data.EMAIL_PROVIDER === 'fake') {
    throw new Error('EMAIL_PROVIDER=fake is not allowed with APP_ENV=production');
  }
  if (parsed.data.EMAIL_PROVIDER !== 'fake' && !parsed.data.EMAIL_API_KEY) {
    throw new Error(`EMAIL_API_KEY is required with EMAIL_PROVIDER=${parsed.data.EMAIL_PROVIDER}`);
  }
  const smsProblem = smsConfigProblem(parsed.data);
  if (smsProblem) throw new Error(smsProblem);
  if (parsed.data.NODE_ENV === 'production' && parsed.data.ENCRYPTION_KEY.startsWith('dev-only')) {
    throw new Error('Set ENCRYPTION_KEY in production');
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.SESSION_SECRET.startsWith('dev-only')) {
    throw new Error('Set SESSION_SECRET in production');
  }
  return parsed.data;
}

/** What is missing for the chosen SMS provider, or null. The Infobip host is checked so a typo cannot send elsewhere. */
export function smsConfigProblem(c: Pick<AppConfig, 'SMS_PROVIDER' | 'SMS_API_KEY' | 'SMS_ACCOUNT_SID' | 'SMS_BASE_URL' | 'SMS_FROM'>): string | null {
  if (c.SMS_PROVIDER === 'fake') return null;
  if (!c.SMS_API_KEY) return `SMS_API_KEY is required with SMS_PROVIDER=${c.SMS_PROVIDER}`;
  if (!c.SMS_FROM.trim()) return 'SMS_FROM is required';
  if (c.SMS_PROVIDER === 'twilio' && !/^AC[0-9a-f]{32}$/i.test(c.SMS_ACCOUNT_SID)) return 'SMS_ACCOUNT_SID (AC…) is required with SMS_PROVIDER=twilio';
  if (c.SMS_PROVIDER === 'infobip' && !/^[a-z0-9-]+\.api\.infobip\.com$/i.test(c.SMS_BASE_URL))
    return 'SMS_BASE_URL must be your Infobip API host (xxxxx.api.infobip.com) with SMS_PROVIDER=infobip';
  return null;
}

export const APP_CONFIG = Symbol('APP_CONFIG');
export const API_VERSION = '0.1.0';
