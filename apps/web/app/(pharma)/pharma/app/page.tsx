import type { Metadata } from 'next';
import { PharmaDashboard } from '@/components/pharma/PharmaDashboard';

export const metadata: Metadata = { title: { absolute: 'Accueil | Twabibu Pharma' } };

export default function Page() {
  return <PharmaDashboard />;
}
