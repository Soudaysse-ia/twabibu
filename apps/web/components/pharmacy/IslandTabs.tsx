import Link from 'next/link';
import { fr } from '@twabibu/i18n';
import { cn } from '@twabibu/ui';
import type { IslandSlug } from '@/lib/pharmacy-types';

export const ISLANDS: IslandSlug[] = ['ngazidja', 'ndzuani', 'mwali'];
export const isIsland = (s: string | undefined): s is IslandSlug => !!s && (ISLANDS as string[]).includes(s);

/** Island switch as links (works without JavaScript, shareable URL). */
export function IslandTabs({ current, href }: { current: IslandSlug; href: (island: IslandSlug) => string }) {
  return (
    <nav aria-label="Île" className="flex gap-1 overflow-x-auto rounded-md bg-surface p-1 shadow-card">
      {ISLANDS.map((i) => (
        <Link
          key={i}
          href={href(i)}
          aria-current={i === current ? 'page' : undefined}
          className={cn('flex min-h-11 flex-1 flex-col items-center justify-center rounded-md px-3 py-1.5 text-center text-sm font-bold whitespace-nowrap', i === current ? 'bg-primary text-white' : 'text-navy hover:bg-primary-soft')}
        >
          {fr.pharmacy.islands[i]}
          <span className={cn('text-xs font-normal', i === current ? 'text-white/85' : 'text-text-muted')}>{fr.pharmacy.islandsFrench[i]}</span>
        </Link>
      ))}
    </nav>
  );
}
