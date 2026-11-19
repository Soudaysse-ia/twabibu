import type { Metadata } from 'next';
import { AuditLog } from '@/components/Governance';

export const metadata: Metadata = { title: 'Journal d’audit' };

export default function Page() {
  return <AuditLog />;
}
