import type { Request, Response } from 'express';

export const SESSION_COOKIE = 'tw_session';
export const BOOKING_COOKIE = 'tw_bsid';

/** Minimal cookie parser (avoids a dependency for two cookies). */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return undefined;
}

export function writeCookie(res: Response, name: string, value: string, maxAgeSeconds: number, secure: boolean): void {
  res.cookie(name, value, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: maxAgeSeconds * 1000 });
}

export function clearCookie(res: Response, name: string, secure: boolean): void {
  res.clearCookie(name, { httpOnly: true, sameSite: 'lax', secure, path: '/' });
}
