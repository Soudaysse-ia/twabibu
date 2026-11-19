import type { Metadata } from 'next';
import { PatientSupport } from '@/components/Support';

export const metadata: Metadata = { title: 'Patient' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PatientSupport id={id} />;
}
