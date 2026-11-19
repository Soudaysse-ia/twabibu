import type { Metadata } from 'next';
import { NotificationLog } from '@/components/Support';

export const metadata: Metadata = { title: 'Notifications' };

export default function Page() {
  return <NotificationLog />;
}
