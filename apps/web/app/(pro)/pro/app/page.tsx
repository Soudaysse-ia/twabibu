import type { Metadata } from 'next';
import { ProDashboard } from '@/components/pro/ProDashboard';

export const metadata: Metadata = { title: { absolute: 'Accueil | Twabibu Pro' } };

export default function ProHome() {
  return <ProDashboard />;
}
