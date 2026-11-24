'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { Badge, Button, Card, cn } from '@twabibu/ui';
import { api, errorMessage } from '@/lib/api';
import { dateTime } from '@/lib/ui';
import { Empty, Loading, Notice, PageTitle } from './Page';
import { useApi } from './useApi';

const t = fr.report.admin;

interface Item {
  id: string;
  status: 'OPEN' | 'IN_REVIEW' | 'CLOSED';
  createdAt: string;
  reasonLabel: string;
  details: string | null;
  reporter: string | null;
  openOnProfile: number;
  practitioner: {
    id: string;
    name: string;
    speciality: string;
    organization: string;
    published: boolean;
    url: string;
  } | null;
}

/** Profile reports (SPEC-11 §6, ADMIN-07): read, then ignore, write to the practitioner, or take the profile off. */
export function Reports() {
  const [scope, setScope] = useState<'open' | 'closed'>('open');
  const { data, error, reload } = useApi<Item[]>(`/v1/admin/reports?scope=${scope}`);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function decide(id: string, action: 'DISMISS' | 'CONTACT' | 'UNPUBLISH') {
    setBusy(id);
    setMessage(null);
    try {
      await api(`/v1/admin/reports/${id}/decision`, { method: 'POST', body: { action } });
      setMessage({ ok: true, text: t.done[action]! });
      setConfirming(null);
      reload();
    } catch (e) {
      setMessage({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title={t.title}>
        <div role="group" aria-label="Filtre" className="flex gap-1.5">
          {(['open', 'closed'] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => setScope(s)}
              className={cn(
                'h-11 rounded-md border px-4 text-sm font-medium',
                scope === s
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-border bg-surface text-text',
              )}
            >
              {s === 'open' ? t.open : t.closed}
            </button>
          ))}
        </div>
      </PageTitle>
      <Notice message={message} />
      {!data ? (
        <Loading error={error} />
      ) : data.length === 0 ? (
        <Empty>{scope === 'open' ? t.empty : t.emptyClosed}</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((r) => (
            <li key={r.id}>
              <Card className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">
                      {r.practitioner ? `${r.practitioner.name} · ${r.practitioner.speciality}` : '—'}
                    </p>
                    {r.practitioner ? (
                      <p className="text-sm text-text-muted">{r.practitioner.organization}</p>
                    ) : null}
                    <p className="text-xs text-text-muted">
                      {dateTime(r.createdAt)} · {t.by(r.reporter ?? t.anonymous)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.status === 'IN_REVIEW' ? <Badge tone="warning">{t.inReview}</Badge> : null}
                    {r.practitioner && !r.practitioner.published ? (
                      <Badge tone="warning">{t.unpublished}</Badge>
                    ) : null}
                    {r.openOnProfile > 1 ? <Badge>{t.onProfile(r.openOnProfile)}</Badge> : null}
                  </div>
                </div>
                <p className="font-medium text-ink">{r.reasonLabel}</p>
                <p className="rounded-md bg-background-soft px-3 py-2 text-sm whitespace-pre-line text-text">
                  {r.details || t.noDetails}
                </p>
                {r.practitioner ? (
                  <a
                    href={r.practitioner.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline"
                  >
                    <ExternalLink aria-hidden="true" size={14} /> {t.viewProfile}
                  </a>
                ) : null}
                {r.status !== 'CLOSED' ? (
                  confirming === r.id ? (
                    <div
                      role="alertdialog"
                      aria-label={t.unpublish}
                      className="flex flex-col gap-2 rounded-md bg-danger-soft p-3"
                    >
                      <p className="text-sm text-ink">{t.unpublishConfirm}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy === r.id}
                          onClick={() => decide(r.id, 'UNPUBLISH')}
                        >
                          {t.confirm}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setConfirming(null)}>
                          {t.cancel}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy === r.id}
                        onClick={() => decide(r.id, 'DISMISS')}
                      >
                        {t.dismiss}
                      </Button>
                      {r.status === 'OPEN' ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={busy === r.id}
                          onClick={() => decide(r.id, 'CONTACT')}
                        >
                          {t.contact}
                        </Button>
                      ) : null}
                      {r.practitioner?.published ? (
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy === r.id}
                          onClick={() => setConfirming(r.id)}
                        >
                          {t.unpublish}
                        </Button>
                      ) : null}
                    </div>
                  )
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
