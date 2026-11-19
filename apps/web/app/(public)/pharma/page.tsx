import type { Metadata } from 'next';
import Link from 'next/link';
import { ClipboardList, Package, Store, Truck } from 'lucide-react';
import { fr } from '@twabibu/i18n';
import { buttonClasses, Card, Container } from '@twabibu/ui';

export const metadata: Metadata = { title: 'Twabibu Pharma, pour les pharmacies', description: fr.home.pharmaText };

const POINTS = [
  { icon: Store, title: 'Visible les jours de garde', text: 'Votre pharmacie apparaît sur la page publique des gardes de votre île, avec appel et itinéraire.' },
  { icon: ClipboardList, title: 'Les ordonnances avant le patient', text: 'Le patient vous envoie son ordonnance numérique : vous indiquez la disponibilité et le prix, il confirme.' },
  { icon: Package, title: 'Votre catalogue en ligne', text: 'Prix et stock tenus par vous, import par fichier CSV. Les médicaments sur ordonnance ne se commandent qu’avec une ordonnance.' },
  { icon: Truck, title: 'Retrait ou livraison', text: 'Vous fixez vos zones et frais de livraison. Le patient est prévenu par e-mail à chaque étape.' },
];

export default function PharmaLandingPage() {
  return (
    <Container className="flex flex-col gap-8 py-10 sm:py-14">
      <div className="flex max-w-2xl flex-col gap-3">
        <p className="text-xs font-bold tracking-wide text-pharmacy uppercase">Twabibu Pharma</p>
        <h1 className="text-2xl font-bold sm:text-[28px]">{fr.home.pharmaTitle}</h1>
        <p className="text-text">{fr.home.pharmaText}</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/pharma/connexion" className={buttonClasses({ variant: 'primary' })}>
            Accéder à Twabibu Pharma
          </Link>
          <Link href="/pharmacies-de-garde" className={buttonClasses({ variant: 'secondary' })}>
            Voir les pharmacies de garde
          </Link>
        </div>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {POINTS.map(({ icon: Icon, title, text }) => (
          <li key={title}>
            <Card className="flex h-full gap-4">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-pharmacy-soft text-pharmacy">
                <Icon aria-hidden="true" size={22} />
              </span>
              <div>
                <h2 className="text-base font-bold">{title}</h2>
                <p className="text-text">{text}</p>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-sm text-text-muted">Twabibu ne vend pas de médicaments : la vente et le paiement restent entre la pharmacie et le patient.</p>
    </Container>
  );
}
