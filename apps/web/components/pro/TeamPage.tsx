'use client';

import Link from 'next/link';
import { fr } from '@twabibu/i18n';
import { useMembership } from './ProContext';
import { TeamSettings } from './TeamSettings';

/** /pro/app/reglages/equipe: the team is managed by the owner and administrators only (SPEC-07). */
export function TeamPage() {
  const m = useMembership();
  const manager = m.role === 'OWNER' || m.role === 'ADMIN';
  return (
    <div className="flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <Link
        href="/pro/app/reglages"
        className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline"
      >
        {fr.team.back}
      </Link>
      <div>
        <h1 className="text-xl font-bold">{fr.team.title}</h1>
        <p className="text-sm text-text-muted">{fr.team.intro}</p>
      </div>
      {manager ? (
        <TeamSettings />
      ) : (
        <p className="rounded-md bg-warning-soft p-3 text-sm text-ink">{fr.errors.FORBIDDEN}</p>
      )}
    </div>
  );
}
