import type { Metadata } from 'next';
import { DutyList } from '@/components/pharma/DutyList';

export const metadata: Metadata = { title: 'Gardes' };

export default function Page() {
  return <DutyList />;
}
