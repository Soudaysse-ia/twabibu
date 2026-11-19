import Link from 'next/link';
import { CircleHelp, UserRound } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { Container, Logo } from '@twabibu/ui';
import { apiGet } from '@/lib/api-server';
import type { Me } from '@/lib/types';

/** Blue 64 px header (56 px on phones), as on Doctolib. Shows the patient's first name once signed in. */
export async function SiteHeader() {
  const me = await apiGet<Me>('/v1/me');
  const firstName = me.ok ? me.data.profile?.firstName : null;
  return (
    <header className="sticky top-0 z-40 bg-primary shadow-header">
      <Container className="flex h-14 items-center justify-between gap-3 sm:h-16">
        <Link href="/" aria-label="Twabibu, accueil" className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <Logo tone="white" height={40} className="max-sm:!h-8" />
        </Link>
        <nav aria-label="Navigation principale" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/pro"
            className="hidden rounded-md bg-surface px-3 py-1.5 text-sm font-bold text-primary transition-colors hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:inline-flex"
          >
            {fr.header.proLink}
          </Link>
          <Link
            href="/aide"
            className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white sm:inline-flex"
          >
            <CircleHelp aria-hidden="true" size={16} />
            {fr.header.help}
          </Link>
          <Link
            href={me.ok ? '/mon-compte/rendez-vous' : '/connexion'}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
          >
            <UserRound aria-hidden="true" size={16} />
            {me.ok ? (firstName ?? 'Mon compte') : fr.header.signIn}
          </Link>
        </nav>
      </Container>
    </header>
  );
}
