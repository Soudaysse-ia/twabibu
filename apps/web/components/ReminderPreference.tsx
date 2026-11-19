'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { Card, cn } from '@twabibu/ui';
import { api, errorMessage } from '@/lib/api-client';

const t = fr.reminders;

/** « Mes rendez-vous »: the patient switches reminders on or off (SPEC-08 §Règles 4). */
export function ReminderPreference() {
  const [on, setOn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    api<{ reminders: boolean }>('/v1/me/notification-preferences')
      .then((p) => setOn(p.reminders))
      .catch(() => setOn(null));
  }, []);
  if (on === null) return null;

  async function toggle() {
    const next = !on;
    setStatus(null);
    try {
      const p = await api<{ reminders: boolean }>('/v1/me/notification-preferences', { method: 'PUT', body: { reminders: next } });
      setOn(p.reminders);
      setStatus({ ok: true, text: p.reminders ? t.preferenceOn : t.preferenceOff });
    } catch (error) {
      setStatus({ ok: false, text: errorMessage(error) });
    }
  }

  return (
    <Card id="rappels" className="flex flex-col gap-3 scroll-mt-24">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <BellRing aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-primary" />
          <div>
            <h2 className="text-base font-bold">{t.preferenceTitle}</h2>
            <p id="rappels-texte" className="text-sm text-text">{t.preferenceText}</p>
            <p className="text-xs text-text-muted">{t.preferenceNote}</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="rappels-texte"
          onClick={toggle}
          className={cn('relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary', on ? 'bg-primary' : 'bg-border')}
        >
          <span className={cn('absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left]', on ? 'left-[22px]' : 'left-0.5')} />
        </button>
      </div>
      <p aria-live="polite" className={cn('text-sm', status?.ok ? 'text-success' : 'text-danger')}>
        {status?.text}
      </p>
    </Card>
  );
}
