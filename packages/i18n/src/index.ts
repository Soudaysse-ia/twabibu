import { fr } from './fr.js';

export { fr };
export type { Messages } from './fr.js';

export const LOCALES = ['fr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';

/** Planned: 'zdj' (shikomori) and 'ar' (arabic, RTL) — tickets I18N-02/03. */
export const messages: Record<Locale, typeof fr> = { fr };

export * from './content/help.js';
export * from './content/legal.js';
