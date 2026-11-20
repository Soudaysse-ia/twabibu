'use client';

import { useState } from 'react';
import { Lock, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card } from '@twabibu/ui';
import { api, errorMessage } from '@/lib/api-client';

export interface SharingItem {
  organizationId: string;
  organizationName: string;
  shared: boolean;
}

/** One line per practice where the patient has a file: share the whole record, or stop sharing it. */
export function RecordSharing({ items: initial }: { items: SharingItem[] }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  async function toggle(item: SharingItem) {
    setBusy(item.organizationId);
    setStatus(null);
    try {
      const next = await api<SharingItem[]>(`/v1/me/record/consents/${item.organizationId}`, { method: item.shared ? 'DELETE' : 'POST' });
      setItems(next);
      setStatus({ tone: 'ok', text: item.shared ? `${item.organizationName} ne voit plus que ce qu’il a noté lui-même.` : `${item.organizationName} peut maintenant voir votre dossier complet.` });
    } catch (err) {
      setStatus({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p aria-live="polite" className={status ? (status.tone === 'ok' ? 'rounded-md bg-success-soft px-3 py-2 text-sm text-ink' : 'rounded-md bg-danger-soft px-3 py-2 text-sm text-danger') : 'sr-only'}>
        {status?.text ?? ''}
      </p>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.organizationId}>
            <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                {item.shared ? <ShieldCheck aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-success" /> : <Lock aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-text-muted" />}
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-ink">{item.organizationName}</span>
                  <Badge tone={item.shared ? 'success' : 'info'} className="self-start">{item.shared ? 'Voit votre dossier complet' : 'Voit seulement ses propres notes'}</Badge>
                </div>
              </div>
              <Button variant={item.shared ? 'secondary' : 'primary'} size="md" disabled={busy !== null} onClick={() => toggle(item)} aria-label={item.shared ? `Retirer l’accès de ${item.organizationName}` : `Autoriser ${item.organizationName} à voir mon dossier`}>
                {busy === item.organizationId ? 'Un instant…' : item.shared ? 'Retirer l’accès' : 'Autoriser l’accès'}
              </Button>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
