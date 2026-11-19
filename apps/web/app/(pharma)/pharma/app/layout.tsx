import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Logo } from '@twabibu/ui';
import { PharmaProvider } from '@/components/pharma/PharmaContext';
import { PharmaNav } from '@/components/pharma/PharmaNav';
import { ProLogout } from '@/components/pro/ProLogout';
import { apiGet } from '@/lib/api-server';
import type { PharmaMe } from '@/lib/pharma-types';

export const metadata: Metadata = { title: { default: 'Twabibu Pharma', template: '%s | Twabibu Pharma' }, robots: { index: false } };

const ROLE: Record<string, string> = { OWNER: 'Titulaire', ADMIN: 'Administrateur', PHARMACIST: 'Pharmacien', PHARMACY_STAFF: 'Préparateur' };

/** Twabibu Pharma shell (SPEC-15 §6): same light structure as Twabibu Pro, pharmacy green accents. */
export default async function PharmaLayout({ children }: { children: React.ReactNode }) {
  const me = await apiGet<PharmaMe>('/v1/pharma/me');
  if (!me.ok) redirect('/pharma/connexion');
  const membership = me.data.memberships[0];
  if (!membership) redirect('/pharma/connexion?erreur=aucune-pharmacie');
  return (
    <PharmaProvider membership={membership}>
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-surface">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/pharma/app" aria-label="Twabibu Pharma, accueil">
                <Logo tone="blue" height={34} />
              </Link>
              <span className="hidden rounded-md bg-pharmacy-soft px-2 py-0.5 text-xs font-bold text-pharmacy sm:inline">Pharma</span>
              <span className="hidden truncate text-sm text-text-muted md:inline">{membership.organizationName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="truncate text-right text-sm leading-tight">
                <span className="block max-w-[40vw] truncate font-medium text-ink md:hidden">{membership.organizationName}</span>
                <span className="block text-xs text-text-muted">{ROLE[membership.role]}</span>
              </span>
              <ProLogout to="/pharma/connexion" />
            </div>
          </div>
        </header>
        <div className="flex flex-1">
          <PharmaNav />
          <main id="contenu" className="min-w-0 flex-1 pb-20 lg:pb-0">
            {children}
          </main>
        </div>
      </div>
    </PharmaProvider>
  );
}
