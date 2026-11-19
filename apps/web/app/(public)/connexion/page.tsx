import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Card, Container } from '@twabibu/ui';
import { SignInPanel } from '@/components/SignInPanel';
import { apiGet } from '@/lib/api-server';

export const metadata: Metadata = { title: 'Connexion', robots: { index: false } };

/** Only internal paths are accepted as a destination (no open redirect). */
function safeNext(next?: string): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/mon-compte/rendez-vous';
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const me = await apiGet('/v1/me');
  if (me.ok) redirect(next);
  return (
    <Container className="flex justify-center py-10">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <SignInPanel next={next} />
      </Card>
    </Container>
  );
}
