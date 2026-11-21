'use client';

import { useId } from 'react';
import { fr } from '@twabibu/i18n';
import { rememberPractice } from '@/lib/pro-practice';

/** Shown only to accounts that belong to several practices: picks the one the Pro space works in. */
export function PracticeSwitcher({
  current,
  practices,
}: {
  current: string;
  practices: { organizationId: string; organizationName: string }[];
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {fr.proShell.practice}
      </label>
      <select
        id={id}
        value={current}
        onChange={(e) => {
          rememberPractice(e.target.value);
          // Full load: every page and the layout read the practice on the server.
          window.location.assign('/pro/app');
        }}
        className="h-11 max-w-[11rem] min-w-0 truncate rounded-md border border-border bg-surface px-2 text-base text-ink focus:border-primary focus:outline-2 focus:outline-primary/30 sm:max-w-xs sm:text-sm"
      >
        {practices.map((p) => (
          <option key={p.organizationId} value={p.organizationId}>
            {p.organizationName}
          </option>
        ))}
      </select>
    </div>
  );
}
