/**
 * Demo build (fictional data, fake e-mail and SMS providers, code 000000): shows the « Découvrir la démo » page,
 * the banner and the demo accounts on sign-in pages. Always on in development.
 * NEXT_PUBLIC_DEMO_MODE is read when the site is built (`NEXT_PUBLIC_DEMO_MODE=true pnpm build`). Never in production.
 */
export const isDemo = (): boolean => process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
