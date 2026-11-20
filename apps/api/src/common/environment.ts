/**
 * Where a process runs (ADR-020), and what each environment may contain. Shared by the API configuration and the
 * seed script, so the two can never disagree.
 */
export type AppEnv = 'local' | 'staging' | 'production';

/** Reads APP_ENV; a production build without it counts as real production (the safe default). */
export function appEnvFrom(env: NodeJS.ProcessEnv): AppEnv {
  if (env.APP_ENV === 'local' || env.APP_ENV === 'staging' || env.APP_ENV === 'production') return env.APP_ENV;
  return env.NODE_ENV === 'production' ? 'production' : 'local';
}

/** Fictional patients, practices and appointments: on a developer's machine and on the hosted demo, never in production. */
export const demoDataAllowed = (appEnv: AppEnv): boolean => appEnv !== 'production';

/**
 * Demo back-office accounts sign in with the e-mail code 000000 and have no second factor yet: whoever signs in first
 * would enrol their own authenticator and become super administrator. Only on a developer's machine.
 */
export const demoAdminsAllowed = (appEnv: AppEnv): boolean => appEnv === 'local';

/** The fictional back-office accounts created by the seed (local only). */
export const DEMO_ADMIN_EMAILS = ['admin@demo.twabibu.km', 'verification@demo.twabibu.km', 'support@demo.twabibu.km'] as const;
