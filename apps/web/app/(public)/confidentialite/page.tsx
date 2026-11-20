import type { Metadata } from 'next';
import { LEGAL_DOCUMENTS } from '@twabibu/i18n';
import { LegalPage } from '@/components/content/LegalPage';

const doc = LEGAL_DOCUMENTS['confidentialite'];

export const metadata: Metadata = { title: doc.title, description: doc.description };

export default function Page() {
  return <LegalPage doc={doc} />;
}
