import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarDays, FileText, Pill, ShieldCheck, Stethoscope, Store, UserRound } from 'lucide-react';
import { buttonClasses, Card, Container } from '@twabibu/ui';
import { isDemo } from '@/lib/demo';

export const metadata: Metadata = { title: 'Découvrir la démo', robots: { index: false } };

const AMINA = '/medecin-generaliste/moroni/amina-said';

const SPACES = [
  {
    icon: UserRound,
    title: 'Patients',
    who: 'Créez votre compte avec n’importe quelle adresse e-mail, code 000000.',
    start: { href: '/', label: 'Ouvrir le site patient' },
    features: [
      { label: 'Chercher un soignant par spécialité ou par nom, sur les trois îles', href: '/recherche?q=medecin' },
      { label: 'Prendre rendez-vous en ligne, pour soi ou pour un proche', href: `${AMINA}/reserver` },
      { label: 'Déplacer ou annuler un rendez-vous, ajouter au calendrier', href: '/mon-compte/rendez-vous' },
      { label: 'Retrouver ses soignants et reprendre rendez-vous en un clic', href: '/mon-compte/soignants' },
      { label: 'Ses ordonnances numériques, envoyées à une pharmacie', href: '/mon-compte/ordonnances' },
      { label: 'Partager son dossier médical avec un cabinet, voir qui l’a consulté', href: '/mon-compte/dossier' },
      { label: 'Pharmacies de garde du jour, par île', href: '/pharmacies-de-garde' },
    ],
  },
  {
    icon: Stethoscope,
    title: 'Twabibu Pro (cabinets)',
    who: 'Praticienne amina.said@demo.twabibu.km · secrétaire secretariat@demo.twabibu.km · responsable direction@demo.twabibu.km',
    start: { href: '/pro/connexion', label: 'Se connecter à Twabibu Pro' },
    features: [
      { label: 'Accueil du médecin : journée, prochain patient, demandes à valider', href: '/pro/app' },
      { label: 'Agenda jour, semaine et mois, plusieurs praticiens', href: '/pro/app/agenda' },
      { label: 'Glisser-déposer un rendez-vous, le patient est prévenu', href: '/pro/app/agenda' },
      { label: 'Accepter ou refuser les demandes en ligne', href: '/pro/app' },
      { label: 'Patients et dossier médical : antécédents, allergies, constantes, consultations', href: '/pro/app/patients' },
      { label: 'Consultation et ordonnance numérique avec alertes (allergie, doublon)', href: '/pro/app' },
      { label: 'Motifs, horaires en ligne, absences et rappels', href: '/pro/app/reglages' },
    ],
  },
  {
    icon: Store,
    title: 'Twabibu Pharma (pharmacies)',
    who: 'Titulaire titulaire.port@demo.twabibu.km · préparateur preparateur.port@demo.twabibu.km',
    start: { href: '/pharma/connexion', label: 'Se connecter à Twabibu Pharma' },
    features: [
      { label: 'Ordonnances reçues des patients, réponse ligne par ligne', href: '/pharma/connexion' },
      { label: 'Commandes : retrait ou livraison, suivi par étapes', href: '/pharma/connexion' },
      { label: 'Catalogue de produits et import CSV', href: '/pharma/connexion' },
      { label: 'Calendrier des gardes', href: '/pharma/connexion' },
    ],
  },
];

