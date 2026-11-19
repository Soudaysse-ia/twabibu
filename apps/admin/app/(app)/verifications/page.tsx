import type { Metadata } from 'next';
import { VerificationQueue } from '@/components/Verifications';

export const metadata: Metadata = { title: 'Vérifications' };

export default function Page() {
  return <VerificationQueue />;
}
