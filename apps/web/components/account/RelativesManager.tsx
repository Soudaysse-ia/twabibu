'use client';

import { useState } from 'react';
import { Pencil, Phone, Plus, Trash2, UserRound } from 'lucide-react';
import { Button, Card } from '@twabibu/ui';
import { formatDateLong, formatPhone } from '@twabibu/utils';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import type { Me } from '@/lib/types';

type Relative = Me['relatives'][number];
type Draft = { firstName: string; lastName: string; birthDate: string; relationship: string; phone: string };

export const RELATIONSHIPS: Record<string, string> = {
  ENFANT: 'Enfant',
  PARENT: 'Parent',
  CONJOINT: 'Conjoint ou conjointe',
  AUTRE: 'Autre proche',
};
const EMPTY: Draft = { firstName: '', lastName: '', birthDate: '', relationship: 'ENFANT', phone: '' };
const input =
  'h-12 w-full rounded-md border border-border bg-surface px-3 text-base text-ink focus:border-primary focus:outline-2 focus:outline-primary/30 sm:text-sm';

function age(birthDate: string): string {
  const b = new Date(`${birthDate}T00:00:00Z`);
  const now = new Date();
  let years = now.getUTCFullYear() - b.getUTCFullYear();
  if (
    now.getUTCMonth() < b.getUTCMonth() ||
    (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())
  )
    years--;
  if (years >= 1) return `${years} an${years > 1 ? 's' : ''}`;
  const months =
    (now.getUTCFullYear() - b.getUTCFullYear()) * 12 +
    now.getUTCMonth() -
    b.getUTCMonth() -
    (now.getUTCDate() < b.getUTCDate() ? 1 : 0);
  return `${Math.max(0, months)} mois`;
}

/**
 * « Mes proches » (SPEC-04, ACCOUNT-02): the people the account holder books for. They have no account of their own.
 * Removal is refused by the API while an appointment is coming up.
 */
