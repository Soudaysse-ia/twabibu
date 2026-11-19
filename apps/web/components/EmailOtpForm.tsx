'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button, cn } from '@twabibu/ui';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import type { Me } from '@/lib/types';
import { isDemo } from '@/lib/demo';

type Step = 'email' | 'code' | 'signup';

const inputClass =
  'h-12 w-full rounded-md border border-border bg-surface px-3 text-ink placeholder:text-text-muted focus:border-primary focus:outline-2 focus:outline-offset-0 focus:outline-primary/30';

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Sign-in and sign-up with an e-mail address and a 6-digit code sent by e-mail (ADR-016). No phone number,
 * no password. Calls `onDone` with the account. New addresses go through a short identity form first.
 */
export function EmailOtpForm({
  onDone,
  title = 'Identifiez-vous',
  allowSignup = true,
  noAccountMessage = 'Cette adresse n’est associée à aucun compte professionnel. Contactez Twabibu pour inscrire votre structure.',
}: {
  onDone: (me: Me) => void;
  title?: string;
  allowSignup?: boolean;
  /** Shown when sign-up is off and the address has no account. */
  noAccountMessage?: string;
}) {
  const uid = useId();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [code, setCode] = useState('');
  const [signupToken, setSignupToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ civility: '', firstName: '', lastName: '', birthDate: '', acceptTerms: false, emailReminders: true });

  async function finish() {
    onDone(await api<Me>('/v1/me'));
  }

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
      setError('Entrez une adresse e-mail valide, par exemple amina@gmail.com.');
      return;
    }
    setBusy(true);
    try {
      await api('/v1/auth/otp/request', { method: 'POST', body: { email: normalized, purpose: 'LOGIN' } });
      setAddress(normalized);
      setCode('');
      setStep('code');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('Le code contient 6 chiffres.');
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ status: 'LOGGED_IN' } | { status: 'SIGNUP_REQUIRED'; signupToken: string }>('/v1/auth/otp/verify', {
        method: 'POST',
        body: { email: address, purpose: 'LOGIN', code },
      });
      if (res.status === 'LOGGED_IN') await finish();
      else if (!allowSignup) {
        setError(noAccountMessage);
        setStep('email');
      } else {
        setSignupToken(res.signupToken);
        setStep('signup');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function signup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim() || !form.birthDate) {
      setError('Renseignez votre prénom, votre nom et votre date de naissance.');
      return;
    }
    if (!form.acceptTerms) {
      setError('Acceptez les conditions d’utilisation pour créer votre compte.');
      return;
    }
    setBusy(true);
    try {
      await api('/v1/auth/signup/patient', {
        method: 'POST',
        body: { signupToken, ...form, civility: form.civility || undefined },
      });
      await finish();
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'CONFLICT' ? 'Un compte existe déjà avec cette adresse. Connectez-vous.' : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">{step === 'signup' ? 'Créez votre compte' : title}</h2>

      {step === 'email' ? (
        <form onSubmit={sendCode} className="flex flex-col gap-4" noValidate>
          <Field id={`${uid}-email`} label="Adresse e-mail" hint="Nous vous envoyons un code par e-mail. Pas de mot de passe à retenir." error={error}>
            <input
              id={`${uid}-email`}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!error}
              aria-describedby={error ? `${uid}-email-error` : undefined}
              className={inputClass}
            />
          </Field>
          <Button type="submit" size="lg" fullWidth disabled={busy}>
            {busy ? 'Envoi…' : 'Recevoir un code par e-mail'}
          </Button>
        </form>
      ) : null}

      {step === 'code' ? (
        <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
          <p className="text-sm text-text">
            Code envoyé à <strong className="font-medium text-ink break-all">{address}</strong>. Pensez à regarder dans les courriers indésirables.{' '}
            <button type="button" className="text-primary underline" onClick={() => setStep('email')}>
              Modifier
            </button>
          </p>
          <Field id={`${uid}-code`} label="Code reçu par e-mail" error={error}>
            <input
              id={`${uid}-code`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              aria-invalid={!!error}
              className={cn(inputClass, 'text-center text-xl tracking-[0.5em] tabular-nums')}
              autoFocus
            />
          </Field>
          {isDemo() ? (
            <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-ink">Environnement de test : aucun e-mail n’est envoyé, le code est 000000.</p>
          ) : null}
          <Button type="submit" size="lg" fullWidth disabled={busy}>
            {busy ? 'Vérification…' : 'Valider'}
          </Button>
          <button type="button" onClick={() => sendCode()} disabled={busy} className="text-sm text-primary underline disabled:opacity-50">
            Renvoyer un code
          </button>
        </form>
      ) : null}

      {step === 'signup' ? (
        <form onSubmit={signup} className="flex flex-col gap-4" noValidate>
          <p className="text-sm text-text">Adresse vérifiée. Quelques informations pour que le cabinet vous reconnaisse.</p>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium text-ink">Civilité</legend>
            <div className="flex gap-2">
              {[
                ['MME', 'Madame'],
                ['M', 'Monsieur'],
              ].map(([value, label]) => (
                <label key={value} className={cn('flex h-11 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm', form.civility === value ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text')}>
                  <input type="radio" name="civility" value={value} className="sr-only" checked={form.civility === value} onChange={() => setForm({ ...form, civility: value! })} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${uid}-first`} label="Prénom">
              <input id={`${uid}-first`} autoComplete="given-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputClass} />
            </Field>
            <Field id={`${uid}-last`} label="Nom">
              <input id={`${uid}-last`} autoComplete="family-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputClass} />
            </Field>
          </div>
          <Field id={`${uid}-birth`} label="Date de naissance">
            <input id={`${uid}-birth`} type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className={inputClass} />
          </Field>
          <label className="flex gap-3 text-sm text-text">
            <input type="checkbox" className="mt-1 size-4 accent-primary" checked={form.acceptTerms} onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })} />
            <span>
              J’accepte les{' '}
              <a href="/cgu" target="_blank" className="text-primary underline">
                conditions d’utilisation
              </a>{' '}
              et la{' '}
              <a href="/confidentialite" target="_blank" className="text-primary underline">
                politique de confidentialité
              </a>
              .
            </span>
          </label>
          <label className="flex gap-3 text-sm text-text">
            <input type="checkbox" className="mt-1 size-4 accent-primary" checked={form.emailReminders} onChange={(e) => setForm({ ...form, emailReminders: e.target.checked })} />
            Recevoir un rappel par e-mail la veille de mes rendez-vous.
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" fullWidth disabled={busy}>
            {busy ? 'Création…' : 'Créer mon compte'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
