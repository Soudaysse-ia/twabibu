import type { Metadata } from 'next';
import { FeatureFlags } from '@/components/Governance';

export const metadata: Metadata = { title: 'Options' };

export default function Page() {
  return <FeatureFlags />;
}
