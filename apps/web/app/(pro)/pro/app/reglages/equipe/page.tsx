import type { Metadata } from 'next';
import { fr } from '@twabibu/i18n';
import { TeamPage } from '@/components/pro/TeamPage';

export const metadata: Metadata = { title: fr.team.title };

export default function Page() {
  return <TeamPage />;
}
