import type { Metadata } from 'next';
import { PatientsView } from '@/components/pro/PatientsView';

export const metadata: Metadata = { title: 'Patients' };

export default function PatientsPage() {
  return <PatientsView />;
}
