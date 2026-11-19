import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(4000),
  APP_URL: z.url().default('http://localhost:3100'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  DEFAULT_TIMEZONE: z.string().default('Indian/Comoro'),
  SMS_PROVIDER: z.enum(['fake', 'twilio', 'infobip', 'local']).default('fake'),
  /** E-mail is the primary channel (ADR-016). fake = nothing leaves the machine. */
  EMAIL_PROVIDER: z.enum(['fake', 'brevo', 'resend']).default('fake'),
  EMAIL_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('Twabibu <rendez-vous@twabibu.km>'),
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
  if (parsed.data.NODE_ENV === 'production' && parsed.data.EMAIL_PROVIDER === 'fake') {
    throw new Error('EMAIL_PROVIDER=fake is not allowed in production');
  }
  if (parsed.data.EMAIL_PROVIDER !== 'fake' && !parsed.data.EMAIL_API_KEY) {
    throw new Error(`EMAIL_API_KEY is required with EMAIL_PROVIDER=${parsed.data.EMAIL_PROVIDER}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.ENCRYPTION_KEY.startsWith('dev-only')) {
    throw new Error('Set ENCRYPTION_KEY in production');
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.SESSION_SECRET.startsWith('dev-only')) {
    throw new Error('Set SESSION_SECRET in production');
  }
  return parsed.data;
}

export const APP_CONFIG = Symbol('APP_CONFIG');
export const API_VERSION = '0.1.0';
