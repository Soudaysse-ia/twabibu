import type { Metadata } from 'next';
import { PharmacyVerification } from '@/components/PharmacyAdmin';

export const metadata: Metadata = { title: 'Pharmacies' };

export default function Page() {
  return <PharmacyVerification />;
}
