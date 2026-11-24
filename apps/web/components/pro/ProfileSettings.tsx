'use client';

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ExternalLink, Plus, Trash2, X } from 'lucide-react';
import { PractitionerProfileUpdateSchema, type PractitionerProfileUpdate } from '@twabibu/contracts';
import { fr } from '@twabibu/i18n';
import { Button, Card, cn } from '@twabibu/ui';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import { fieldClass } from './Drawer';
import { useMembership } from './ProContext';

const t = fr.profileEdit;
/** 16 px in fields on a phone, so that the browser does not zoom in (CLAUDE.md). */
const inputClass = fieldClass.replace(' text-sm ', ' text-base sm:text-sm ');
const BIO_MAX = 2000;
const EXPERTISES_MAX = 20;

interface EditableProfile {
  id: string;
  displayName: string;
  speciality: string;
  licenseNumber: string | null;
  verificationStatus: string;
  publicUrl: string | null;
  profile: PractitionerProfileUpdate;
}
interface Profiles {
  practitioners: EditableProfile[];
  options: { languages: { code: string; name: string }[]; paymentMethods: string[]; insurances: string[] };
}
/** A diploma being typed: the year stays text until it is checked. */
type EducationDraft = { year: string; diploma: string; school: string };
type Draft = Omit<PractitionerProfileUpdate, 'educations' | 'bio'> & {
  bio: string;
  educations: EducationDraft[];
};

const toDraft = (p: PractitionerProfileUpdate): Draft => ({
  ...p,
  bio: p.bio ?? '',
  educations: p.educations.map((e) => ({ year: String(e.year), diploma: e.diploma, school: e.school })),
});
const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        {hint ? <p className="text-sm text-text-muted">{hint}</p> : null}
      </div>
      {children}
    </Card>
  );
}

