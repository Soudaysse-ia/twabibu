'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { Card, cn } from '@twabibu/ui';
import { api } from '@/lib/api-client';
import { useMembership } from './ProContext';

const t = fr.setup;

interface Step {
  key: string;
  done: boolean;
  waiting?: boolean;
  href: string;
}

/**
 * « Votre cabinet est prêt à X % » (PRO-02) on the Pro home: what is left to set up, each with a link to its setting.
 * Hidden once everything is done, and for the secretary, who sets nothing up here.
 */
export function SetupChecklist() {
  const m = useMembership();
  const [data, setData] = useState<{ percent: number | null; steps: Step[] } | null>(null);
  useEffect(() => {
    // A failure only hides the card: the rest of the home page still works.
    api<{ percent: number | null; steps: Step[] }>(`/v1/pro/orgs/${m.organizationId}/setup`)
      .then(setData)
      .catch(() => setData(null));
  }, [m.organizationId]);

  if (!data || data.percent === null || data.percent === 100) return null;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-bold">{t.title(data.percent)}</h2>
        <p className="text-sm text-text-muted">{t.intro}</p>
        <div
          role="progressbar"
          aria-label={t.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={data.percent}
          className="h-2 overflow-hidden rounded-full bg-primary-soft"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${data.percent}%` }} />
        </div>
      </div>
      <ol className="flex flex-col">
        {data.steps.map((s) => {
          const Icon = s.done ? CheckCircle2 : s.waiting ? Clock : Circle;
          const state = s.done ? t.done : s.waiting ? t.waiting : t.todo;
          return (
            <li key={s.key} className="flex items-start gap-3 border-b border-border py-3 last:border-b-0">
              <Icon
                aria-hidden="true"
                size={20}
                className={cn(
                  'mt-0.5 shrink-0',
                  s.done ? 'text-success' : s.waiting ? 'text-warning' : 'text-text-muted',
                )}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className={cn('text-sm font-medium', s.done ? 'text-text-muted' : 'text-ink')}>
                  {t.steps[s.key]}
                  <span className="sr-only"> : {state}</span>
                </p>
                {s.done ? null : <p className="text-sm text-text-muted">{t.hints[s.key]}</p>}
              </div>
              {s.done ? null : (
                <Link
                  href={s.href}
                  className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-primary hover:underline"
                  aria-label={`${s.waiting ? t.learn : t.open} : ${t.steps[s.key]}`}
                >
                  {s.waiting ? t.learn : t.open}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
