import Link from 'next/link';
import { Construction } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { buttonClasses, Card, Container } from '@twabibu/ui';

/** Placeholder for pages that later tickets will build. Says so plainly. */
export function ComingSoon({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Container className="py-12 sm:py-16">
      <Card className="mx-auto flex max-w-2xl flex-col items-start gap-4 p-6 sm:p-8">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Construction aria-hidden="true" size={22} />
        </span>
        <p className="text-xs font-bold tracking-wide text-text-muted uppercase">{fr.comingSoon.eyebrow}</p>
        <h1 className="text-2xl font-bold">{title}</h1>
        {children}
        <p className="text-text">{fr.comingSoon.text}</p>
        <Link href="/" className={buttonClasses({ variant: 'secondary' })}>
          {fr.comingSoon.back}
        </Link>
      </Card>
    </Container>
  );
}
