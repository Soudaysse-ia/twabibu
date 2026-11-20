'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { cn, Container } from '@twabibu/ui';
import { LogoutButton } from '@/components/LogoutButton';

const ITEMS = [
  ['/mon-compte/rendez-vous', 'Mes rendez-vous'],
  ['/mon-compte/proches', 'Mes proches'],
  ['/mon-compte/soignants', 'Mes soignants'],
  ['/mon-compte/ordonnances', 'Mes ordonnances'],
  ['/mon-compte/commandes', 'Mes commandes'],
  ['/mon-compte/dossier', 'Partage du dossier'],
  ['/mon-compte/profil', 'Mon profil'],
] as const;

/** Tabs shared by every « Mon compte » page (SPEC-04): one scrolling row on phones, wrapped on larger screens. */
export function AccountNav() {
  const path = usePathname();
  const nav = useRef<HTMLElement>(null);
  // On phones the tabs scroll sideways: bring the current one into view without moving the page.
  useEffect(() => {
    const el = nav.current;
    const current = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && current) el.scrollLeft = current.offsetLeft - (el.clientWidth - current.offsetWidth) / 2;
  }, [path]);
  return (
    <div className="border-b border-border bg-surface">
      <Container className="flex items-center gap-3">
        <nav ref={nav} aria-label="Mon compte" className="relative -mb-px flex flex-1 gap-1 overflow-x-auto">
          {ITEMS.map(([href, label]) => {
            const current = path === href || path.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 shrink-0 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-primary',
                  current ? 'border-primary text-primary' : 'border-transparent text-text hover:text-primary',
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden shrink-0 md:block">
          <LogoutButton />
        </div>
      </Container>
    </div>
  );
}
