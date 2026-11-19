import type { Metadata } from 'next';
import { ProfileEditor } from '@/components/pharma/ProfileEditor';

export const metadata: Metadata = { title: 'Profil' };

export default function Page() {
  return <ProfileEditor />;
}
