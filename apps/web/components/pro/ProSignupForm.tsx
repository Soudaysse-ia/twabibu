'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useState, type FormEvent } from 'react';
import { fr } from '@twabibu/i18n';
import { Button, cn } from '@twabibu/ui';
import { api, ApiError, errorMessage } from '@/lib/api-client';

export interface SpecialityOption {
  id: string;
  name: string;
  group: string;
}
export interface LocalityOption {
  id: string;
  name: string;
  island: string;
}

type Step = 'email' | 'code' | 'details';
const ISLANDS = ['NGAZIDJA', 'NDZUANI', 'MWALI'];
const input =
  'h-12 w-full rounded-md border border-border bg-surface px-3 text-base text-ink placeholder:text-text-muted focus:border-primary focus:outline-2 focus:outline-primary/30 sm:text-sm';
const FIELD_ERRORS: Record<string, string> = {
  phone: 'Ce numéro de téléphone n’est pas valide. Exemple : 773 12 34.',
  specialityId: 'Choisissez votre spécialité dans la liste.',
  localityId: 'Choisissez la localité du cabinet.',
};

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * Practitioner sign-up (SPEC-07, PRO-01): e-mail, 6-digit code, then the practice. Lands in the Pro space with a
 * profile waiting for verification.
 */
export function ProSignupForm({
  specialities,
  localities,
}: {
  specialities: SpecialityOption[];
  localities: LocalityOption[];
}) {
  const uid = useId();
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [signupToken, setSignupToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);
  const [form, setForm] = useState({
    kind: 'INDEPENDENT' as 'INDEPENDENT' | 'FACILITY',
    specialityId: '',
    title: 'DR' as 'DR' | 'NONE',
    firstName: '',
    lastName: '',
    licenseNumber: '',
    phone: '',
    organizationName: '',
    island: 'NGAZIDJA',
    localityId: '',
    addressLine: '',
    acceptTerms: false,
  });
  const islandLocalities = useMemo(
    () => localities.filter((l) => l.island === form.island),
    [localities, form.island],
  );
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });
  const id = (name: string) => `${uid}-${name}`;

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
      setError('Entrez une adresse e-mail valide, par exemple cabinet@exemple.km.');
      return;
    }
    setBusy(true);
    try {
      await api('/v1/auth/otp/request', { method: 'POST', body: { email: normalized, purpose: 'LOGIN' } });
      setEmail(normalized);
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
      const res = await api<{ status: 'LOGGED_IN' } | { status: 'SIGNUP_REQUIRED'; signupToken: string }>(
        '/v1/auth/otp/verify',
        { method: 'POST', body: { email, purpose: 'LOGIN', code } },
      );
      if (res.status === 'LOGGED_IN') {
        // The address already has an account: one e-mail address, one account (ADR-016).
        setExisting(true);
        await api('/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
      } else {
        setSignupToken(res.signupToken);
        setStep('details');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const missing =
      !form.specialityId ||
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.licenseNumber.trim() ||
      !form.phone.trim() ||
      !form.organizationName.trim() ||
      !form.localityId ||
      !form.addressLine.trim();
    if (missing) {
      setError('Tous les champs sont nécessaires pour vérifier votre dossier.');
      return;
    }
    if (!form.acceptTerms) {
      setError('Acceptez les conditions d’utilisation pour créer votre compte.');
      return;
    }
    setBusy(true);
    try {
      const { island: _island, ...body } = form;
      void _island;
      await api('/v1/auth/signup/practitioner', { method: 'POST', body: { ...body, signupToken } });
      router.replace('/pro/app?bienvenue=1');
      router.refresh();
    } catch (err) {
      const field =
        err instanceof ApiError ? (err.details as { field?: string } | undefined)?.field : undefined;
      if (err instanceof ApiError && err.code === 'OTP_EXPIRED') {
        setError('Votre code a expiré. Recommencez avec un nouveau code : vos informations restent saisies.');
        setStep('email');
      } else setError((field && FIELD_ERRORS[field]) || errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const alert = error ? (
    <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
      {error}
    </p>
  ) : null;

  if (existing) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Cette adresse a déjà un compte</h2>
        <p className="text-sm text-text">
          Une adresse e-mail ne sert qu’à un seul compte. Si votre cabinet est déjà inscrit, connectez-vous.
          Sinon, utilisez votre adresse professionnelle pour inscrire le cabinet.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/pro/connexion"
            className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-white uppercase hover:bg-primary-hover"
          >
            Me connecter
          </Link>
          <Button
            variant="secondary"
            className="h-11"
            onClick={() => {
              setExisting(false);
              setEmail('');
              setStep('email');
            }}
          >
            Utiliser une autre adresse
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ol aria-label="Étapes de l’inscription" className="flex gap-2 text-xs font-medium">
        {(['email', 'code', 'details'] as const).map((s, i) => {
          const done = ['email', 'code', 'details'].indexOf(step) > i;
          return (
            <li
              key={s}
              aria-current={step === s ? 'step' : undefined}
              className={cn(
                'flex-1 border-t-4 pt-1.5',
                step === s
                  ? 'border-primary text-primary'
                  : done
                    ? 'border-primary/40 text-text'
                    : 'border-border text-text-muted',
              )}
            >
              {i + 1}. {s === 'email' ? 'Adresse e-mail' : s === 'code' ? 'Code' : 'Votre cabinet'}
            </li>
          );
        })}
      </ol>

      {step === 'email' ? (
        <form onSubmit={sendCode} className="flex flex-col gap-4" noValidate>
          <h2 className="text-lg font-bold">Inscrire mon cabinet</h2>
          <Field
            id={id('email')}
            label="Adresse e-mail professionnelle"
            hint="Elle servira à vous connecter avec un code, sans mot de passe."
          >
            <input
              id={id('email')}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="cabinet@exemple.km"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
            />
          </Field>
          {alert}
          <Button type="submit" size="lg" disabled={busy} fullWidth>
            Recevoir un code
          </Button>
          <p className="text-sm text-text">
            Déjà inscrit ?{' '}
            <Link href="/pro/connexion" className="font-medium text-primary hover:underline">
              Se connecter
            </Link>
          </p>
        </form>
      ) : null}

      {step === 'code' ? (
        <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
          <h2 className="text-lg font-bold">Vérifiez votre adresse</h2>
          <Field id={id('code')} label={`Code reçu à ${email}`} hint="Le code est valable 5 minutes.">
            <input
              id={id('code')}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className={cn(input, 'tracking-[0.4em]')}
            />
          </Field>
          {alert}
          <Button type="submit" size="lg" disabled={busy} fullWidth>
            Continuer
          </Button>
          <button
            type="button"
            className="self-start text-sm font-medium text-primary hover:underline"
            onClick={() => setStep('email')}
          >
            Changer d’adresse
          </button>
        </form>
      ) : null}

      {step === 'details' ? (
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-base font-bold text-ink">Vous êtes</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['INDEPENDENT', 'Soignant en cabinet', 'Seul ou avec une secrétaire'],
                  ['FACILITY', 'Un centre ou une clinique', 'Vous inscrivez le premier praticien'],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer flex-col rounded-md border p-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary',
                    form.kind === value ? 'border-primary bg-primary-soft' : 'border-border',
                  )}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={value}
                    className="sr-only"
                    checked={form.kind === value}
                    onChange={() => set({ kind: value })}
                  />
                  <span className="font-medium text-ink">{label}</span>
                  <span className="text-text-muted">{hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-base font-bold text-ink">Le praticien</legend>
            <Field id={id('speciality')} label="Spécialité">
              <select
                id={id('speciality')}
                value={form.specialityId}
                onChange={(e) => set({ specialityId: e.target.value })}
                className={input}
              >
                <option value="">Choisissez…</option>
                {specialities.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-[8rem_1fr_1fr]">
              <Field id={id('title')} label="Titre">
                <select
                  id={id('title')}
                  value={form.title}
                  onChange={(e) => set({ title: e.target.value as 'DR' | 'NONE' })}
                  className={input}
                >
                  <option value="DR">Dr</option>
                  <option value="NONE">Aucun</option>
                </select>
              </Field>
              <Field id={id('first')} label="Prénom">
                <input
                  id={id('first')}
                  autoComplete="given-name"
                  maxLength={60}
                  value={form.firstName}
                  onChange={(e) => set({ firstName: e.target.value })}
                  className={input}
                />
              </Field>
              <Field id={id('last')} label="Nom">
                <input
                  id={id('last')}
                  autoComplete="family-name"
                  maxLength={60}
                  value={form.lastName}
                  onChange={(e) => set({ lastName: e.target.value })}
                  className={input}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                id={id('license')}
                label="Numéro d’autorisation d’exercer"
                hint="Ou d’inscription à l’Ordre. Il sert à la vérification et n’est pas affiché."
              >
                <input
                  id={id('license')}
                  maxLength={40}
                  autoComplete="off"
                  value={form.licenseNumber}
                  onChange={(e) => set({ licenseNumber: e.target.value })}
                  className={input}
                />
              </Field>
              <Field
                id={id('phone')}
                label="Téléphone du cabinet"
                hint="Affiché aux patients. Nous pourrons vous appeler pour confirmer votre dossier."
              >
                <input
                  id={id('phone')}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="773 12 34"
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  className={input}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-base font-bold text-ink">Le lieu de consultation</legend>
            <Field
              id={id('org')}
              label={form.kind === 'INDEPENDENT' ? 'Nom du cabinet' : 'Nom de l’établissement'}
            >
              <input
                id={id('org')}
                maxLength={120}
                placeholder={form.kind === 'INDEPENDENT' ? 'Cabinet du Dr Ahmed' : 'Centre médical de…'}
                value={form.organizationName}
                onChange={(e) => set({ organizationName: e.target.value })}
                className={input}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id={id('island')} label="Île">
                <select
                  id={id('island')}
                  value={form.island}
                  onChange={(e) => set({ island: e.target.value, localityId: '' })}
                  className={input}
                >
                  {ISLANDS.map((i) => (
                    <option key={i} value={i}>
                      {fr.pharmacy.islands[i.toLowerCase()]} ({fr.pharmacy.islandsFrench[i.toLowerCase()]})
                    </option>
                  ))}
                </select>
              </Field>
              <Field id={id('locality')} label="Localité">
                <select
                  id={id('locality')}
                  value={form.localityId}
                  onChange={(e) => set({ localityId: e.target.value })}
                  className={input}
                >
                  <option value="">Choisissez…</option>
                  {islandLocalities.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              id={id('address')}
              label="Adresse"
              hint="Quartier, rue, repère : ce qui aide les patients à vous trouver."
            >
              <input
                id={id('address')}
                maxLength={200}
                autoComplete="street-address"
                value={form.addressLine}
                onChange={(e) => set({ addressLine: e.target.value })}
                className={input}
              />
            </Field>
          </fieldset>

          <label className="flex gap-3 text-sm text-text">
            <input
              type="checkbox"
              className="mt-1 size-4 shrink-0 accent-primary"
              checked={form.acceptTerms}
              onChange={(e) => set({ acceptTerms: e.target.checked })}
            />
            <span>
              J’accepte les{' '}
              <Link href="/cgu" className="font-medium text-primary underline" target="_blank">
                conditions d’utilisation
              </Link>{' '}
              et la{' '}
              <Link href="/confidentialite" className="font-medium text-primary underline" target="_blank">
                politique de protection des données
              </Link>
              .
            </span>
          </label>
          {alert}
          <Button type="submit" size="lg" disabled={busy} fullWidth>
            Créer mon compte professionnel
          </Button>
          <p className="text-xs text-text-muted">
            Votre profil sera visible des patients après la vérification de votre dossier par l’équipe
            Twabibu.
          </p>
        </form>
      ) : null}
    </div>
  );
}
