import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Container } from '@twabibu/ui';
import { DeviceSessions } from '@/components/account/DeviceSessions';
import { ProfileForm, type LocalityOption, type PatientProfileView } from '@/components/account/ProfileForm';
import { LogoutButton } from '@/components/LogoutButton';
import { ReminderPreference } from '@/components/ReminderPreference';
import { apiGet } from '@/lib/api-server';

export const metadata: Metadata = { title: 'Mon profil', robots: { index: false } };

/** SPEC-04 « Mon profil » (ACCOUNT-03): identity, address, insurance, reminders and signed-in devices. */
export default async function MyProfilePage() {
  const [profile, localities] = await Promise.all([
    apiGet<PatientProfileView>('/v1/me/profile'),
    apiGet<LocalityOption[]>('/v1/directory/localities'),
  ]);
  if (!profile.ok) redirect('/connexion?next=/mon-compte/profil');
  return (
    <Container className="flex max-w-3xl flex-col gap-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mon profil</h1>
          <p className="text-sm text-text">
            Ces informations sont transmises au cabinet quand vous prenez rendez-vous.
          </p>
        </div>
        <div className="md:hidden">
          <LogoutButton />
        </div>
      </div>
      <ProfileForm initial={profile.data} localities={localities.ok ? localities.data : []} />
      <ReminderPreference />
      <DeviceSessions />
    </Container>
  );
}