export function RelativesManager({ initial }: { initial: Relative[] }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  function open(target: Relative | 'new') {
    setError(null);
    setStatus(null);
    setConfirmRemove(null);
    if (target === 'new') {
      setDraft(EMPTY);
      setEditing('new');
    } else {
      setDraft({
        firstName: target.firstName,
        lastName: target.lastName,
        birthDate: target.birthDate,
        relationship: target.relationship,
        phone: target.phone ? formatPhone(target.phone) : '',
      });
      setEditing(target.id);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = { ...draft, phone: draft.phone.trim() || undefined };
    try {
      if (editing === 'new') {
        const created = await api<Relative>('/v1/me/relatives', { method: 'POST', body });
        setItems([...items, created]);
        setStatus(`${created.firstName} a été ajouté(e) à vos proches.`);
      } else {
        const updated = await api<Relative>(`/v1/me/relatives/${editing}`, { method: 'PATCH', body });
        setItems(items.map((r) => (r.id === updated.id ? updated : r)));
        setStatus(`Les informations de ${updated.firstName} sont enregistrées.`);
      }
      setEditing(null);
    } catch (err) {
      setError(
        err instanceof ApiError &&
          err.code === 'VALIDATION_FAILED' &&
          (err.details as { field?: string } | undefined)?.field === 'phone'
          ? 'Ce numéro de téléphone n’est pas valide. Exemple : 321 23 45.'
          : errorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(r: Relative) {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/me/relatives/${r.id}`, { method: 'DELETE' });
      setItems(items.filter((x) => x.id !== r.id));
      setStatus(
        `${r.firstName} a été retiré(e) de vos proches. Ses rendez-vous passés restent dans votre historique.`,
      );
    } catch (err) {
      setStatus(null);
      setError(
        err instanceof ApiError && err.code === 'CONFLICT'
          ? `${r.firstName} a un rendez-vous à venir. Annulez-le d’abord depuis « Mes rendez-vous ».`
          : errorMessage(err),
      );
    } finally {
      setBusy(false);
      setConfirmRemove(null);
    }
  }

  const form = (
    <form
      onSubmit={save}
      className="flex flex-col gap-4"
      aria-label={editing === 'new' ? 'Ajouter un proche' : 'Modifier le proche'}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Prénom
          <input
            required
            maxLength={60}
            autoComplete="off"
            value={draft.firstName}
            onChange={(e) => setDraft({ ...draft, firstName: e.target.value })}
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Nom
          <input
            required
            maxLength={60}
            autoComplete="off"
            value={draft.lastName}
            onChange={(e) => setDraft({ ...draft, lastName: e.target.value })}
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
            value={draft.birthDate}
            onChange={(e) => setDraft({ ...draft, birthDate: e.target.value })}
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          Lien avec vous
          <select
            value={draft.relationship}
            onChange={(e) => setDraft({ ...draft, relationship: e.target.value })}
            className={input}
          >
            {Object.entries(RELATIONSHIPS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink sm:col-span-2">
          <span>
            Téléphone{' '}
            <span className="font-normal text-text-muted">
              (facultatif, pour que le cabinet puisse le joindre)
            </span>
          </span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="321 23 45"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            className={input}
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {editing === 'new' ? 'Ajouter' : 'Enregistrer'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
          Annuler
        </Button>
      </div>
    </form>
  );

  return (
    <div className="flex flex-col gap-4">
      <p
        aria-live="polite"
        className={status ? 'rounded-md bg-success-soft px-3 py-2 text-sm text-ink' : 'sr-only'}
      >
        {status ?? ''}
      </p>
      {error && editing === null ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {items.length === 0 && editing !== 'new' ? (
        <Card className="flex flex-col items-start gap-3 text-text">
          <UserRound aria-hidden="true" size={24} className="text-primary" />
          <p>
            Ajoutez vos enfants, vos parents ou votre conjoint pour prendre rendez-vous pour eux depuis votre
            compte.
          </p>
        </Card>
      ) : null}

      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((r) => (
          <li key={r.id}>
            <Card className="flex h-full flex-col gap-3">
              {editing === r.id ? (
                form
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-base font-bold text-primary"
                    >
                      {r.firstName.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="font-heading text-base font-bold text-ink">
                        {r.firstName} {r.lastName}
                      </p>
                      <p className="text-sm text-text">
                        {RELATIONSHIPS[r.relationship] ?? r.relationship} · {age(r.birthDate)}
                      </p>
                      <p className="text-sm text-text-muted">
                        Né(e) le {formatDateLong(new Date(`${r.birthDate}T12:00:00Z`))}
                      </p>
                      {r.phone ? (
                        <p className="flex items-center gap-1.5 text-sm text-text-muted">
                          <Phone aria-hidden="true" size={14} /> {formatPhone(r.phone)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {confirmRemove === r.id ? (
                    <div className="flex flex-col gap-2 rounded-md bg-background-soft p-3 text-sm text-text">
                      <p>
                        Retirer {r.firstName} de vos proches ? Vous ne pourrez plus prendre rendez-vous pour{' '}
                        {r.firstName} sans l’ajouter à nouveau.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="md" variant="danger" disabled={busy} onClick={() => remove(r)}>
                          Retirer
                        </Button>
                        <Button size="md" variant="secondary" onClick={() => setConfirmRemove(null)}>
                          Garder
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Button
                        size="md"
                        variant="secondary"
                        onClick={() => open(r)}
                        aria-label={`Modifier ${r.firstName} ${r.lastName}`}
                      >
                        <Pencil aria-hidden="true" size={14} /> Modifier
                      </Button>
                      <Button
                        size="md"
                        variant="ghost"
                        onClick={() => {
                          setError(null);
                          setStatus(null);
                          setConfirmRemove(r.id);
                        }}
                        aria-label={`Retirer ${r.firstName} ${r.lastName}`}
                      >
                        <Trash2 aria-hidden="true" size={14} /> Retirer
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Card>
          </li>
        ))}
      </ul>

      {editing === 'new' ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-base font-bold">Ajouter un proche</h2>
          {form}
        </Card>
      ) : (
        <Button variant="secondary" className="self-start" onClick={() => open('new')}>
          <Plus aria-hidden="true" size={16} /> Ajouter un proche
        </Button>
      )}
    </div>
  );
}
