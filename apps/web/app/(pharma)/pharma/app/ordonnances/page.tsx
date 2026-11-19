import type { Metadata } from 'next';
import { PrescriptionInbox } from '@/components/pharma/PrescriptionInbox';

export const metadata: Metadata = { title: 'Ordonnances' };

export default function Page() {
  return <PrescriptionInbox />;
}
