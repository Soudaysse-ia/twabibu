import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { PrescriptionDocument } from '@/components/PrescriptionDocument';
import { PrintButton } from '@/components/PrintButton';
import { apiGet } from '@/lib/api-server';
import type { PrescriptionDoc } from '@/lib/medical-types';
import { currentMembership, PRO_PRACTICE_COOKIE } from '@/lib/pro-practice';
import type { ProMe } from '@/lib/pro-types';

export const metadata: Metadata = { title: 'Ordonnance', robots: { index: false } };

export default async function PracticePrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await apiGet<ProMe>('/v1/pro/me');
  if (!me.ok) redirect('/pro/connexion');
  const org = currentMembership(
    me.data.memberships,
    (await cookies()).get(PRO_PRACTICE_COOKIE)?.value,
  )?.organizationId;
  if (!org) redirect('/pro/connexion');
  const doc = await apiGet<PrescriptionDoc>(`/v1/pro/orgs/${org}/prescriptions/${encodeURIComponent(id)}`);
  if (!doc.ok) notFound();
  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-2 print:hidden">
        <Link href="/pro/app/agenda" className="text-sm font-bold text-navy hover:text-primary">
          ← Agenda
        </Link>
        <PrintButton />
      </div>
      <PrescriptionDocument doc={doc.data} />
    </div>
  );
}
