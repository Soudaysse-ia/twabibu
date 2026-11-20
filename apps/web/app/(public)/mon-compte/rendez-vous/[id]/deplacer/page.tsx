import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Container } from '@twabibu/ui';
import { RescheduleView } from '@/components/RescheduleView';
import { apiGet } from '@/lib/api-server';
import type { PatientAppointment } from '@/lib/types';

export const metadata: Metadata = { title: 'Déplacer mon rendez-vous', robots: { index: false } };

/** The patient picks another slot with the same practitioner and motive (SPEC-03, BOOK-08). */
export default async function ReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await apiGet<PatientAppointment[]>('/v1/me/appointments?scope=upcoming');
  if (!res.ok && (res.status === 401 || res.status === 403)) redirect(`/connexion?next=/mon-compte/rendez-vous/${id}/deplacer`);
  const appointment = res.ok ? res.data.find((a) => a.id === id) : undefined;
  if (!appointment) notFound();
  return (
    <Container className="flex max-w-3xl flex-col gap-5 py-8">
      <Link href="/mon-compte/rendez-vous" className="self-start text-sm font-medium text-primary hover:underline">
        ← Mes rendez-vous
      </Link>
      <h1 className="text-2xl font-bold">Déplacer mon rendez-vous</h1>
      <RescheduleView appointment={appointment} />
    </Container>
  );
}
