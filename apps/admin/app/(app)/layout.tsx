import { redirect } from 'next/navigation';
import { Logo } from '@twabibu/ui';
import { AdminNav } from '@/components/AdminNav';
import { adminMe } from '@/lib/server';

export const dynamic = 'force-dynamic';

const ROLE: Record<string, string> = { SUPERADMIN: 'Super administrateur', VERIFIER: 'Vérification', SUPPORT: 'Support', FINANCE: 'Finance' };

/** Back-office shell: dark navy bar (never mistaken for the public site), navigation by role. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await adminMe();
  if (!me || !me.mfa.verified) redirect('/connexion');
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 bg-navy">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <Logo tone="white" height={32} />
            <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold whitespace-nowrap text-white">Back-office</span>
          </div>
          <p className="min-w-0 text-right text-sm leading-tight text-white">
            <span className="block max-w-[40vw] truncate font-medium sm:max-w-none">{me.email}</span>
            <span className="block text-xs text-white/80">{me.roles.map((r) => ROLE[r] ?? r).join(', ')}</span>
          </p>
        </div>
      </header>
      <div className="flex flex-1 flex-col lg:flex-row">
        <AdminNav areas={me.areas} />
        <main id="contenu" className="min-w-0 flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
