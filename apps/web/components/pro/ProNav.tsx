'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, LayoutDashboard, Settings2, Users } from 'lucide-react';
import { cn } from '@twabibu/ui';

const ITEMS = [
  { href: '/pro/app', label: 'Accueil', icon: LayoutDashboard, exact: true },
  { href: '/pro/app/agenda', label: 'Agenda', icon: CalendarDays, exact: false },
  { href: '/pro/app/patients', label: 'Patients', icon: Users, exact: false },
  { href: '/pro/app/reglages', label: 'Réglages', icon: Settings2, exact: false },
];

/** Side navigation on desktop, bottom tabs on phones. */
export function ProNav() {
  const path = usePathname();
  return (
    <>
      <nav aria-label="Espace soignant" className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border bg-surface p-3 lg:flex">
        {ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? path === href : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn('flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium', active ? 'bg-primary-soft text-primary' : 'text-text hover:bg-background-soft')}
            >
              <Icon aria-hidden="true" size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
      <nav aria-label="Espace soignant" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? path === href : path.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium', active ? 'text-primary' : 'text-text-muted')}>
              <Icon aria-hidden="true" size={20} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
