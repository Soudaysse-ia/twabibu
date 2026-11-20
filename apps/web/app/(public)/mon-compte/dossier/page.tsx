import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, Container } from '@twabibu/ui';
import { formatDateLong, formatTime } from '@twabibu/utils';
import { RecordSharing, type SharingItem } from '@/components/account/RecordSharing';
import { apiGet } from '@/lib/api-server';

export const metadata: Metadata = { title: 'Partage de mon dossier', robots: { index: false } };

interface AccessRow {
  at: string;
  organization: string;
  section: string;
  reason: string | null;
}

const SECTION: Record<string, string> = {
  synthesis: 'Dossier médical',
  consultation: 'Une consultation',
  'prescription-pharmacy': 'Une ordonnance envoyée à la pharmacie',
};

/** The patient chooses which practices see the whole medical record, and sees who opened it (SPEC-13 §Carnet). */
export default async function RecordSharingPage() {
  const [consents, log] = await Promise.all([apiGet<SharingItem[]>('/v1/me/record/consents'), apiGet<AccessRow[]>('/v1/me/record/access-log')]);
  if (!consents.ok && (consents.status === 401 || consents.status === 403)) redirect('/connexion?next=/mon-compte/dossier');
  const items = consents.ok ? consents.data : [];
  const rows = log.ok ? log.data : [];
  return (
    <Container className="flex max-w-3xl flex-col gap-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">Partage de mon dossier</h1>
        <div className="flex flex-wrap gap-4 text-sm font-medium">
          <Link href="/mon-compte/rendez-vous" className="text-primary hover:underline">
            Mes rendez-vous
          </Link>
          <Link href="/mon-compte/ordonnances" className="text-primary hover:underline">
            Mes ordonnances
          </Link>
        </div>
      </div>

      <Card className="flex flex-col gap-2 text-sm text-text">
        <p>
          Chaque cabinet voit ce qu’il a lui-même noté dans votre dossier. Si vous l’autorisez, il voit aussi ce que vos autres soignants ont noté : antécédents, allergies, traitements, consultations et ordonnances. Il
          peut ainsi suivre votre santé sans repartir de zéro.
        </p>
        <p>Seuls les médecins et soignants du cabinet y ont accès, jamais le secrétariat. Vous pouvez retirer l’accès à tout moment, et chaque consultation de votre dossier est inscrite ci-dessous.</p>
      </Card>

      <section aria-labelledby="practices" className="flex flex-col gap-3">
        <h2 id="practices" className="text-lg font-bold">
          Mes cabinets
        </h2>
        {items.length === 0 ? (
          <Card className="text-sm text-text">Les cabinets où vous avez pris rendez-vous apparaîtront ici.</Card>
        ) : (
          <RecordSharing items={items} />
        )}
      </section>

      <section aria-labelledby="log" className="flex flex-col gap-3">
        <h2 id="log" className="text-lg font-bold">
          Qui a consulté mon dossier
        </h2>
        {rows.length === 0 ? (
          <Card className="text-sm text-text">Personne n’a encore ouvert votre dossier.</Card>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-border">
              {rows.map((r, i) => (
                <li key={i} className="flex flex-col gap-0.5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <span>
                    <span className="font-medium text-ink">{r.organization || 'Établissement inconnu'}</span>
                    <span className="text-text-muted"> · {SECTION[r.section] ?? 'Dossier médical'}</span>
                  </span>
                  <span className="shrink-0 text-text-muted first-letter:uppercase">
                    {formatDateLong(new Date(r.at))} à {formatTime(new Date(r.at))}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </Container>
  );
}
