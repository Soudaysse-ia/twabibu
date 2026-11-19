'use client';

import { fr } from '@twabibu/i18n';
import { API_PUBLIC_BASE } from './env';

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

/** User-facing French message for an API error code. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? MESSAGES.INTERNAL_ERROR!;
  return 'Connexion impossible. Vérifiez votre réseau et réessayez.';
}

/** Browser-side call to the API through the /api proxy, with cookies. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API_PUBLIC_BASE}${path}`, {
    method: init.method ?? 'GET',
    credentials: 'same-origin',
    headers: init.body === undefined ? {} : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.code ?? 'INTERNAL_ERROR', data.message ?? res.statusText, data.details);
  return data as T;
}
