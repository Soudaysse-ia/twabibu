import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CalendarPlus } from 'lucide-react';
import { buttonClasses, Card, Container } from '@twabibu/ui';
import { AppointmentCard } from '@/components/AppointmentCard';
import { LogoutButton } from '@/components/LogoutButton';
import { ReminderPreference } from '@/components/ReminderPreference';
import { apiGet } from '@/lib/api-server';
import type { Me, PatientAppointment } from '@/lib/types';

export const metadata: Metadata = { title: 'Mes rendez-vous', robots: { index: false } };

export default async function MyAppointmentsPage() {
  const me = await apiGet<Me>('/v1/me');
  if (!me.ok) redirect('/connexion?next=/mon-compte/rendez-vous');
  const [upcoming, past] = await Promise.all([
    apiGet<PatientAppointment[]>('/v1/me/appointments?scope=upcoming'),
    apiGet<PatientAppointment[]>('/v1/me/appointments?scope=past'),
  ]);
  const profile = me.data.profile;

  return (
    <Container className="flex flex-col gap-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mes rendez-vous</h1>
          <p className="text-sm text-text-muted">
            {profile ? `${profile.firstName} ${profile.lastName}` : ''}
            {me.data.email ? ` · ${me.data.email}` : ''}
            {me.data.relatives.length ? ` · ${me.data.relatives.length} proche${me.data.relatives.length > 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/mon-compte/ordonnances" className="text-sm font-medium text-primary hover:underline">
            Mes ordonnances
          </Link>
          <Link href="/mon-compte/commandes" className="text-sm font-medium text-primary hover:underline">
            Mes commandes
          </Link>
          <Link href="/mon-compte/dossier" className="text-sm font-medium text-primary hover:underline">
            Partage de mon dossier
          </Link>
          <LogoutButton />
        </div>
      </div>

      <section aria-labelledby="upcoming" className="flex flex-col gap-3">
        <h2 id="upcoming" className="text-lg font-bold">
          À venir
        </h2>
        {upcoming.ok && upcoming.data.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {upcoming.data.map((a) => (
              <li key={a.id}>
                <AppointmentCard appointment={a} />
              </li>
            ))}
          </ul>
        ) : (
          <Card className="flex flex-col items-start gap-3">
            <CalendarPlus aria-hidden="true" size={24} className="text-primary" />
            <p className="text-text">Vous n’avez aucun rendez-vous à venir.</p>
            <Link href="/" className={buttonClasses({ variant: 'primary', size: 'sm' })}>
              Prendre rendez-vous
            </Link>
          </Card>
        )}
      </section>

      {past.ok && past.data.length ? (
        <section aria-labelledby="past" className="flex flex-col gap-3">
          <h2 id="past" className="text-lg font-bold">
            Passés et annulés
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {past.data.map((a) => (
              <li key={a.id}>
                <AppointmentCard appointment={a} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {me.data.profile ? <ReminderPreference /> : null}
    </Container>
  );
}
