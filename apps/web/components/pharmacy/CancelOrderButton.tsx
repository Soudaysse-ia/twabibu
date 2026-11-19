'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { fr } from '@twabibu/i18n';
import { Button } from '@twabibu/ui';
import { api, errorMessage } from '@/lib/api-client';

/** Two-step cancel (no browser dialog): the patient confirms on the page itself. */
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function cancel() {
    setBusy(true);
    try {
      await api(`/v1/me/orders/${orderId}/cancel`, { method: 'POST' });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink">Annuler cette commande ?</span>
          <Button variant="secondary" onClick={cancel} disabled={busy}>
            Oui, annuler
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Non
          </Button>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirm(true)} className="self-start">
          {fr.pharmacy.cancelOrder}
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
