import type { Metadata } from 'next';
import Link from 'next/link';
import { fr } from '@twabibu/i18n';
import { PracticeSettings } from '@/components/pro/PracticeSettings';

export const metadata: Metadata = { title: fr.practiceEdit.title };

export default function Page() {
  return (
    <div className="flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
      <Link
        href="/pro/app/reglages"
        className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline"
      >
        {fr.practiceEdit.back}
      </Link>
      <div>
        <h1 className="text-xl font-bold">{fr.practiceEdit.title}</h1>
        <p className="text-sm text-text-muted">{fr.practiceEdit.intro}</p>
      </div>
      <PracticeSettings />
    </div>
  );
}
