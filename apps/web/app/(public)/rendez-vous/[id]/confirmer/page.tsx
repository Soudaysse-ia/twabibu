import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarClock, MapPin, Stethoscope } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { buttonClasses, Card, Container } from '@twabibu/ui';
import { formatDateLong, formatTime } from '@twabibu/utils';
import { ConfirmPresence } from '@/components/ConfirmPresence';
import { apiGet } from '@/lib/api-server';

const t = fr.reminders;
// The link carries a token: never indexed, never sent as a referrer.
export const metadata: Metadata = { title: t.confirmTitle, robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';

interface Presence {
  startsAt: string;
  practitioner: string;
  address: string;
  status: string;
  confirmedAt: string | null;
  canConfirm: boolean;
}

/** Landing page of the « Je confirme ma présence » link of the reminder e-mail. */
export default async function ConfirmPresencePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t: token = '' } = await searchParams;
  const valid = /^[0-9a-f-]{36}$/i.test(id) && /^[A-Za-z0-9_-]{22}$/.test(token);
  const res = valid ? await apiGet<Presence>(`/v1/appointments/${id}/presence?t=${encodeURIComponent(token)}`) : null;
  const p = res?.ok ? res.data : null;
  const start = p ? new Date(p.startsAt) : null;

  return (
    <Container className="flex justify-center py-10">
      <Card className="flex w-full max-w-lg flex-col gap-4 p-6 sm:p-8">
        <h1 className="text-xl font-bold">{t.confirmTitle}</h1>
        {!p || !start ? (
          <p className="text-text">{t.invalidLink}</p>
        ) : (
          <>
            <p className="text-text">{t.confirmIntro}</p>
            <ul className="flex flex-col gap-2 text-sm text-ink">
              <li className="flex gap-2">
                <CalendarClock aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-primary" />
                <span className="first-letter:uppercase">
                  {formatDateLong(start)} à {formatTime(start)}
                </span>
              </li>
              <li className="flex gap-2">
                <Stethoscope aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-primary" /> {p.practitioner}
              </li>
              <li className="flex gap-2">
                <MapPin aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-primary" /> {p.address}
              </li>
            </ul>
            {p.canConfirm || p.confirmedAt ? (
              <ConfirmPresence appointmentId={id} token={token} alreadyConfirmed={!!p.confirmedAt} />
            ) : (
              <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-ink">{t.cannotConfirm}</p>
            )}
            <p className="text-sm text-text-muted">{t.cancelHint}</p>
          </>
        )}
        <Link href="/mon-compte/rendez-vous" className={buttonClasses({ variant: 'secondary' })}>
          {t.manage}
        </Link>
      </Card>
    </Container>
  );
}
