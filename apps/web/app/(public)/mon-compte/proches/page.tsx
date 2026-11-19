import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container } from '@twabibu/ui';
import { RelativesManager } from '@/components/account/RelativesManager';
import { apiGet } from '@/lib/api-server';
import type { Me } from '@/lib/types';

export const metadata: Metadata = { title: 'Mes proches', robots: { index: false } };

/** SPEC-04 « Mes proches » (ACCOUNT-02): list, add, edit and remove the people the patient books for. */
export default async function MyRelativesPage() {
  const me = await apiGet<Me>('/v1/me');
  if (!me.ok) redirect('/connexion?next=/mon-compte/proches');
  return (
    <Container className="flex max-w-4xl flex-col gap-5 py-8">
      <div>
        <h1 className="text-2xl font-bold">Mes proches</h1>
        <p className="text-sm text-text">
          Prenez rendez-vous pour vos proches depuis votre compte : ils n’ont pas besoin d’un compte à eux.
        </p>
      </div>
      <RelativesManager initial={me.data.relatives} />
    </Container>
  );
}
