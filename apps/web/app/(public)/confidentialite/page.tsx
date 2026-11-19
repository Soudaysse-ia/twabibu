import type { Metadata } from 'next';
import { fr } from '@twabibu/i18n';
import { ComingSoon } from '@/components/ComingSoon';

export const metadata: Metadata = { title: fr.footer.privacy, robots: { index: false } };

export default function Page() {
  return <ComingSoon title={fr.footer.privacy} />;
}
