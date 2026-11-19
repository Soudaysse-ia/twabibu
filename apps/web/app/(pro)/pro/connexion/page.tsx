import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, Logo } from '@twabibu/ui';
import { ProSignIn } from '@/components/pro/ProSignIn';
import { apiGet } from '@/lib/api-server';
import type { ProMe } from '@/lib/pro-types';
import { isDemo } from '@/lib/demo';

export const metadata: Metadata = { title: 'Connexion Twabibu Pro', robots: { index: false } };

export default async function ProSignInPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  const me = await apiGet<ProMe>('/v1/pro/me');
  if (me.ok && me.data.memberships.length) redirect('/pro/app');
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="bg-primary">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center px-4 sm:h-16">
          <Link href="/" aria-label="Twabibu, accueil">
            <Logo tone="white" height={38} />
          </Link>
        </div>
      </header>
      <main id="contenu" className="flex flex-1 items-start justify-center px-4 py-10">
        <Card className="flex w-full max-w-md flex-col gap-4 p-6 sm:p-8">
          <p className="text-xs font-bold tracking-wide text-primary uppercase">Twabibu Pro</p>
          {erreur === 'aucun-cabinet' || (me.ok && !me.data.memberships.length) ? (
            <p role="alert" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-ink">
              Ce compte n’est rattaché à aucun cabinet. Connectez-vous avec l’adresse professionnelle enregistrée par votre cabinet.
            </p>
          ) : null}
          <ProSignIn />
          {isDemo() ? (
            <p className="text-xs text-text-muted">
              Comptes de démonstration (code 000000) : amina.said@demo.twabibu.km (praticienne), secretariat@demo.twabibu.km, direction@demo.twabibu.km.
            </p>
          ) : null}
        </Card>
      </main>
    </div>
  );
}
