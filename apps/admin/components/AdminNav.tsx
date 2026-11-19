'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BadgeCheck, Bell, BookOpen, Building2, CalendarClock, Flag, LayoutDashboard, LogOut, Megaphone, ScrollText, Store, Users } from 'lucide-react';
import { cn } from '@twabibu/ui';
import { api } from '@/lib/api';

const ITEMS = [
  { href: '/', label: 'Tableau de bord', icon: LayoutDashboard, area: 'dashboard' },
  { href: '/verifications', label: 'Vérifications', icon: BadgeCheck, area: 'verification' },
  { href: '/structures', label: 'Structures', icon: Building2, area: 'structures' },
  { href: '/pharmacies', label: 'Pharmacies', icon: Store, area: 'pharmacies' },
  { href: '/gardes', label: 'Gardes', icon: CalendarClock, area: 'pharmacies' },
  { href: '/partenaires', label: 'Partenaires', icon: Megaphone, area: 'placements' },
  { href: '/referentiels', label: 'Référentiels', icon: BookOpen, area: 'referentials' },
  { href: '/patients', label: 'Patients', icon: Users, area: 'patients' },
  { href: '/notifications', label: 'Notifications', icon: Bell, area: 'notifications' },
  { href: '/journal', label: 'Journal d’audit', icon: ScrollText, area: 'audit' },
  { href: '/options', label: 'Options', icon: Flag, area: 'flags' },
];

/** Only the areas the admin's roles open are listed (the API enforces them anyway). */
export function AdminNav({ areas }: { areas: string[] }) {
  const path = usePathname();
  const router = useRouter();
  const items = ITEMS.filter((i) => areas.includes(i.area));
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <nav aria-label="Back-office" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-surface p-2 lg:w-60 lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0 lg:p-3">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={active(href) ? 'page' : undefined}
          className={cn('flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium whitespace-nowrap', active(href) ? 'bg-primary-soft text-primary' : 'text-text hover:bg-background-soft')}
        >
          <Icon aria-hidden="true" size={18} />
          {label}
        </Link>
      ))}
      <button
        type="button"
        onClick={async () => {
          await api('/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
          router.replace('/connexion');
          router.refresh();
        }}
        className="flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium whitespace-nowrap text-text hover:bg-background-soft lg:mt-4"
      >
        <LogOut aria-hidden="true" size={18} /> Se déconnecter
      </button>
    </nav>
  );
}
