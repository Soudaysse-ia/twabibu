import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fr } from '@twabibu/i18n';
import { Card, Container } from '@twabibu/ui';
import { ProfileReportForm } from '@/components/ProfileReportForm';
import { apiGet } from '@/lib/api-server';
import type { Profile } from '@/lib/types';

export const metadata: Metadata = { title: fr.report.title, robots: { index: false, follow: false } };

/** « Signaler un problème avec ce profil » (SPEC-02, PROFILE-06). */
export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = await apiGet<Profile>(`/v1/practitioners/${encodeURIComponent(slug)}`);
  if (!profile.ok) notFound();
  const p = profile.data;
  return (
    <Container className="py-8 sm:py-12">
      <Card className="mx-auto flex max-w-xl flex-col gap-4 p-5 sm:p-8">
        <Link
          href={p.url}
          className="inline-flex min-h-11 items-center self-start text-sm font-medium text-primary hover:underline"
        >
          ← {fr.report.back}
        </Link>
        <h1 className="text-2xl font-bold text-ink">{fr.report.title}</h1>
        <p className="text-text">{fr.report.intro(p.displayName)}</p>
        <ProfileReportForm slug={p.slug} profileUrl={p.url} />
      </Card>
    </Container>
  );
}
