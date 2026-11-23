'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ProfileReportSchema, ReportReason } from '@twabibu/contracts';
import { fr } from '@twabibu/i18n';
import { Button, cn } from '@twabibu/ui';
import { api, errorMessage } from '@/lib/api-client';

const t = fr.report;
const MAX = 1000;

/** Report form (PROFILE-06): a reason, optional details, a hidden field for robots, a clear confirmation. */
export function ProfileReportForm({ slug, profileUrl }: { slug: string; profileUrl: string }) {
  const id = useId();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const sentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status === 'sent') sentRef.current?.focus();
  }, [status]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = { reason, details: details.trim() || undefined, website: website || undefined };
    const parsed = ProfileReportSchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues.some((i) => i.path[0] === 'reason') ? t.chooseReason : t.tooLong);
      return;
    }
    setError(null);
    setStatus('sending');
    try {
      await api(`/v1/practitioners/${encodeURIComponent(slug)}/reports`, { method: 'POST', body });
      setStatus('sent');
    } catch (err) {
      setStatus('idle');
      setError(errorMessage(err));
    }
  }

  if (status === 'sent') {
    return (
      <div
        ref={sentRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="flex flex-col items-start gap-3 rounded-lg bg-success-soft p-4 text-ink focus:outline-2 focus:outline-primary"
      >
        <p className="font-medium">{t.sent}</p>
        <Link href={profileUrl} className="text-sm font-medium text-primary hover:underline">
          {t.back}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">{t.reason}</legend>
        {ReportReason.options.map((r) => (
          <label
            key={r}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 text-sm text-ink has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
          >
            <input
              type="radio"
              name="reason"
              value={r}
              checked={reason === r}
              onChange={() => setReason(r)}
              className="size-4 shrink-0 accent-primary"
            />
            {t.reasons[r]}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-details`} className="text-sm font-medium text-ink">
          {t.details}
        </label>
        <p id={`${id}-hint`} className="text-sm text-text-muted">
          {t.detailsHint}
        </p>
        <textarea
          id={`${id}-details`}
          rows={5}
          maxLength={MAX}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          aria-describedby={`${id}-hint`}
          className="w-full rounded-md border border-border bg-surface p-3 text-base text-ink focus:border-primary focus:outline-2 focus:outline-primary/30 sm:text-sm"
        />
        <p className="self-end text-xs text-text-muted" aria-hidden="true">
          {details.length} / {MAX}
        </p>
      </div>
      {/* Honeypot: off screen and out of the tab order. */}
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={`${id}-website`}>{t.honeypot}</label>
        <input
          id={`${id}-website`}
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className={cn('rounded-md bg-danger-soft px-3 py-2 text-sm text-danger')}>
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={status === 'sending'} className="self-start">
        {status === 'sending' ? t.sending : t.submit}
      </Button>
    </form>
  );
}
