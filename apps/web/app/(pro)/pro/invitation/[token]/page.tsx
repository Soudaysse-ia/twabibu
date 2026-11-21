import type { Metadata } from 'next';
import Link from 'next/link';
import { fr } from '@twabibu/i18n';
import { Card, Logo } from '@twabibu/ui';
import { InvitationAccept, type InvitationPreview } from '@/components/pro/InvitationAccept';
import { apiGet } from '@/lib/api-server';
import type { ProMe } from '@/lib/pro-types';

export const metadata: Metadata = { title: fr.invitation.title, robots: { index: false, follow: false } };

/** Team invitation link (SPEC-07, PRO-05): shows the practice and role, then signs in or creates the account. */
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [preview, me] = await Promise.all([
    apiGet<InvitationPreview>(`/v1/pro/invitations/${encodeURIComponent(token)}`),
    apiGet<ProMe>('/v1/pro/me'),
  ]);
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="bg-primary">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center px-4 sm:h-16">
          <Link href="/" aria-label="Twabibu, accueil">
            <Logo tone="white" height={38} />
          </Link>
        </div>
      </header>
      <main id="contenu" className="flex flex-1 items-start justify-center px-4 py-10">
        <Card className="flex w-full max-w-md flex-col gap-4 p-6 sm:p-8">
          <p className="text-xs font-bold tracking-wide text-primary uppercase">Twabibu Pro</p>
          <h1 className="text-2xl font-bold text-ink">{fr.invitation.title}</h1>
          {preview.ok ? (
            <InvitationAccept
              token={token}
              invitation={preview.data}
              signedInEmail={me.ok ? me.data.email : null}
            />
          ) : (
            <>
              <p role="alert" className="rounded-md bg-warning-soft p-3 text-sm text-ink">
                {fr.invitation.unknown}
              </p>
              <Link href="/pro/connexion" className="text-sm font-medium text-primary hover:underline">
                {fr.invitation.toSignIn}
              </Link>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
