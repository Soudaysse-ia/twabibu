import type { Metadata } from 'next';
import { VerificationFile } from '@/components/Verifications';

export const metadata: Metadata = { title: 'Dossier de vérification' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VerificationFile id={id} />;
}
