'use client';

import { useRouter } from 'next/navigation';
import { EmailOtpForm } from '../EmailOtpForm';

export function PharmaSignIn() {
  const router = useRouter();
  return (
    <EmailOtpForm
      allowSignup={false}
      title="Connexion à Twabibu Pharma"
      onDone={() => {
        router.replace('/pharma/app');
        router.refresh();
      }}
    />
  );
}
