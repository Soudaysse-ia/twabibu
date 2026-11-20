import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, Logo } from '@twabibu/ui';
import { PharmaSignIn } from '@/components/pharma/PharmaSignIn';
import { apiGet } from '@/lib/api-server';
import type { PharmaMe } from '@/lib/pharma-types';
import { isDemo } from '@/lib/demo';

export const metadata: Metadata = { title: 'Connexion Twabibu Pharma', robots: { index: false } };

export default async function PharmaSignInPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  const me = await apiGet<PharmaMe>('/v1/pharma/me');
  if (me.ok && me.data.memberships.length) redirect('/pharma/app');
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
          <p className="text-xs font-bold tracking-wide text-pharmacy uppercase">Twabibu Pharma</p>
          {erreur === 'aucune-pharmacie' || (me.ok && !me.data.memberships.length) ? (
            <p role="alert" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-ink">
              Ce compte n’est rattaché à aucune pharmacie. Connectez-vous avec l’adresse enregistrée pour votre officine.
            </p>
          ) : null}
          <PharmaSignIn />
          {isDemo() ? (
            <p className="text-xs text-text-muted">
              Comptes de démonstration (code 000000) : titulaire.port@demo.twabibu.km (titulaire), preparateur.port@demo.twabibu.km (préparateur), titulaire.medina@demo.twabibu.km.
            </p>
          ) : null}
        </Card>
      </main>
    </div>
  );
}
