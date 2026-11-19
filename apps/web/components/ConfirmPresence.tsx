'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { Button } from '@twabibu/ui';
import { api, errorMessage } from '@/lib/api-client';

const t = fr.reminders;

/** The confirmation is a POST from this button: mail scanners that open the link confirm nothing. */
export function ConfirmPresence({ appointmentId, token, alreadyConfirmed }: { appointmentId: string; token: string; alreadyConfirmed: boolean }) {
  const [done, setDone] = useState(alreadyConfirmed);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/appointments/${appointmentId}/presence`, { method: 'POST', body: { t: token } });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      {done ? (
        <p className="flex items-start gap-2 rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          <Check aria-hidden="true" size={18} className="mt-0.5 shrink-0" /> {t.confirmed}
        </p>
      ) : (
        <Button size="lg" onClick={confirm} disabled={busy} className="self-start">
          {busy ? 'Envoi…' : t.confirmButton}
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
