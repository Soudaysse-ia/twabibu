import Link from 'next/link';
import { fr } from '@twabibu/i18n';
import { buttonClasses, Container, Logo } from '@twabibu/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-primary">
        <Container className="flex h-16 items-center">
          <Link href="/" aria-label="Twabibu, accueil">
            <Logo tone="white" height={40} />
          </Link>
        </Container>
      </header>
      <main id="contenu" className="flex flex-1 items-center">
        <Container className="flex flex-col items-start gap-4 py-16">
          <p className="font-heading text-5xl font-bold text-primary">404</p>
          <h1 className="text-2xl font-bold">{fr.notFound.title}</h1>
          <p className="text-text">{fr.notFound.text}</p>
          <Link href="/" className={buttonClasses({ variant: 'primary' })}>
            {fr.comingSoon.back}
          </Link>
        </Container>
      </main>
    </div>
  );
}
