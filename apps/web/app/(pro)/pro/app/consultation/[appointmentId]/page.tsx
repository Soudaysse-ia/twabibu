import type { Metadata } from 'next';
import { ConsultationView } from '@/components/pro/ConsultationView';

export const metadata: Metadata = { title: 'Consultation' };

export default async function ConsultationPage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = await params;
  return <ConsultationView appointmentId={appointmentId} />;
}
