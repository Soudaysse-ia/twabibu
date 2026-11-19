'use client';

import { useState } from 'react';
import { Card, cn } from '@twabibu/ui';
import { api, errorMessage } from '@/lib/api';
import { dateTime, fieldClass } from '@/lib/ui';
import { Empty, Loading, Notice, PageTitle } from './Page';
import { useApi } from './useApi';

interface AuditRow { id: string; at: string; actor: string; action: string; entityType: string; entityId: string | null; ip: string | null; changes: unknown }
interface Flag { key: string; enabled: boolean; description: string | null }

export function AuditLog() {
  const [f, setF] = useState({ actor: '', action: '', entityType: '', from: '', to: '' });
  const query = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const { data, error } = useApi<AuditRow[]>(`/v1/admin/audit${query ? `?${query}` : ''}`);
  return (
    <>
      <PageTitle title="Journal d’audit">
        <a href={`/api/v1/admin/audit.csv${query ? `?${query}` : ''}`} className="text-sm font-medium text-primary hover:underline">Exporter en CSV</a>
      </PageTitle>
      <p className="mb-3 text-sm text-text-muted">Toutes les actions du back-office et des espaces professionnels sensibles. Le journal ne peut pas être modifié.</p>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <input aria-label="Acteur" placeholder="Acteur (e-mail)" value={f.actor} onChange={(e) => setF({ ...f, actor: e.target.value })} className={fieldClass} />
        <input aria-label="Action" placeholder="Action (ex. practitioner.)" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} className={fieldClass} />
        <input aria-label="Type d’entité" placeholder="Entité (ex. Organization)" value={f.entityType} onChange={(e) => setF({ ...f, entityType: e.target.value })} className={fieldClass} />
        <label className="text-xs text-text-muted">Du<input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={fieldClass} /></label>
        <label className="text-xs text-text-muted">Au<input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} className={fieldClass} /></label>
      </div>
      {!data ? <Loading error={error} /> : data.length === 0 ? <Empty>Aucune entrée.</Empty> : (
        <ul className="divide-y divide-border rounded-md border border-border bg-surface">
          {data.map((r) => (
            <li key={r.id} className="flex flex-col gap-0.5 px-4 py-2.5 text-sm">
              <span className="text-ink"><span className="font-medium">{r.action}</span> · {r.entityType}{r.entityId ? ` ${r.entityId.slice(0, 8)}…` : ''}</span>
              <span className="text-xs text-text-muted">{dateTime(r.at)} · {r.actor}{r.ip ? ` · ${r.ip}` : ''}</span>
              {r.changes ? <code className="text-xs break-all text-text-muted">{JSON.stringify(r.changes).slice(0, 300)}</code> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function FeatureFlags() {
  const { data, error, setData } = useApi<Flag[]>('/v1/admin/flags');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  if (!data) return <Loading error={error} />;
  async function toggle(flag: Flag) {
    try {
      setData(await api<Flag[]>(`/v1/admin/flags/${flag.key}`, { method: 'PUT', body: { enabled: !flag.enabled } }));
      setNotice({ ok: true, text: `${flag.key} ${flag.enabled ? 'désactivée' : 'activée'}.` });
    } catch (e) {
      setNotice({ ok: false, text: errorMessage(e) });
    }
  }
  return (
    <>
      <PageTitle title="Options de fonctionnalités" />
      <p className="mb-3 text-sm text-text-muted">Activation globale. Une option activée ne fait rien tant que la fonctionnalité n’est pas livrée.</p>
      <Notice message={notice} />
      {data.length === 0 ? <Empty>Aucune option.</Empty> : (
        <ul className="mt-3 flex flex-col gap-2">
          {data.map((f) => (
            <li key={f.key}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-ink">{f.key}</p>
                  <p className="text-sm text-text">{f.description}</p>
                </div>
                <label className={cn('flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border px-4 text-sm font-medium', f.enabled ? 'border-success bg-success-soft text-success' : 'border-border')}>
                  <input type="checkbox" role="switch" checked={f.enabled} onChange={() => toggle(f)} className="size-4 accent-primary" />
                  {f.enabled ? 'Activée' : 'Désactivée'}
                </label>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
