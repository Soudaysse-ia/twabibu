import type { Metadata } from 'next';
import { Placements } from '@/components/PharmacyAdmin';

export const metadata: Metadata = { title: 'Partenaires' };

export default function Page() {
  return <Placements />;
}
