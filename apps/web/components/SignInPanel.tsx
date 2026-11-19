'use client';

import { useRouter } from 'next/navigation';
import { EmailOtpForm } from './EmailOtpForm';

/** /connexion: sign in or sign up, then go back to where the visitor came from. */
export function SignInPanel({ next }: { next: string }) {
  const router = useRouter();
  return (
    <EmailOtpForm
      title="Connectez-vous ou créez votre compte"
      onDone={() => {
        router.replace(next);
        router.refresh();
      }}
    />
  );
}
