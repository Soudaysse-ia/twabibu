import Link from 'next/link';
import { isDemo } from '@/lib/demo';

/** Thin strip above the header of the demo build: fictional data, and the way to the guided tour. */
export function DemoBanner() {
  if (!isDemo()) return null;
  return (
    <div className="bg-navy px-4 py-2 text-center text-sm text-white">
      Version de démonstration : toutes les données sont fictives.{' '}
      <Link href="/demo" className="font-bold underline underline-offset-2">
        Découvrir la démo
      </Link>
    </div>
  );
}