function CheckList({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-11 items-center gap-3 rounded-md border border-border px-3 text-sm text-ink"
          >
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={value.includes(o.value)}
              onChange={() => onChange(toggle(value, o.value))}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** /pro/app/reglages/profil (PRO-07): the practitioner writes their public page; managers write every practitioner's. */
export function ProfileSettings() {
  const membership = useMembership();
  const ids = useId();
  const [data, setData] = useState<Profiles | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<Profiles>(`/v1/pro/orgs/${membership.organizationId}/profiles`);
      setData(res);
      const first =
        res.practitioners.find((p) => p.id === membership.practitionerId) ?? res.practitioners[0]!;
      setSelected(first.id);
      setDraft(toDraft(first.profile));
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [membership.organizationId, membership.practitionerId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError) return <p className="rounded-md bg-warning-soft p-3 text-sm text-ink">{loadError}</p>;
  if (!data || !draft) return <p className="text-text-muted">{t.loading}</p>;
  const current = data.practitioners.find((p) => p.id === selected)!;

  function choose(id: string) {
    const p = data!.practitioners.find((x) => x.id === id)!;
    setSelected(id);
    setDraft(toDraft(p.profile));
    setMessage(null);
  }

  function addTag() {
    const value = tag.replace(/\s+/g, ' ').trim();
    if (!value) return;
    if (!draft!.expertises.some((e) => e.toLocaleLowerCase('fr') === value.toLocaleLowerCase('fr'))) {
      setDraft({ ...draft!, expertises: [...draft!.expertises, value] });
    }
    setTag('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const parsed = PractitionerProfileUpdateSchema.safeParse({
      ...draft,
      bio: draft!.bio.trim() ? draft!.bio : null,
      educations: draft!.educations.map((x) => ({
        year: Number(x.year),
        diploma: x.diploma,
        school: x.school,
      })),
    });
    const thisYear = new Date().getFullYear();
    if (!parsed.success || parsed.data.educations.some((x) => x.year > thisYear)) {
      const field = parsed.success ? 'educations' : String(parsed.error.issues[0]?.path[0] ?? '');
      setMessage({ tone: 'error', text: t.errors[field] ?? fr.errors.VALIDATION_FAILED });
      return;
    }
    setBusy(true);
    try {
      const saved = await api<EditableProfile>(
        `/v1/pro/orgs/${membership.organizationId}/profiles/${current.id}`,
        { method: 'PUT', body: parsed.data },
      );
      setData({ ...data!, practitioners: data!.practitioners.map((p) => (p.id === saved.id ? saved : p)) });
      setDraft(toDraft(saved.profile));
      setMessage({ tone: 'ok', text: t.saved });
    } catch (err) {
      const field =
        err instanceof ApiError ? (err.details as { field?: string } | undefined)?.field : undefined;
      setMessage({ tone: 'error', text: (field && t.errors[field]) || errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const setEducation = (i: number, patch: Partial<EducationDraft>) =>
    setDraft({ ...draft, educations: draft.educations.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {data.practitioners.length > 1 ? (
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          {t.practitioner}
          <select
            value={selected}
            onChange={(e) => choose(e.target.value)}
            className={cn(inputClass, 'sm:max-w-sm')}
          >
            {data.practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {current.publicUrl ? (
        <a
          href={current.publicUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary hover:underline"
        >
          <ExternalLink aria-hidden="true" size={16} />
          {t.view}
        </a>
      ) : (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-ink">{t.notOnline}</p>
      )}

      <Section title={t.checked} hint={t.checkedHint}>
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          {(
            [
              [t.name, current.displayName],
              [t.speciality, current.speciality],
              [t.license, current.licenseNumber ?? t.none],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="text-text-muted">{label}</dt>
              <dd className="font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <Link
          href="/contact"
          className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline"
        >
          {t.contact}
        </Link>
      </Section>

      <Section title={t.bio} hint={t.bioHint}>
        <label className="flex items-center justify-between gap-4 text-sm text-ink">
          {t.newPatients}
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={draft.acceptsNewPatients}
            onChange={(e) => setDraft({ ...draft, acceptsNewPatients: e.target.checked })}
          />
        </label>
        <label htmlFor={`${ids}-bio`} className="sr-only">
          {t.bio}
        </label>
        <textarea
          id={`${ids}-bio`}
          rows={7}
          maxLength={BIO_MAX}
          value={draft.bio}
          onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
          aria-describedby={`${ids}-bio-count`}
          className="rounded-md border border-border p-3 text-base text-ink focus:border-primary focus:outline-2 focus:outline-primary/30 sm:text-sm"
        />
        <p id={`${ids}-bio-count`} className="self-end text-xs text-text-muted">
          {t.chars(draft.bio.length, BIO_MAX)}
        </p>
      </Section>

      <Section title={t.expertises} hint={t.expertisesHint}>
        {draft.expertises.length ? (
          <ul className="flex flex-wrap gap-2">
            {draft.expertises.map((e) => (
              <li
                key={e}
                className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-1 pr-1 pl-3 text-sm text-primary"
              >
                {e}
                <button
                  type="button"
                  aria-label={t.removeTag(e)}
                  onClick={() => setDraft({ ...draft, expertises: draft.expertises.filter((x) => x !== e) })}
                  className="inline-flex size-8 items-center justify-center rounded-full hover:bg-white"
                >
                  <X aria-hidden="true" size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {draft.expertises.length < EXPERTISES_MAX ? (
          <div className="flex gap-2">
            <input
              aria-label={t.expertisePlaceholder}
              placeholder={t.expertisePlaceholder}
              maxLength={60}
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              className={cn(inputClass, 'flex-1')}
            />
            <Button type="button" variant="secondary" onClick={addTag} disabled={!tag.trim()}>
              {t.addExpertise}
            </Button>
          </div>
        ) : null}
      </Section>

      <Section title={t.languages}>
        <CheckList
          legend={t.languages}
          options={data.options.languages.map((l) => ({ value: l.code, label: l.name }))}
          value={draft.languages}
          onChange={(languages) => setDraft({ ...draft, languages })}
        />
      </Section>

      <Section title={t.payment} hint={t.prices}>
        <CheckList
          legend={t.payment}
          options={data.options.paymentMethods.map((m) => ({ value: m, label: t.paymentLabels[m] ?? m }))}
          value={draft.paymentMethods}
          onChange={(v) => setDraft({ ...draft, paymentMethods: v as Draft['paymentMethods'] })}
        />
        <Link
          href="/pro/app/reglages#motifs"
          className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline"
        >
          {t.pricesLink}
        </Link>
      </Section>

      <Section title={t.insurances}>
        <CheckList
          legend={t.insurances}
          options={data.options.insurances.map((i) => ({ value: i, label: i }))}
          value={draft.insurances}
          onChange={(insurances) => setDraft({ ...draft, insurances })}
        />
      </Section>

      <Section title={t.educations}>
        {draft.educations.map((e, i) => (
          <fieldset
            key={i}
            className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[6rem_1fr_1fr_auto] sm:items-end"
          >
            <legend className="sr-only">{`${t.diploma} ${i + 1}`}</legend>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink">
              {t.year}
              <input
                inputMode="numeric"
                maxLength={4}
                value={e.year}
                onChange={(ev) => setEducation(i, { year: ev.target.value.replace(/\D/g, '') })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink">
              {t.diploma}
              <input
                maxLength={120}
                value={e.diploma}
                onChange={(ev) => setEducation(i, { diploma: ev.target.value })}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink">
              {t.school}
              <input
                maxLength={120}
                value={e.school}
                onChange={(ev) => setEducation(i, { school: ev.target.value })}
                className={inputClass}
              />
            </label>
            <button
              type="button"
              aria-label={t.removeEducation}
              onClick={() => setDraft({ ...draft, educations: draft.educations.filter((_, j) => j !== i) })}
              className="inline-flex size-11 items-center justify-center self-end rounded-md text-danger hover:bg-danger-soft"
            >
              <Trash2 aria-hidden="true" size={16} />
            </button>
          </fieldset>
        ))}
        {draft.educations.length < 10 ? (
          <button
            type="button"
            onClick={() =>
              setDraft({ ...draft, educations: [...draft.educations, { year: '', diploma: '', school: '' }] })
            }
            className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary hover:underline"
          >
            <Plus aria-hidden="true" size={16} />
            {t.addEducation}
          </button>
        ) : null}
      </Section>

      <div aria-live="polite">
        {message ? (
          <p
            role={message.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'rounded-md px-3 py-2 text-sm',
              message.tone === 'ok' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
            )}
          >
            {message.text}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={busy} className="sm:self-start">
        {busy ? t.saving : t.save}
      </Button>
    </form>
  );
}
