import Link from 'next/link';
import { Clock, ShieldAlert } from 'lucide-react';
import type { ProMembership } from '@/lib/pro-types';

/**
 * SPEC-07 §4: while the practitioner's file is being checked, they can set everything up but patients do not see them.
 * Shown on every Pro page, with the first two things worth doing in the meantime.
 */
export function VerificationBanner({ status }: { status: ProMembership['verificationStatus'] }) {
  if (!status || status === 'VERIFIED') return null;
  if (status === 'CHANGES_REQUESTED' || status === 'REJECTED') {
    return (
      <div
        role="status"
        className="flex gap-3 border-b border-border bg-danger-soft px-4 py-3 text-sm text-ink"
      >
        <ShieldAlert aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-danger" />
        <p>
          {status === 'CHANGES_REQUESTED'
            ? 'L’équipe Twabibu a besoin d’un complément pour valider votre dossier : le message vous a été envoyé par e-mail. Votre profil n’est pas encore visible des patients.'
            : 'Votre dossier n’a pas été validé : votre profil n’est pas visible des patients. Le motif vous a été envoyé par e-mail.'}
        </p>
      </div>
    );
  }
  return (
    <div
      role="status"
      className="flex gap-3 border-b border-border bg-warning-soft px-4 py-3 text-sm text-ink"
    >
      <Clock aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-warning" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">
          Votre profil sera publié après la vérification de votre dossier (sous 48 h ouvrées).
        </p>
        <p>
          En attendant, préparez votre agenda :{' '}
          <Link href="/pro/app/reglages#motifs" className="font-medium text-primary underline">
            vérifiez vos motifs
          </Link>{' '}
          puis{' '}
          <Link href="/pro/app/reglages#plages" className="font-medium text-primary underline">
            ouvrez vos plages en ligne
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
