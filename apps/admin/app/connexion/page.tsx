import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Logo } from '@twabibu/ui';
import { AdminSignIn } from '@/components/AdminSignIn';
import { adminMe } from '@/lib/server';

export const metadata: Metadata = { title: 'Connexion' };
export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  const me = await adminMe();
  if (me?.mfa.verified) redirect('/');
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="bg-navy">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4">
          <Logo tone="white" height={34} />
          <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold text-white">Back-office</span>
        </div>
      </header>
      <main id="contenu" className="flex flex-1 items-start justify-center px-4 py-10">
        <Card className="flex w-full max-w-md flex-col gap-4 p-6 sm:p-8">
          <AdminSignIn initial={me ? (me.mfa.enrolled ? 'code' : 'setup') : 'email'} devCode={me?.devCode ?? process.env.NODE_ENV !== 'production'} />
          {process.env.NODE_ENV !== 'production' ? (
            <p className="text-xs text-text-muted">Comptes de démonstration : admin@demo.twabibu.km (tous les droits), verification@demo.twabibu.km, support@demo.twabibu.km. Codes en local : 000000.</p>
          ) : null}
        </Card>
      </main>
    </div>
  );
}
