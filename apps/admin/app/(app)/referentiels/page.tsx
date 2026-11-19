import type { Metadata } from 'next';
import { Referentials } from '@/components/Referentials';

export const metadata: Metadata = { title: 'Référentiels' };

export default function Page() {
  return <Referentials />;
}
