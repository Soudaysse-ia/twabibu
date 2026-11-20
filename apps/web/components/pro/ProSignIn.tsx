'use client';

import { useRouter } from 'next/navigation';
import { EmailOtpForm } from '../EmailOtpForm';

export function ProSignIn() {
  const router = useRouter();
  return (
    <EmailOtpForm
      allowSignup={false}
      noAccountMessage="Cette adresse n’est associée à aucun compte professionnel. Pour rejoindre Twabibu, inscrivez votre cabinet ci-dessous."
      title="Connexion à Twabibu Pro"
      onDone={() => {
        router.replace('/pro/app');
        router.refresh();
      }}
    />
  );
}
