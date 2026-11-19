'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { api } from '@/lib/api-client';

export function ProLogout({ to = '/pro/connexion' }: { to?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await api('/v1/auth/logout', { method: 'POST' }).catch(() => undefined);
        router.replace(to);
        router.refresh();
      }}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-text hover:bg-background-soft"
    >
      <LogOut aria-hidden="true" size={16} />
      <span className="hidden sm:inline">Se déconnecter</span>
    </button>
  );
}
