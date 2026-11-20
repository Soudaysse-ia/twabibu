import type { Metadata } from 'next';
import Link from 'next/link';
import { BellRing, CalendarCheck, ClipboardList, FileSignature, ShieldCheck, Users } from 'lucide-react';
import { buttonClasses, Card, Container } from '@twabibu/ui';

export const metadata: Metadata = {
  title: 'Vous êtes soignant ? Twabibu Pro',
  description:
    'Agenda en ligne, rappels, dossier médical et ordonnance numérique pour les soignants des Comores. Inscrivez votre cabinet en quelques minutes.',
};

const BENEFITS = [
  {
    icon: CalendarCheck,
    title: 'Rendez-vous en ligne, jour et nuit',
    text: 'Vos patients réservent eux-mêmes sur les créneaux que vous ouvrez. Vous gardez la main : validation manuelle possible, délais et motifs à votre rythme.',
  },
  {
    icon: BellRing,
    title: 'Moins de rendez-vous oubliés',
    text: 'Confirmation et rappel envoyés automatiquement au patient, avec un lien pour annuler et libérer le créneau.',
  },
  {
    icon: ClipboardList,
    title: 'Le dossier médical sous la main',
    text: 'Antécédents, allergies, traitements, constantes et consultations. Avec l’accord du patient, vous voyez aussi ce qu’ont noté ses autres soignants.',
  },
  {
    icon: FileSignature,
    title: 'Ordonnance numérique',
    text: 'Ordonnance signée, avec alertes allergie et doublon. Le patient l’envoie à la pharmacie de son choix.',
  },
  {
    icon: Users,
    title: 'Votre équipe, chacun ses droits',
    text: 'La secrétaire gère l’agenda et l’accueil sans jamais voir le contenu médical.',
  },
  {
    icon: ShieldCheck,
    title: 'Données de santé protégées',
    text: 'Notes chiffrées, chaque lecture du dossier est enregistrée, aucune information médicale dans les e-mails ou les SMS.',
  },
];

const STEPS = [
  [
    'Inscrivez votre cabinet',
    'Spécialité, numéro d’autorisation d’exercer, adresse : quelques minutes suffisent. Votre agenda est créé avec des motifs de départ.',
  ],
  [
    'Nous vérifions votre dossier',
    'L’équipe Twabibu contrôle votre identité professionnelle, en général sous 48 h ouvrées, et peut vous appeler.',
  ],
  [
    'Vos patients vous trouvent',
    'Votre profil apparaît dans la recherche par spécialité et par île. Vous recevez vos premiers rendez-vous en ligne.',
  ],
];

const OFFERS = [
  ['Découverte', 'Profil vérifié dans l’annuaire, horaires, tarifs et bouton « Appeler le cabinet ».'],
  [
    'Agenda',
    'Agenda complet, réservation en ligne, rappels, patientèle, dossier médical et ordonnance numérique, un compte secrétaire.',
  ],
  ['Cabinet', 'Toute l’offre Agenda, avec utilisateurs illimités, documents et statistiques.'],
  ['Établissement', 'Plusieurs praticiens et plusieurs sites, tableau de bord et accompagnement dédié.'],
];

const FAQ = [
  ['Les patients paient-ils pour réserver ?', 'Non. Twabibu est gratuit pour les patients.'],
  [
    'Twabibu propose-t-il la téléconsultation ?',
    'Non. Twabibu organise les consultations au cabinet : prise de rendez-vous, suivi du dossier et ordonnance.',
  ],
  [
    'Qui voit le dossier médical de mes patients ?',
    'Les praticiens du cabinet, pour ce qu’ils ont noté eux-mêmes. Le reste du dossier seulement si le patient l’a autorisé. Jamais le secrétariat, ni l’équipe Twabibu.',
  ],
  [
    'Puis-je régler mon agenda avant la vérification ?',
    'Oui. Vous pouvez tout préparer : motifs, horaires, plages en ligne. Les patients vous voient dès que votre dossier est validé.',
  ],
];

/** « Vous êtes soignant ? » (WEB-03): what Twabibu Pro does, how to join, and the sign-up entry point. */
export default function ForPractitionersPage() {
  return (
    <>
      <section className="bg-primary text-white">
        <Container className="flex flex-col gap-5 py-12 sm:py-16">
          <p className="text-sm font-bold tracking-wide uppercase opacity-90">Twabibu Pro</p>
          <h1 className="max-w-3xl text-3xl leading-tight font-bold text-white sm:text-4xl">
            L’agenda en ligne et le dossier patient des soignants des Comores
          </h1>
          <p className="max-w-2xl text-base opacity-95 sm:text-lg">
            Moins de téléphone, moins de rendez-vous oubliés, et le suivi de vos patients au même endroit. À
            vos côtés, dans chaque temps de soin.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/pro/inscription" className={buttonClasses({ variant: 'onPrimary', size: 'lg' })}>
              Inscrire mon cabinet
            </Link>
            <Link
              href="/pro/connexion"
              className="inline-flex h-12 items-center rounded-md border border-white/70 px-6 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              J’ai déjà un compte
            </Link>
          </div>
        </Container>
      </section>

      <Container className="flex flex-col gap-12 py-12">
        <section aria-labelledby="avantages" className="flex flex-col gap-5">
          <h2 id="avantages" className="text-2xl font-bold">
            Ce que Twabibu Pro fait pour vous
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Card className="flex h-full flex-col gap-2">
                  <Icon aria-hidden="true" size={24} className="text-primary" />
                  <h3 className="text-base font-bold">{title}</h3>
                  <p className="text-sm text-text">{text}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="etapes" className="flex flex-col gap-5">
          <h2 id="etapes" className="text-2xl font-bold">
            Comment ça marche
          </h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-white"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-base font-bold">{title}</h3>
                  <p className="text-sm text-text">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="offres" className="flex flex-col gap-5">
          <div>
            <h2 id="offres" className="text-2xl font-bold">
              Les offres
            </h2>
            <p className="text-sm text-text">
              Gratuit pour les patients, payant pour les soignants. Les tarifs sont en cours de validation
              avec les premiers cabinets : nous vous les présentons à l’inscription.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OFFERS.map(([name, text]) => (
              <li key={name}>
                <Card className="flex h-full flex-col gap-2">
                  <h3 className="text-lg font-bold text-primary">{name}</h3>
                  <p className="text-sm text-text">{text}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="questions" className="flex flex-col gap-3">
          <h2 id="questions" className="text-2xl font-bold">
            Questions fréquentes
          </h2>
          {FAQ.map(([q, a]) => (
            <details
              key={q}
              className="group rounded-md border border-border bg-surface px-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-3 font-medium text-ink focus-visible:outline-2 focus-visible:outline-primary">
                {q}
                <span
                  aria-hidden="true"
                  className="text-xl text-primary transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pb-4 text-sm text-text">{a}</p>
            </details>
          ))}
        </section>

        <Card className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">Prêt à recevoir vos patients en ligne ?</h2>
            <p className="text-sm text-text">
              L’inscription prend quelques minutes. Vous pourrez tout régler avant la vérification.
            </p>
          </div>
          <Link href="/pro/inscription" className={buttonClasses({ variant: 'primary', size: 'lg' })}>
            Inscrire mon cabinet
          </Link>
        </Card>
      </Container>
    </>
  );
}
