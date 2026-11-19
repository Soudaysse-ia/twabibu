import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Container } from '@twabibu/ui';
import { BookingFunnel } from '@/components/BookingFunnel';
import { apiGet } from '@/lib/api-server';
import type { Me, Profile } from '@/lib/types';

export const metadata: Metadata = { title: 'Prendre rendez-vous', robots: { index: false } };

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ motif?: string; creneau?: string }>;
}) {
  const [{ slug }, { motif, creneau }] = await Promise.all([params, searchParams]);
  const [profile, me] = await Promise.all([apiGet<Profile>(`/v1/practitioners/${encodeURIComponent(slug)}`), apiGet<Me>('/v1/me')]);
  if (!profile.ok) notFound();
  return (
    <div className="bg-background">
      <Container className="flex flex-col gap-5 py-6 sm:py-8">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Prenez votre rendez-vous en ligne</h1>
          <p className="text-text">Renseignez les informations suivantes</p>
        </div>
        <BookingFunnel profile={profile.data} initialMe={me.ok ? me.data : null} initialMotiveId={motif} initialSlot={creneau} />
      </Container>
    </div>
  );
}
