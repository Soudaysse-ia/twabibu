'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CalendarCheck, MapPin, Phone, Stethoscope, UserRound } from 'lucide-react';
import { Badge, Button, buttonClasses, Card } from '@twabibu/ui';
import { formatDateLong, formatPhone, formatTime } from '@twabibu/utils';
import { api, ApiError, errorMessage } from '@/lib/api-client';
import type { PatientAppointment } from '@/lib/types';

const STATUS: Record<PatientAppointment['status'], { label: string; tone: 'info' | 'success' | 'warning' }> = {
  CONFIRMED: { label: 'Confirmé', tone: 'success' },
  PENDING_VALIDATION: { label: 'En attente du cabinet', tone: 'warning' },
  ARRIVED: { label: 'Vous êtes arrivé', tone: 'info' },
  IN_CONSULTATION: { label: 'En consultation', tone: 'info' },
  DONE: { label: 'Terminé', tone: 'info' },
  NO_SHOW: { label: 'Non honoré', tone: 'warning' },
  CANCELLED_BY_PATIENT: { label: 'Annulé par vous', tone: 'warning' },
  CANCELLED_BY_PRACTICE: { label: 'Annulé par le cabinet', tone: 'warning' },
};

/** One appointment in "Mes rendez-vous", with an in-page confirmation before cancelling. */
export function AppointmentCard({ appointment: a }: { appointment: PatientAppointment }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = new Date(a.startsAt);
  const status = STATUS[a.status];
  const upcoming = start > new Date() && (a.status === 'CONFIRMED' || a.status === 'PENDING_VALIDATION');

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/me/appointments/${a.id}/cancel`, { method: 'POST' });
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'CANCELLATION_DEADLINE_PASSED' && a.practice.phone
          ? `Le délai d’annulation en ligne est dépassé. Appelez le cabinet au ${formatPhone(a.practice.phone)}.`
          : errorMessage(err),
      );
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex items-center gap-2 font-heading text-base font-bold text-navy">
          <CalendarCheck aria-hidden="true" size={18} className="text-primary" />
          <span className="first-letter:uppercase">
            {formatDateLong(start)} à {formatTime(start)}
          </span>
        </p>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <ul className="grid gap-1.5 text-sm text-text">
        <li className="flex gap-2">
          <Stethoscope aria-hidden="true" size={16} className="mt-1 shrink-0 text-text-muted" />
          <span>
            <Link href={a.practitioner.url} className="font-medium text-primary hover:underline">
              {a.practitioner.name}
            </Link>{' '}
            · {a.practitioner.speciality} · {a.motive}
          </span>
        </li>
        <li className="flex gap-2">
          <MapPin aria-hidden="true" size={16} className="mt-1 shrink-0 text-text-muted" />
          {a.practice.name}, {a.practice.addressLine}, {a.practice.locality}
        </li>
        <li className="flex gap-2">
          <UserRound aria-hidden="true" size={16} className="mt-1 shrink-0 text-text-muted" />
          Pour {a.forName}
        </li>
        {a.practice.phone ? (
          <li className="flex gap-2">
            <Phone aria-hidden="true" size={16} className="mt-1 shrink-0 text-text-muted" />
            {formatPhone(a.practice.phone)}
          </li>
        ) : null}
      </ul>
      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {upcoming ? (
        confirming ? (
          <div className="flex flex-col gap-3 rounded-md bg-background-soft p-4">
            <p className="text-sm text-ink">Annuler ce rendez-vous ? Le créneau sera proposé à d’autres patients.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" size="sm" onClick={cancel} disabled={busy}>
                {busy ? 'Annulation…' : 'Oui, annuler le rendez-vous'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
                Garder mon rendez-vous
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {a.cancellation.allowed ? (
              <>
                <Link href={`/mon-compte/rendez-vous/${a.id}/deplacer`} className={buttonClasses({ variant: 'primary', size: 'sm' })}>
                  Déplacer le rendez-vous
                </Link>
                <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
                  Annuler le rendez-vous
                </Button>
              </>
            ) : (
              <p className="text-sm text-text-muted">Le délai pour déplacer ou annuler en ligne est dépassé. Appelez le cabinet.</p>
            )}
          </div>
        )
      ) : (
        <Link href={`${a.practitioner.url}/reserver`} className={buttonClasses({ variant: 'ghost', size: 'sm' }) + ' self-start'}>
          Reprendre rendez-vous
        </Link>
      )}
    </Card>
  );
}
