'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ContactRequestSchema, ContactTopic } from '@twabibu/contracts';
import { fr } from '@twabibu/i18n';
import { Button, cn } from '@twabibu/ui';
import { api, ApiError, errorMessage } from '@/lib/api-client';

const t = fr.contact;
const MAX_MESSAGE = 3000;
const field =
  'w-full rounded-md border bg-surface px-3 text-base text-ink placeholder:text-text-muted focus:border-primary focus:outline-2 focus:outline-primary/30 sm:text-sm';

type Values = { name: string; email: string; topic: string; message: string; website: string };
type Errors = Partial<Record<'name' | 'email' | 'topic' | 'message', string>>;

/** Field errors from the shared schema, so the browser and the API agree on what is valid. */
function validate(values: Values): Errors {
  const parsed = ContactRequestSchema.safeParse(values);
  if (parsed.success) return {};
  const errors: Errors = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0]) as keyof Errors;
    if (key in t.errors && !errors[key]) errors[key] = t.errors[key];
  }
  return errors;
}

/** Contact form (WEB-02): sends one message to the support team, never anything medical. */
export function ContactForm() {
  const id = useId();
  const [values, setValues] = useState<Values>({ name: '', email: '', topic: '', message: '', website: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const formRef = useRef<HTMLFormElement>(null);
  const sentRef = useRef<HTMLDivElement>(null);

  // The form is replaced by the confirmation: move focus there so keyboard and screen-reader users hear it.
  useEffect(() => {
    if (status === 'sent') sentRef.current?.focus();
  }, [status]);

  const set = (key: keyof Values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFailure(null);
    const found = validate(values);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setStatus('sending');
    try {
      await api('/v1/contact', { method: 'POST', body: { ...values, website: values.website || undefined } });
      setStatus('sent');
    } catch (err) {
      setStatus('idle');
      const details =
        err instanceof ApiError && Array.isArray(err.details) ? (err.details as { path?: string }[]) : [];
      const serverErrors: Errors = {};
      for (const d of details) {
        const key = d.path as keyof Errors;
        if (key && key in t.errors) serverErrors[key] = t.errors[key];
      }
      if (Object.keys(serverErrors).length) setErrors(serverErrors);
      else setFailure(errorMessage(err));
    }
  }

  if (status === 'sent') {
    return (
      <div
        ref={sentRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="flex flex-col items-start gap-4 rounded-lg bg-success-soft p-5 text-ink focus:outline-2 focus:outline-primary"
      >
        <p className="font-medium">{t.sent}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setValues((v) => ({ ...v, message: '' }));
            setStatus('idle');
          }}
        >
          {t.sendAnother}
        </Button>
      </div>
    );
  }

  const describedBy = (key: keyof Errors, hint?: boolean) =>
    cn(hint && `${id}-${key}-hint`, errors[key] && `${id}-${key}-error`) || undefined;
  const error = (key: keyof Errors) =>
    errors[key] ? (
      <p id={`${id}-${key}-error`} className="text-sm text-danger">
        {errors[key]}
      </p>
    ) : null;

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-name`} className="text-sm font-medium text-ink">
            {t.name}
          </label>
          <input
            id={`${id}-name`}
            name="name"
            autoComplete="name"
            maxLength={100}
            value={values.name}
            onChange={set('name')}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy('name')}
            className={cn(field, 'h-12', errors.name ? 'border-danger' : 'border-border')}
          />
          {error('name')}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-email`} className="text-sm font-medium text-ink">
            {t.email}
          </label>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            value={values.email}
            onChange={set('email')}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy('email', true)}
            className={cn(field, 'h-12', errors.email ? 'border-danger' : 'border-border')}
          />
          <p id={`${id}-email-hint`} className="text-xs text-text-muted">
            {t.emailHint}
          </p>
          {error('email')}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2" aria-describedby={describedBy('topic')}>
        <legend className="mb-1 text-sm font-medium text-ink">{t.topic}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ContactTopic.options.map((topic) => (
            <label
              key={topic}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm text-ink has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary',
                errors.topic ? 'border-danger' : 'border-border',
              )}
            >
              <input
                type="radio"
                name="topic"
                value={topic}
                checked={values.topic === topic}
                onChange={() => setValues((v) => ({ ...v, topic }))}
                className="size-4 accent-primary"
              />
              {t.topics[topic]}
            </label>
          ))}
        </div>
        {error('topic')}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-message`} className="text-sm font-medium text-ink">
          {t.message}
        </label>
        <p id={`${id}-message-hint`} className="text-sm text-text-muted">
          {t.messageHint}
        </p>
        <textarea
          id={`${id}-message`}
          name="message"
          rows={7}
          maxLength={MAX_MESSAGE}
          value={values.message}
          onChange={set('message')}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describedBy('message', true)}
          className={cn(field, 'py-3', errors.message ? 'border-danger' : 'border-border')}
        />
        <p className="self-end text-xs text-text-muted" aria-hidden="true">
          {values.message.length} / {MAX_MESSAGE}
        </p>
        {error('message')}
      </div>

      {/* Honeypot: off screen and out of the tab order; people never fill it in, robots do. */}
      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor={`${id}-website`}>{t.honeypot}</label>
        <input
          id={`${id}-website`}
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={set('website')}
        />
      </div>

      {failure ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {failure}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-text-muted">{t.privacy}</p>
        <Button type="submit" disabled={status === 'sending'} className="sm:min-w-48">
          {status === 'sending' ? t.sending : t.submit}
        </Button>
      </div>
    </form>
  );
}
