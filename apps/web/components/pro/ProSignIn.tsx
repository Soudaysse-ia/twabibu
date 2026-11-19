'use client';

import { useRouter } from 'next/navigation';
import { EmailOtpForm } from '../EmailOtpForm';

export function ProSignIn() {
  const router = useRouter();
  return (
    <EmailOtpForm
      allowSignup={false}
      title="Connexion à Twabibu Pro"
      onDone={() => {
        router.replace('/pro/app');
        router.refresh();
      }}
    />
  );
}
