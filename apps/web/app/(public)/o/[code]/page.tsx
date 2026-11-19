import type { Metadata } from 'next';
import { BadgeCheck, CircleX } from 'lucide-react';
import { Card, Container } from '@twabibu/ui';
import { formatDateLong } from '@twabibu/utils';
import { apiGet } from '@/lib/api-server';

export const metadata: Metadata = { title: 'Vérification d’ordonnance', robots: { index: false } };

interface Verification {
  code: string;
  valid: boolean;
  status: string;
  signedAt: string | null;
  expiresAt: string | null;
  prescriber: { name: string; speciality: string; organization: string; verified: boolean };
  lastDispensedAt: string | null;
}

const STATUS: Record<string, string> = {
  SIGNED: 'Signée, pas encore délivrée',
  SENT_TO_PHARMACY: 'Envoyée à une pharmacie',
  PARTIALLY_DISPENSED: 'Délivrée en partie',
  DISPENSED: 'Délivrée',
  EXPIRED: 'Expirée',
  CANCELLED: 'Annulée par le prescripteur',
};

/** Public page behind the QR code: authenticity and status only, never the medicines or the patient (SPEC-14). */
export default async function VerifyPrescriptionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const res = /^[A-Z2-9]{10}$/.test(code) ? await apiGet<Verification>(`/v1/o/${code}`) : ({ ok: false, status: 404 } as const);
  return (
    <Container className="flex justify-center py-10">
      <Card className="flex w-full max-w-lg flex-col gap-4 p-6 sm:p-8">
        <p className="text-xs font-bold tracking-wide text-primary uppercase">Vérification d’ordonnance</p>
        {res.ok ? (
          <>
            <div className={res.data.valid ? 'flex items-center gap-3 text-success' : 'flex items-center gap-3 text-danger'}>
              {res.data.valid ? <BadgeCheck aria-hidden="true" size={32} /> : <CircleX aria-hidden="true" size={32} />}
              <h1 className="text-xl font-bold text-inherit">{res.data.valid ? 'Ordonnance authentique et valide' : 'Ordonnance non valide'}</h1>
            </div>
            <dl className="grid gap-2 text-sm">
              <div>
                <dt className="text-text-muted">Prescripteur</dt>
                <dd className="font-medium text-ink">
                  {res.data.prescriber.name}, {res.data.prescriber.speciality} · {res.data.prescriber.organization}
                  {res.data.prescriber.verified ? ' · profil vérifié par Twabibu' : ''}
                </dd>
              </div>
              {res.data.signedAt ? (
                <div>
                  <dt className="text-text-muted">Signée le</dt>
                  <dd className="text-ink">{formatDateLong(new Date(res.data.signedAt))}</dd>
                </div>
              ) : null}
              {res.data.expiresAt ? (
                <div>
                  <dt className="text-text-muted">Valable jusqu’au</dt>
                  <dd className="text-ink">{formatDateLong(new Date(res.data.expiresAt))}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-text-muted">État</dt>
                <dd className="text-ink">{STATUS[res.data.status] ?? res.data.status}</dd>
              </div>
            </dl>
            <p className="text-xs text-text-muted">Pour protéger le patient, cette page n’affiche ni son nom ni les médicaments. Le pharmacien les lit sur l’ordonnance présentée.</p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 text-danger">
              <CircleX aria-hidden="true" size={32} />
              <h1 className="text-xl font-bold text-inherit">Code inconnu</h1>
            </div>
            <p className="text-text">Aucune ordonnance Twabibu ne correspond au code {code}. Vérifiez la saisie ou contactez le prescripteur.</p>
          </>
        )}
      </Card>
    </Container>
  );
}
