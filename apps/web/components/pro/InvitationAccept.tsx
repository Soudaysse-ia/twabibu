'use client';

import { useId, useState, type FormEvent } from 'react';
import { fr } from '@twabibu/i18n';
import { Button, cn } from '@twabibu/ui';
import { api, errorMessage } from '@/lib/api-client';
import { isDemo } from '@/lib/demo';
import { rememberPractice } from '@/lib/pro-practice';

const t = fr.invitation;
const input =
  'h-12 w-full rounded-md border border-border bg-surface px-3 text-base text-ink placeholder:text-text-muted focus:border-primary focus:outline-2 focus:outline-primary/30';

export interface InvitationPreview {
  organizationName: string;
  role: 'SECRETARY' | 'ADMIN';
  email: string;
  state: 'PENDING' | 'EXPIRED' | 'ACCEPTED' | 'REVOKED';
}

type Verify = { status: 'LOGGED_IN' } | { status: 'SIGNUP_REQUIRED'; signupToken: string };

/**
 * Accepts a team invitation. Signed in with the invited address: one click. Otherwise the invited address is
 * confirmed with an e-mail code (ADR-016); a new address gets its professional account at the same time.
 */
export function InvitationAccept({
  token,
  invitation,
  signedInEmail,
}: {
  token: string;
  invitation: InvitationPreview;
  signedInEmail: string | null;
}) {
  const uid = useId();
  const [step, setStep] = useState<'start' | 'code'>('start');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const role = t.roles[invitation.role]!;
  const sameAccount = signedInEmail?.toLowerCase() === invitation.email;

  async function step_(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function join(signupToken?: string) {
    const joined = await api<{ organizationId: string }>(
      `/v1/pro/invitations/${encodeURIComponent(token)}/accept`,
      {
        method: 'POST',
        body: signupToken ? { signupToken } : {},
      },
    );
    // Open the practice just joined, even when the account already belonged to another one.
    rememberPractice(joined.organizationId);
    // Full load: the Pro layout reads the new membership on the server.
    window.location.assign('/pro/app');
  }

  const intro = (
    <>
      <p className="text-base text-text">{t.lead(invitation.organizationName, role)}</p>
      <p className="text-sm text-text-muted">
        {t.invitedEmail} : <span className="font-medium break-all text-ink">{invitation.email}</span>
      </p>
    </>
  );

  if (invitation.state !== 'PENDING') {
    return (
      <>
        {intro}
        <p role="alert" className="rounded-md bg-warning-soft p-3 text-sm text-ink">
          {invitation.state === 'EXPIRED' ? t.expired : t.used}
        </p>
      </>
    );
  }

  const errorBox = error ? (
    <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      {error}
    </p>
  ) : null;

  if (signedInEmail && sameAccount) {
    return (
      <>
        {intro}
        <p className="text-sm text-text">{t.signedInAs(signedInEmail)}</p>
        {errorBox}
        <Button disabled={busy} onClick={() => step_(() => join())}>
          {busy ? t.joining : t.join}
        </Button>
      </>
    );
  }

  if (signedInEmail) {
    return (
      <>
        {intro}
        <p className="rounded-md bg-warning-soft p-3 text-sm text-ink">
          {t.signedInAs(signedInEmail)} {t.otherAccount}
        </p>
        {errorBox}
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            step_(async () => {
              await api('/v1/auth/logout', { method: 'POST' });
              window.location.reload();
            })
          }
        >
          {t.logout}
        </Button>
      </>
    );
  }

  async function confirm(e: FormEvent) {
    e.preventDefault();
    await step_(async () => {
      const result = await api<Verify>('/v1/auth/otp/verify', {
        method: 'POST',
        body: { email: invitation.email, purpose: 'LOGIN', code: code.trim() },
      });
      await join(result.status === 'SIGNUP_REQUIRED' ? result.signupToken : undefined);
    });
  }

  return (
    <>
      {intro}
      {step === 'start' ? (
        <>
          <p className="text-sm text-text">{t.codeIntro}</p>
          {errorBox}
          <Button
            disabled={busy}
            onClick={() =>
              step_(async () => {
                await api('/v1/auth/otp/request', {
                  method: 'POST',
                  body: { email: invitation.email, purpose: 'LOGIN' },
                });
                setStep('code');
              })
            }
          >
            {t.sendCode}
          </Button>
        </>
      ) : (
        <form onSubmit={confirm} noValidate className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-code`} className="text-sm font-medium text-ink">
              {t.code}
            </label>
            <input
              id={`${uid}-code`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className={cn(input, 'tracking-[0.3em]')}
              aria-describedby={isDemo() ? `${uid}-demo` : undefined}
            />
            {isDemo() ? (
              <p id={`${uid}-demo`} className="text-xs text-text-muted">
                {t.demoCode}
              </p>
            ) : null}
          </div>
          {errorBox}
          <Button type="submit" disabled={busy || code.length !== 6}>
            {busy ? t.joining : t.confirm}
          </Button>
          <button
            type="button"
            className="min-h-11 self-start text-sm font-medium text-primary hover:underline"
            onClick={() =>
              step_(() =>
                api('/v1/auth/otp/request', {
                  method: 'POST',
                  body: { email: invitation.email, purpose: 'LOGIN' },
                }).then(() => undefined),
              )
            }
          >
            {t.newCode}
          </button>
        </form>
      )}
    </>
  );
}
