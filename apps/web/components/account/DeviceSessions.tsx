'use client';

import { useEffect, useState } from 'react';
import { Laptop, Smartphone } from 'lucide-react';
import { Badge, Button, Card } from '@twabibu/ui';
import { formatDateLong } from '@twabibu/utils';
import { api, errorMessage } from '@/lib/api-client';

interface DeviceSession {
  id: string;
  device: string;
  createdAt: string;
  current: boolean;
}

/** Signed-in devices (SPEC-04 « Sécurité »): sign out a lost phone or every other device at once. */
export function DeviceSessions() {
  const [items, setItems] = useState<DeviceSession[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    api<DeviceSession[]>('/v1/me/sessions')
      .then(setItems)
      .catch((e) => setStatus({ ok: false, text: errorMessage(e) }));
  }, []);

  async function run(action: () => Promise<unknown>, text: string) {
    setBusy(true);
    setStatus(null);
    try {
      await action();
      setItems(await api<DeviceSession[]>('/v1/me/sessions'));
      setStatus({ ok: true, text });
    } catch (e) {
      setStatus({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const others = items?.filter((s) => !s.current).length ?? 0;
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-bold">Appareils connectés</h2>
        <p className="text-sm text-text">
          Un appareil perdu ou partagé ? Déconnectez-le : il faudra un nouveau code pour revenir sur votre
          compte.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {(items ?? []).map((s) => {
          const Icon = /Android|iPhone|Application/.test(s.device) ? Smartphone : Laptop;
          return (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <Icon aria-hidden="true" size={20} className="shrink-0 text-text-muted" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                  {s.device} {s.current ? <Badge tone="success">Cet appareil</Badge> : null}
                </p>
                <p className="text-xs text-text-muted">
                  Connecté depuis le {formatDateLong(new Date(s.createdAt))}
                </p>
              </div>
              {s.current ? null : (
                <Button
                  size="md"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api(`/v1/me/sessions/${s.id}`, { method: 'DELETE' }),
                      `${s.device} est déconnecté.`,
                    )
                  }
                >
                  Déconnecter
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {others > 1 ? (
        <Button
          variant="secondary"
          className="self-start"
          disabled={busy}
          onClick={() =>
            run(
              () => api('/v1/me/sessions/revoke-others', { method: 'POST' }),
              'Tous vos autres appareils sont déconnectés.',
            )
          }
        >
          Déconnecter tous les autres appareils
        </Button>
      ) : null}
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
    </Card>
  );
}