const JOURNEYS = [
  {
    icon: CalendarDays,
    title: 'Un rendez-vous de bout en bout',
    steps: [
      'Sur le site, cherchez « médecin » et ouvrez le profil du Dr Amina Saïd.',
      'Choisissez un motif et un créneau, créez votre compte (code 000000), confirmez.',
      'Dans « Mes rendez-vous », déplacez-le sur un autre horaire.',
      'Connectez-vous à Twabibu Pro en tant que Dr Amina Saïd : le rendez-vous est dans l’agenda, à son nouvel horaire.',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Les demandes à valider',
    steps: [
      'Connectez-vous à Twabibu Pro en tant que Dr Amina Saïd.',
      'Sur l’accueil, ouvrez une des « Demandes à valider ».',
      'Acceptez-la ou refusez-la : le patient reçoit la réponse par e-mail (factice).',
      'Ouvrez l’agenda en vue mois pour voir la charge de chaque jour.',
    ],
  },
  {
    icon: FileText,
    title: 'Du dossier médical à la pharmacie',
    steps: [
      'Dans Twabibu Pro, ouvrez la fiche d’Ahmed Mze : antécédents, traitements, constantes et consultations passées.',
      'Ouvrez une consultation de Mariama Houmadi, allergique aux pénicillines, et prescrivez de l’amoxicilline : l’ordonnance est bloquée.',
      'Côté patient, une ordonnance s’envoie à une pharmacie depuis « Mes ordonnances ».',
      'Connectez-vous à Twabibu Pharma : la pharmacie répond et prépare la commande.',
    ],
  },
];

/** Guided tour of the demo build: what to try, with which account. Hidden outside demo builds. */
export default function DemoPage() {
  if (!isDemo()) notFound();
  return (
    <div className="flex flex-col">
      <section className="bg-primary text-white">
        <Container className="flex flex-col gap-4 py-10 sm:py-14">
          <p className="text-sm font-bold tracking-wide uppercase opacity-90">Version de démonstration</p>
          <h1 className="max-w-3xl font-heading text-3xl font-bold text-white sm:text-4xl">Twabibu, la santé des Comores en un seul endroit</h1>
          <p className="max-w-2xl text-lg text-white/90">
            Rendez-vous en ligne, agenda des cabinets, dossier médical partagé avec l’accord du patient, ordonnance numérique et pharmacies. Tout est fictif : essayez sans crainte.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={`${AMINA}/reserver`} className={buttonClasses({ variant: 'onPrimary', size: 'lg' })}>
              <CalendarDays aria-hidden="true" size={18} /> Prendre un rendez-vous
            </Link>
            <Link href="/pro/connexion" className={buttonClasses({ variant: 'onPrimary', size: 'lg' })}>
              <Stethoscope aria-hidden="true" size={18} /> Espace médecin
            </Link>
            <Link href="/pharmacies-de-garde" className={buttonClasses({ variant: 'onPrimary', size: 'lg' })}>
              <Pill aria-hidden="true" size={18} /> Pharmacies de garde
            </Link>
          </div>
        </Container>
      </section>

      <Container className="flex flex-col gap-10 py-10">
        <section aria-labelledby="codes" className="rounded-md border border-border bg-surface p-4 text-sm text-text">
          <h2 id="codes" className="mb-1 font-bold text-ink">
            Se connecter
          </h2>
          Partout, la connexion se fait par e-mail : saisissez l’adresse d’un compte ci-dessous puis le code <span className="font-bold text-ink">000000</span>. Aucun e-mail ni SMS n’est vraiment envoyé.
        </section>

        <section aria-labelledby="spaces" className="flex flex-col gap-4">
          <h2 id="spaces" className="text-2xl font-bold">
            Ce que vous pouvez essayer
          </h2>
          <div className="grid gap-4 lg:grid-cols-3">
            {SPACES.map(({ icon: Icon, title, who, start, features }) => (
              <Card key={title} className="flex flex-col gap-3">
                <h3 className="flex items-center gap-2 font-heading text-lg font-bold text-navy">
                  <Icon aria-hidden="true" size={20} className="text-primary" /> {title}
                </h3>
                <p className="text-xs break-words text-text-muted">{who}</p>
                <ul className="flex flex-col gap-1">
                  {features.map((f) => (
                    <li key={f.label}>
                      <Link href={f.href} className="flex min-h-11 items-center rounded-md px-2 text-sm text-ink hover:bg-primary-soft hover:text-primary">
                        {f.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href={start.href} className={buttonClasses({ variant: 'primary', size: 'md' }) + ' mt-auto'}>
                  {start.label}
                </Link>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="journeys" className="flex flex-col gap-4">
          <h2 id="journeys" className="text-2xl font-bold">
            Trois parcours à suivre
          </h2>
          <div className="grid gap-4 lg:grid-cols-3">
            {JOURNEYS.map(({ icon: Icon, title, steps }) => (
              <Card key={title} className="flex flex-col gap-3">
                <h3 className="flex items-center gap-2 font-heading text-base font-bold text-navy">
                  <Icon aria-hidden="true" size={18} className="text-primary" /> {title}
                </h3>
                <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-text">
                  {steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="principles" className="flex flex-col gap-3">
          <h2 id="principles" className="text-2xl font-bold">
            Les règles que la démo respecte déjà
          </h2>
          <ul className="grid gap-3 text-sm text-text sm:grid-cols-2">
            <li className="flex gap-2">
              <ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-success" /> Le dossier médical n’est lu que par les soignants, jamais par le secrétariat, et chaque lecture est inscrite.
            </li>
            <li className="flex gap-2">
              <ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-success" /> Un cabinet ne voit les notes d’un autre qu’avec l’accord du patient, qui peut le retirer.
            </li>
            <li className="flex gap-2">
              <ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-success" /> Aucune donnée médicale dans les e-mails et SMS : ni motif, ni traitement.
            </li>
            <li className="flex gap-2">
              <ShieldCheck aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-success" /> Pas de téléconsultation : Twabibu organise les soins en cabinet et en pharmacie.
            </li>
          </ul>
        </section>
      </Container>
    </div>
  );
}
