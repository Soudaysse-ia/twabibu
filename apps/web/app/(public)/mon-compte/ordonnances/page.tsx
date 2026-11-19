import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileText } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { Badge, Card, Container } from '@twabibu/ui';
import { formatDateLong } from '@twabibu/utils';
import { PrescriptionPharmacyPanel } from '@/components/pharmacy/PrescriptionPharmacyPanel';
import { apiGet } from '@/lib/api-server';

export const metadata: Metadata = { title: 'Mes ordonnances', robots: { index: false } };

interface Item {
  id: string;
  status: string;
  signedAt: string | null;
  expiresAt: string | null;
  prescriber: string;
  lines: { label: string; posologyText: string }[];
}

export default async function MyPrescriptionsPage() {
  const res = await apiGet<Item[]>('/v1/me/prescriptions');
  if (!res.ok && res.status === 401) redirect('/connexion?next=/mon-compte/ordonnances');
  const items = res.ok ? res.data : [];
  return (
    <Container className="flex flex-col gap-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">Mes ordonnances</h1>
        <div className="flex gap-4 text-sm font-medium">
          <Link href="/mon-compte/rendez-vous" className="text-primary hover:underline">
            Mes rendez-vous
          </Link>
          <Link href="/mon-compte/commandes" className="text-primary hover:underline">
            Mes commandes
          </Link>
          <Link href="/mon-compte/dossier" className="text-primary hover:underline">
            Partage de mon dossier
          </Link>
        </div>
      </div>
      {items.length === 0 ? (
        <Card className="text-text">Les ordonnances signées par vos soignants sur Twabibu apparaîtront ici, pour vous et vos proches.</Card>
      ) : (
        <ul className="grid items-start gap-3 md:grid-cols-2">
          {items.map((p) => {
            const expired = p.expiresAt ? new Date(p.expiresAt) < new Date() : false;
            const usable = !expired && ['SIGNED', 'SENT_TO_PHARMACY', 'PARTIALLY_DISPENSED'].includes(p.status);
            const label = expired && p.status !== 'DISPENSED' ? 'Expirée' : (fr.pharmacy.prescriptionStatus[p.status] ?? 'Valable');
            return (
              <li key={p.id}>
                <Card className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-ink first-letter:uppercase">{p.signedAt ? formatDateLong(new Date(p.signedAt)) : ''}</p>
                    <Badge tone={usable ? 'success' : p.status === 'DISPENSED' ? 'info' : 'warning'}>{label}</Badge>
                  </div>
                  <p className="text-sm text-text-muted">{p.prescriber}</p>
                  <ul className="text-sm text-text">
                    {p.lines.map((l, i) => (
                      <li key={i}>
                        {l.label} · <span className="text-text-muted">{l.posologyText}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={`/mon-compte/ordonnance/${p.id}`} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline">
                    <FileText aria-hidden="true" size={14} /> Voir et imprimer
                  </Link>
                  <PrescriptionPharmacyPanel prescriptionId={p.id} canSend={usable} />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
