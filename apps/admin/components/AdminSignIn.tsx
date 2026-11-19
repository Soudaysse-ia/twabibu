'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { Button } from '@twabibu/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { fieldClass } from '@/lib/ui';

type Step = 'email' | 'otp' | 'setup' | 'code';

/** Sign-in: e-mail code (step 1), then the authenticator app code (step 2, mandatory). */
export function AdminSignIn({ initial, devCode }: { initial: Step; devCode: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initial);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (step !== 'setup' || setup) return;
    api<{ secret: string; otpauthUri: string }>('/v1/admin/auth/mfa/setup', { method: 'POST' })
      .then(async (s) => setSetup({ secret: s.secret, qr: await QRCode.toDataURL(s.otpauthUri, { margin: 1, width: 200 }) }))
      .catch((e) => setError(errorMessage(e)));
  }, [step, setup]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (step === 'email') {
        await api('/v1/auth/otp/request', { method: 'POST', body: { email: email.trim().toLowerCase(), purpose: 'LOGIN' } });
        setStep('otp');
      } else if (step === 'otp') {
        const res = await api<{ status: string }>('/v1/auth/otp/verify', { method: 'POST', body: { email: email.trim().toLowerCase(), code } });
        if (res.status !== 'LOGGED_IN') throw new ApiError(403, 'FORBIDDEN', 'not an admin');
        const me = await api<{ mfa: { enrolled: boolean } }>('/v1/admin/auth/me');
        setCode('');
        setStep(me.mfa.enrolled ? 'code' : 'setup');
      } else {
        await api('/v1/admin/auth/mfa/verify', { method: 'POST', body: { code } });
        router.replace('/');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? 'Cette adresse n’a pas accès au back-office.' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">{step === 'email' || step === 'otp' ? 'Connexion au back-office' : 'Double authentification'}</h1>
      {step === 'email' ? (
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Adresse e-mail professionnelle
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
        </label>
      ) : null}
      {step === 'setup' ? (
        <div className="flex flex-col gap-3 text-sm text-text">
          <p>Première connexion : scannez ce code avec une application d’authentification (Google Authenticator, Microsoft Authenticator, Aegis…), puis saisissez le code à 6 chiffres affiché.</p>
          {setup ? (
            <>
              <img src={setup.qr} alt="QR code à scanner avec l’application d’authentification" width={200} height={200} className="self-center rounded-md border border-border" />
              <p className="text-xs">
                Saisie manuelle : <code className="font-mono break-all text-ink">{setup.secret}</code>
              </p>
            </>
          ) : (
            <p className="text-text-muted">Préparation…</p>
          )}
        </div>
      ) : null}
      {step !== 'email' ? (
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          {step === 'otp' ? 'Code reçu par e-mail' : 'Code de l’application d’authentification'}
          <input inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className={`${fieldClass} tracking-[0.4em]`} />
        </label>
      ) : null}
      {devCode && step !== 'email' ? <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-ink">Environnement de test : le code 000000 est accepté.</p> : null}
      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? 'Vérification…' : step === 'email' ? 'Recevoir un code' : 'Valider'}
      </Button>
    </form>
  );
}
