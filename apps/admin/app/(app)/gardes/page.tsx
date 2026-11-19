import type { Metadata } from 'next';
import { DutyCalendar } from '@/components/PharmacyAdmin';

export const metadata: Metadata = { title: 'Gardes' };

export default function Page() {
  return <DutyCalendar />;
}
