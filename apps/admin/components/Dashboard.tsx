'use client';

import Link from 'next/link';
import { Card } from '@twabibu/ui';
import { formatKmf } from '@twabibu/utils';
import { Loading, PageTitle } from './Page';
import { useApi } from './useApi';

interface Data {
  practitioners: { verified: number; pending: number; rejected: number };
  pharmacies: { verified: number; pending: number };
  appointments: { today: number; last7Days: number; last30Days: number; onlineShare: number };
  notifications: { emails30Days: number; sms30Days: number; failed30Days: number; smsCostKmf: number };
  newPatients7Days: number;
  openReports: number;
  orders7Days: number;
}

export function Dashboard() {
  const { data: d, error } = useApi<Data>('/v1/admin/dashboard');
  if (!d) return <Loading error={error} />;
  const tiles: { label: string; value: string; hint?: string; href?: string; alert?: boolean }[] = [
    { label: 'Soignants à vérifier', value: String(d.practitioners.pending), hint: `${d.practitioners.verified} vérifiés`, href: '/verifications', alert: d.practitioners.pending > 0 },
    { label: 'Pharmacies à vérifier', value: String(d.pharmacies.pending), hint: `${d.pharmacies.verified} vérifiées`, href: '/pharmacies', alert: d.pharmacies.pending > 0 },
    { label: 'Rendez-vous aujourd’hui', value: String(d.appointments.today) },
    { label: 'Rendez-vous pris (7 j / 30 j)', value: `${d.appointments.last7Days} / ${d.appointments.last30Days}`, hint: `${d.appointments.onlineShare} % en ligne sur 30 j` },
    { label: 'Nouveaux patients (7 j)', value: String(d.newPatients7Days) },
    { label: 'Commandes pharmacie (7 j)', value: String(d.orders7Days) },
    { label: 'E-mails envoyés (30 j)', value: String(d.notifications.emails30Days), hint: `${d.notifications.sms30Days} SMS · coût SMS estimé ${formatKmf(d.notifications.smsCostKmf)}`, href: '/notifications' },
    { label: 'Échecs d’envoi (30 j)', value: String(d.notifications.failed30Days), href: '/notifications', alert: d.notifications.failed30Days > 0 },
    { label: 'Signalements ouverts', value: String(d.openReports), alert: d.openReports > 0 },
  ];
  return (
    <>
      <PageTitle title="Tableau de bord" />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => {
          const body = (
            <Card className="flex h-full flex-col gap-1">
              <p className="text-sm text-text">{t.label}</p>
              <p className="flex items-center gap-2 text-2xl font-bold text-ink">
                {t.value}
                {t.alert ? <span className="size-2.5 rounded-full bg-danger" aria-label="À traiter" /> : null}
              </p>
              {t.hint ? <p className="text-xs text-text-muted">{t.hint}</p> : null}
            </Card>
          );
          return (
            <li key={t.label}>
              {t.href ? (
                <Link href={t.href} className="block h-full rounded-md hover:shadow-card focus-visible:outline-2 focus-visible:outline-primary">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
