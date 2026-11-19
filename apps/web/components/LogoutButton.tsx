'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@twabibu/ui';
import { api } from '@/lib/api-client';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await api('/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
        router.replace('/');
        router.refresh();
      }}
    >
      Se déconnecter
    </Button>
  );
}
