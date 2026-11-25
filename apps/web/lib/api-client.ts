'use client';

import { fr } from '@twabibu/i18n';
import { API_PUBLIC_BASE } from './env';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    /** X-Request-Id of the failed call: the support team finds the error in the logs with it (INFRA-05). */
    readonly requestId?: string,
  ) {
    super(message);
  }
}

const MESSAGES = fr.errors as Record<string, string>;

/** User-facing French message for an API error code. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const text = MESSAGES[error.code] ?? MESSAGES.INTERNAL_ERROR!;
    // Only for our own failures: the user has nothing to correct, the support team needs to find what happened.
    return error.status >= 500 && error.requestId ? `${text} ${fr.supportReference(error.requestId.slice(0, 8))}` : text;
  }
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
  if (!res.ok)
    throw new ApiError(res.status, data.code ?? 'INTERNAL_ERROR', data.message ?? res.statusText, data.details, res.headers.get('x-request-id') ?? undefined);
  return data as T;
}
