'use client';

import { fr } from '@twabibu/i18n';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

const MESSAGES = fr.errors as Record<string, string>;

/** French message for an API error; back-office specifics first. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'CONFLICT' && error.message) return `Action impossible : ${error.message}.`;
    if (error.code === 'VALIDATION_FAILED' && error.message && error.message !== 'Invalid request') return `Vérifiez la saisie : ${error.message}.`;
    if (error.status === 403) return 'Votre rôle ne donne pas accès à cette action.';
    return MESSAGES[error.code] ?? MESSAGES.INTERNAL_ERROR!;
  }
  return 'Connexion impossible. Vérifiez votre réseau et réessayez.';
}

/** Browser call through the /api proxy (cookies). A lost second factor sends back to sign-in. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: init.body === undefined ? {} : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/connexion')) window.location.assign('/connexion');
  if (!res.ok) throw new ApiError(res.status, data.code ?? 'INTERNAL_ERROR', data.message ?? res.statusText, data.details);
  return data as T;
}
