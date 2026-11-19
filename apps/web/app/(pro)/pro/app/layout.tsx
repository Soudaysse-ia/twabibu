import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@twabibu/ui';
import { ProProvider } from '@/components/pro/ProContext';
import { ProLogout } from '@/components/pro/ProLogout';
import { ProNav } from '@/components/pro/ProNav';
import { apiGet } from '@/lib/api-server';
import type { ProMe } from '@/lib/pro-types';

export const metadata: Metadata = { title: { default: 'Twabibu Pro', template: '%s | Twabibu Pro' }, robots: { index: false } };

const ROLE: Record<string, string> = { OWNER: 'Responsable', ADMIN: 'Administrateur', PRACTITIONER: 'Praticien', SECRETARY: 'Secrétariat' };

/** Twabibu Pro shell: light top bar, side navigation, practice context for every page. */
export default async function ProLayout({ children }: { children: React.ReactNode }) {
  const me = await apiGet<ProMe>('/v1/pro/me');
  if (!me.ok) redirect('/pro/connexion');
  const membership = me.data.memberships[0];
  if (!membership) redirect('/pro/connexion?erreur=aucun-cabinet');

  return (
    <ProProvider membership={membership}>
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-surface">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/pro/app" aria-label="Twabibu Pro, accueil">
                <Logo tone="blue" height={34} />
              </Link>
              <span className="hidden rounded-md bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary sm:inline">Pro</span>
              <span className="hidden truncate text-sm text-text-muted md:inline">{membership.organizationName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="truncate text-right text-sm leading-tight">
                <span className="block font-medium text-ink">{membership.displayName}</span>
                <span className="block text-xs text-text-muted">{ROLE[membership.role]}</span>
              </span>
              <ProLogout />
            </div>
          </div>
        </header>
        <div className="flex flex-1">
          <ProNav />
          <main id="contenu" className="min-w-0 flex-1 pb-20 lg:pb-0">
            {children}
          </main>
        </div>
      </div>
    </ProProvider>
  );
}
