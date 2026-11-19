import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PrescriptionDocument } from '@/components/PrescriptionDocument';
import { PrintButton } from '@/components/PrintButton';
import { apiGet } from '@/lib/api-server';
import type { PrescriptionDoc } from '@/lib/medical-types';

export const metadata: Metadata = { title: 'Mon ordonnance', robots: { index: false } };

export default async function PatientPrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await apiGet<PrescriptionDoc>(`/v1/me/prescriptions/${encodeURIComponent(id)}`);
  if (!doc.ok && doc.status === 401) redirect(`/connexion?next=/mon-compte/ordonnance/${id}`);
  if (!doc.ok) notFound();
  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-2 print:hidden">
        <Link href="/mon-compte/ordonnances" className="text-sm font-bold text-navy hover:text-primary">
          ← Mes ordonnances
        </Link>
        <PrintButton />
      </div>
      <PrescriptionDocument doc={doc.data} />
    </div>
  );
}
