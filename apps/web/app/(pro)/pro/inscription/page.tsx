import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, Logo } from '@twabibu/ui';
import { ProSignupForm, type LocalityOption, type SpecialityOption } from '@/components/pro/ProSignupForm';
import { apiGet } from '@/lib/api-server';
import type { ProMe } from '@/lib/pro-types';

export const metadata: Metadata = {
  title: 'Inscrire mon cabinet · Twabibu Pro',
  description:
    'Inscrivez votre cabinet sur Twabibu Pro : agenda en ligne, rappels, dossier patient et ordonnance numérique.',
};

/** SPEC-07 « Inscription soignant » (PRO-01). */
export default async function ProSignupPage() {
  const me = await apiGet<ProMe>('/v1/pro/me');
  if (me.ok && me.data.memberships.length) redirect('/pro/app');
  const [specialities, localities] = await Promise.all([
    apiGet<SpecialityOption[]>('/v1/directory/specialities'),
    apiGet<LocalityOption[]>('/v1/directory/localities'),
  ]);
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="bg-primary">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:h-16">
          <Link href="/pro" aria-label="Twabibu Pro, présentation">
            <Logo tone="white" height={38} />
          </Link>
          <Link
            href="/pro/connexion"
            className="inline-flex min-h-11 items-center text-sm font-medium text-white hover:underline"
          >
            Se connecter
          </Link>
        </div>
      </header>
      <main id="contenu" className="flex flex-1 items-start justify-center px-4 py-8 sm:py-10">
        <Card className="flex w-full max-w-2xl flex-col gap-4 p-5 sm:p-8">
          <p className="text-xs font-bold tracking-wide text-primary uppercase">Twabibu Pro</p>
          <ProSignupForm
            specialities={specialities.ok ? specialities.data.filter((s) => s.group !== 'PHARMACY') : []}
            localities={localities.ok ? localities.data : []}
          />
        </Card>
      </main>
    </div>
  );
}
