import type { Metadata } from 'next';
import { CatalogueEditor } from '@/components/pharma/CatalogueEditor';

export const metadata: Metadata = { title: 'Catalogue' };

export default function Page() {
  return <CatalogueEditor />;
}
