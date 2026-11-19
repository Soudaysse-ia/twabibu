import type { Metadata } from 'next';
import { PatientSearch } from '@/components/Support';

export const metadata: Metadata = { title: 'Patients' };

export default function Page() {
  return <PatientSearch />;
}
