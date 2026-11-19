import type { Metadata } from 'next';
import { PatientFileView } from '@/components/pro/PatientFileView';

export const metadata: Metadata = { title: 'Dossier patient' };

export default async function PatientFilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PatientFileView recordId={id} />;
}
