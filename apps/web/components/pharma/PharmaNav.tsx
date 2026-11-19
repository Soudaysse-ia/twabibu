'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarClock, ClipboardList, LayoutDashboard, Package, ShoppingBag, Store } from 'lucide-react';
import { cn } from '@twabibu/ui';

const ITEMS = [
  { href: '/pharma/app', label: 'Accueil', icon: LayoutDashboard, exact: true },
  { href: '/pharma/app/ordonnances', label: 'Ordonnances', icon: ClipboardList },
  { href: '/pharma/app/commandes', label: 'Commandes', icon: ShoppingBag },
  { href: '/pharma/app/catalogue', label: 'Catalogue', icon: Package },
  { href: '/pharma/app/gardes', label: 'Gardes', icon: CalendarClock },
  { href: '/pharma/app/profil', label: 'Profil', icon: Store },
];

/** Side navigation on desktop, bottom tabs on phones (6 tabs: icons with short labels). */
export function PharmaNav() {
  const path = usePathname();
  const active = (href: string, exact?: boolean) => (exact ? path === href : path.startsWith(href));
  return (
    <>
      <nav aria-label="Twabibu Pharma" className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border bg-surface p-3 lg:flex">
        {ITEMS.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            aria-current={active(href, exact) ? 'page' : undefined}
            className={cn('flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium', active(href, exact) ? 'bg-pharmacy-soft text-pharmacy' : 'text-text hover:bg-background-soft')}
          >
            <Icon aria-hidden="true" size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Twabibu Pharma" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {ITEMS.map(({ href, label, icon: Icon, exact }) => (
          <Link key={href} href={href} aria-current={active(href, exact) ? 'page' : undefined} className={cn('flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', active(href, exact) ? 'text-pharmacy' : 'text-text-muted')}>
            <Icon aria-hidden="true" size={20} />
            <span className="max-w-full truncate">{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
