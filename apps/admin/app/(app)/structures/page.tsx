import type { Metadata } from 'next';
import { StructureList } from '@/components/Structures';

export const metadata: Metadata = { title: 'Structures' };

export default function Page() {
  return <StructureList />;
}
