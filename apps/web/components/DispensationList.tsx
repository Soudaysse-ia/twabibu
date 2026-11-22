import { PackageCheck } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { formatDateLong } from '@twabibu/utils';

export interface Dispensation {
  dispensedAt: string;
  pharmacy: string;
  lines: { label: string; quantity: number; substitutedBy: string | null }[];
}

/**
 * What the pharmacy handed over for a prescription (SPEC-14, RX-05), for the patient and for the prescriber:
 * date, pharmacy, medicines and quantities, substitutions. Lines the pharmacy did not have are simply absent.
 */
export function DispensationList({ dispensations }: { dispensations: Dispensation[] }) {
  if (!dispensations.length) return null;
  return (
    <ul className="flex flex-col gap-2">
      {dispensations.map((d, i) => (
        <li key={i} className="flex gap-2 rounded-md bg-success-soft px-3 py-2 text-sm text-ink">
          <PackageCheck aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-success" />
          <div>
            <p className="font-medium">
              {fr.pharmacy.dispensedOn(formatDateLong(new Date(d.dispensedAt)), d.pharmacy)}
            </p>
            <ul>
              {d.lines.map((l, j) => (
                <li key={j}>
                  {l.quantity} × {l.label}
                  {l.substitutedBy ? (
                    <span className="text-text-muted"> ({fr.pharmacy.substitutedBy(l.substitutedBy)})</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );
}
