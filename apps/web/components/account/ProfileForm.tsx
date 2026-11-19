'use client';

import { useState } from 'react';
import { fr } from '@twabibu/i18n';
import { Button, Card } from '@twabibu/ui';
import { api, errorMessage } from '@/lib/api-client';

export interface PatientProfileView {
  civility: string | null;
  firstName: string;
  lastName: string;
  birthDate: string;
  addressLine: string | null;
  localityId: string | null;
  insurance: string | null;
  email: string | null;
}
export interface LocalityOption {
  id: string;
  name: string;
  island: string;
}

const CIVILITIES = [
  ['MME', 'Mme'],
  ['M', 'M.'],
  ['AUTRE', 'Autre'],
] as const;
const ISLAND_ORDER = ['NGAZIDJA', 'NDZUANI', 'MWALI'];
const input =
  'h-12 w-full rounded-md border border-border bg-surface px-3 text-base text-ink focus:border-primary focus:outline-2 focus:outline-primary/30 sm:text-sm';

/** « Mon profil » (SPEC-04, ACCOUNT-03): identity, address and insurance. A name change is logged by the API. */
export function ProfileForm({
  initial,
  localities,
}: {
  initial: PatientProfileView;
  localities: LocalityOption[];
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const nameChanged =
    form.firstName.trim() !== initial.firstName || form.lastName.trim() !== initial.lastName;
  const today = new Date().toISOString().slice(0, 10);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const saved = await api<PatientProfileView>('/v1/me/profile', {
        method: 'PUT',
        body: {
          civility: form.civility || null,
          firstName: form.firstName,
          lastName: form.lastName,
          birthDate: form.birthDate,
          addressLine: form.addressLine?.trim() || null,
          localityId: form.localityId || null,
          insurance: form.insurance?.trim() || null,
        },
      });
      setForm(saved);
      setStatus({ ok: true, text: 'Votre profil est enregistré.' });
    } catch (err) {
      setStatus({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={save} className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-base font-bold text-ink">Identité</legend>
          <div role="radiogroup" aria-label="Civilité" className="flex gap-2">
            {CIVILITIES.map(([value, label]) => (
              <label
                key={value}
                className={`flex h-11 flex-1 cursor-pointer items-center justify-center rounded-md border text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary sm:max-w-28 ${form.civility === value ? 'border-primary bg-primary-soft text-primary' : 'border-border text-text'}`}
              >
                <input
                  type="radio"
                  name="civility"
                  value={value}
                  className="sr-only"
                  checked={form.civility === value}
                  onChange={() => setForm({ ...form, civility: value })}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Prénom
              <input
                required
                maxLength={60}
                autoComplete="given-name"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className={input}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Nom
              <input
                required
                maxLength={60}
                autoComplete="family-name"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className={input}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Date de naissance
              <input
                required
                type="date"
                min="1900-01-01"
                max={today}
                autoComplete="bday"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                className={input}
              />
            </label>
            <div className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Adresse e-mail
              <p className="flex h-12 items-center rounded-md bg-background-soft px-3 font-normal text-text">
                {form.email}
              </p>
            </div>
          </div>
          {nameChanged ? (
            <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-ink">
              Votre nom doit être celui de votre pièce d’identité : les cabinets s’en servent pour retrouver
              votre fiche. Le changement est enregistré dans l’historique de votre compte.
            </p>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-base font-bold text-ink">Adresse et assurance</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink sm:col-span-2">
              Adresse
              <input
                maxLength={200}
                autoComplete="street-address"
                placeholder="Quartier, rue, repère"
                value={form.addressLine ?? ''}
                onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
                className={input}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Localité
              <select
                value={form.localityId ?? ''}
                onChange={(e) => setForm({ ...form, localityId: e.target.value || null })}
                className={input}
              >
                <option value="">Non renseignée</option>
                {ISLAND_ORDER.map((island) => (
                  <optgroup
                    key={island}
                    label={`${fr.pharmacy.islands[island.toLowerCase()] ?? island} (${fr.pharmacy.islandsFrench[island.toLowerCase()] ?? ''})`}
                  >
                    {localities
                      .filter((l) => l.island === island)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
              Assurance
              <input
                maxLength={100}
                placeholder="Par exemple CNSS, mutuelle…"
                value={form.insurance ?? ''}
                onChange={(e) => setForm({ ...form, insurance: e.target.value })}
                className={input}
              />
            </label>
          </div>
        </fieldset>

        <p
          aria-live="polite"
          className={
            status
              ? status.ok
                ? 'rounded-md bg-success-soft px-3 py-2 text-sm text-ink'
                : 'rounded-md bg-danger-soft px-3 py-2 text-sm text-danger'
              : 'sr-only'
          }
        >
          {status?.text ?? ''}
        </p>
        <Button type="submit" disabled={busy} className="self-start">
          Enregistrer
        </Button>
      </form>
    </Card>
  );
}
