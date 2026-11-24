/**
 * Help centre articles (WEB-02). Plain structured text, rendered by apps/web: no HTML, no markdown parser, so nothing
 * here can inject markup. Each article only describes what the product really does today; update it with the feature.
 * Later the back-office will manage these articles (SPEC-11 §5); until then they live here, reviewed like code.
 */

export type HelpBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'steps'; items: string[] }
  | { kind: 'note'; text: string };

export type HelpAudience = 'PATIENT' | 'PRACTITIONER' | 'PHARMACY';

export interface HelpArticle {
  slug: string;
  audience: HelpAudience;
  title: string;
  summary: string;
  body: HelpBlock[];
  /** Internal page the article points to, shown as a button at the end. */
  action?: { label: string; href: string };
}

export const HELP_AUDIENCES: Record<HelpAudience, { title: string; intro: string }> = {
  PATIENT: { title: 'Patients', intro: 'Votre compte, vos rendez-vous, votre dossier et vos ordonnances.' },
  PRACTITIONER: {
    title: 'Soignants',
    intro: 'Votre inscription, votre agenda et votre équipe sur Twabibu Pro.',
  },
  PHARMACY: { title: 'Pharmacies', intro: 'Gardes, catalogue et commandes sur Twabibu Pharma.' },
};

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'creer-un-compte-et-se-connecter',
    audience: 'PATIENT',
    title: 'Créer un compte et se connecter',
    summary: 'Une adresse e-mail suffit : pas de mot de passe à retenir.',
    body: [
      {
        kind: 'p',
        text: 'Twabibu vous identifie par votre adresse e-mail. Il n’y a pas de mot de passe : à chaque connexion, vous recevez un code à 6 chiffres.',
      },
      {
        kind: 'steps',
        items: [
          'Cliquez sur « Se connecter » en haut de la page.',
          'Saisissez votre adresse e-mail.',
          'Ouvrez l’e-mail reçu et saisissez le code à 6 chiffres. Il est valable 5 minutes.',
          'La première fois, indiquez votre nom, votre prénom et votre date de naissance, et acceptez les conditions générales d’utilisation pour créer votre compte.',
        ],
      },
      {
        kind: 'p',
        text: 'Vous restez connecté sur cet appareil pendant 30 jours. Depuis « Mon profil », vous voyez les appareils connectés et pouvez les déconnecter.',
      },
      {
        kind: 'note',
        text: 'Twabibu ne vous demandera jamais votre code par téléphone, par SMS ou par e-mail. Ne le communiquez à personne.',
      },
      {
        kind: 'p',
        text: 'Vous ne recevez pas le code ? Vérifiez le dossier « Courrier indésirable », puis demandez un nouveau code après quelques minutes.',
      },
    ],
    action: { label: 'Se connecter', href: '/connexion' },
  },
  {
    slug: 'prendre-rendez-vous',
    audience: 'PATIENT',
    title: 'Prendre rendez-vous',
    summary: 'Trouver un soignant, choisir un motif et un créneau, recevoir la confirmation.',
    body: [
      {
        kind: 'steps',
        items: [
          'Sur l’accueil, cherchez une spécialité ou le nom d’un soignant, puis une île ou une localité.',
          'Dans les résultats, filtrez si besoin (disponibilité, langues, nouveaux patients…) et ouvrez la fiche du soignant.',
          'Choisissez le lieu de consultation et le motif du rendez-vous.',
          'Choisissez un créneau : il vous est réservé pendant quelques minutes, le temps de terminer.',
          'Connectez-vous avec votre e-mail, puis indiquez pour qui est le rendez-vous : vous ou un proche.',
          'Vérifiez le récapitulatif et confirmez.',
        ],
      },
      {
        kind: 'p',
        text: 'Vous recevez une confirmation par e-mail avec la date, l’heure, le nom du soignant et l’adresse. Le rendez-vous apparaît dans « Mes rendez-vous ».',
      },
      {
        kind: 'p',
        text: 'Certains cabinets valident les demandes eux-mêmes. Dans ce cas, votre rendez-vous reste « en attente » jusqu’à leur réponse, que vous recevez par e-mail.',
      },
      {
        kind: 'note',
        text: 'Twabibu ne propose pas de consultation à distance : tous les rendez-vous ont lieu au cabinet. En cas d’urgence, rendez-vous à l’hôpital le plus proche.',
      },
    ],
    action: { label: 'Chercher un soignant', href: '/recherche' },
  },
  {
    slug: 'annuler-ou-deplacer-un-rendez-vous',
    audience: 'PATIENT',
    title: 'Annuler ou déplacer un rendez-vous',
    summary: 'Depuis « Mes rendez-vous », tant que le délai fixé par le cabinet n’est pas dépassé.',
    body: [
      {
        kind: 'steps',
        items: [
          'Ouvrez « Mes rendez-vous » depuis votre compte.',
          'Repérez le rendez-vous concerné.',
          'Cliquez sur « Déplacer le rendez-vous » pour choisir un autre créneau, ou sur « Annuler le rendez-vous ».',
        ],
      },
      {
        kind: 'p',
        text: 'Chaque cabinet fixe un délai minimal avant le rendez-vous pour annuler ou déplacer en ligne. Passé ce délai, appelez directement le cabinet : son numéro figure sur la fiche du soignant.',
      },
      {
        kind: 'p',
        text: 'Annuler à temps libère le créneau pour un autre patient. Le cabinet est prévenu automatiquement.',
      },
    ],
    action: { label: 'Mes rendez-vous', href: '/mon-compte/rendez-vous' },
  },
  {
    slug: 'rappels-de-rendez-vous',
    audience: 'PATIENT',
    title: 'Rappels de rendez-vous',
    summary: 'Un rappel avant chaque rendez-vous, à arrêter si vous le souhaitez.',
    body: [
      {
        kind: 'p',
        text: 'Avant votre rendez-vous, vous recevez un rappel par e-mail, la veille ou quelques jours avant selon le choix du cabinet. Les rappels ne partent qu’entre 7 h et 21 h, heure des Comores.',
      },
      {
        kind: 'p',
        text: 'Certains cabinets vous demandent de confirmer votre venue : un lien dans le rappel suffit, sans vous connecter.',
      },
      {
        kind: 'p',
        text: 'Pour ne plus recevoir de rappels, ouvrez « Mon profil » et désactivez-les. Les confirmations, déplacements et annulations vous sont toujours envoyés.',
      },
      {
        kind: 'note',
        text: 'Nos messages ne contiennent jamais d’information médicale : seulement la date, l’heure, le soignant et l’adresse.',
      },
    ],
    action: { label: 'Mon profil', href: '/mon-compte/profil' },
  },
  {
    slug: 'gerer-mes-proches',
    audience: 'PATIENT',
    title: 'Prendre rendez-vous pour un proche',
    summary: 'Enfants, parents ou conjoint : un seul compte pour toute la famille.',
    body: [
      {
        kind: 'p',
        text: 'Dans « Mes proches », ajoutez les personnes dont vous gérez les rendez-vous. Au moment de réserver, choisissez simplement pour qui est le rendez-vous.',
      },
      {
        kind: 'list',
        items: [
          'Vous pouvez modifier le nom ou la date de naissance d’un proche à tout moment.',
          'Vous pouvez retirer un proche qui n’a plus de rendez-vous à venir.',
          'Les rendez-vous de vos proches apparaissent avec les vôtres dans « Mes rendez-vous ».',
        ],
      },
    ],
    action: { label: 'Mes proches', href: '/mon-compte/proches' },
  },
  {
    slug: 'qui-voit-mon-dossier-medical',
    audience: 'PATIENT',
    title: 'Qui voit mon dossier médical ?',
    summary: 'Vos soignants, avec votre accord. Jamais le secrétariat ni l’équipe Twabibu.',
    body: [
      {
        kind: 'p',
        text: 'Votre dossier médical (antécédents, allergies, traitements, consultations, ordonnances) n’est accessible qu’aux soignants.',
      },
      {
        kind: 'list',
        items: [
          'Un soignant voit toujours ce qu’il a lui-même noté lors de vos consultations.',
          'Il ne voit ce qu’ont noté vos autres soignants que si vous l’avez accepté.',
          'Les secrétaires, l’équipe administrative des cabinets et l’équipe Twabibu n’y ont jamais accès.',
          'Chaque consultation de votre dossier est enregistrée : vous voyez qui l’a ouvert et quand.',
        ],
      },
      {
        kind: 'p',
        text: 'Dans « Partage de mon dossier », vous donnez ou retirez votre accord à tout moment, et vous consultez l’historique des accès.',
      },
    ],
    action: { label: 'Partage de mon dossier', href: '/mon-compte/dossier' },
  },
  {
    slug: 'envoyer-une-ordonnance-a-une-pharmacie',
    audience: 'PATIENT',
    title: 'Envoyer une ordonnance à une pharmacie',
    summary: 'La pharmacie vérifie la disponibilité, prépare et vous remet les médicaments.',
    body: [
      {
        kind: 'p',
        text: 'Les ordonnances rédigées par vos soignants sur Twabibu apparaissent dans « Mes ordonnances ». Chacune porte un code et un QR code que la pharmacie peut vérifier.',
      },
      {
        kind: 'steps',
        items: [
          'Ouvrez l’ordonnance et choisissez « Envoyer à une pharmacie ».',
          'Choisissez la pharmacie : seule celle-ci pourra lire l’ordonnance.',
          'La pharmacie vous répond médicament par médicament : disponible, à commander ou indisponible.',
          'Vous retirez les médicaments à la pharmacie, ou vous vous les faites livrer si elle le propose.',
        ],
      },
      {
        kind: 'note',
        text: 'Twabibu ne vend pas de médicaments : c’est la pharmacie qui délivre et qui encaisse, sur place ou à la livraison.',
      },
    ],
    action: { label: 'Mes ordonnances', href: '/mon-compte/ordonnances' },
  },
  {
    slug: 'trouver-une-pharmacie-de-garde',
    audience: 'PATIENT',
    title: 'Trouver une pharmacie de garde',
    summary: 'La nuit, le dimanche et les jours fériés, île par île, sans compte.',
    body: [
      {
        kind: 'p',
        text: 'La page « Pharmacies de garde » indique les pharmacies ouvertes aujourd’hui sur chaque île, avec leur adresse et leur numéro de téléphone. Elle est accessible sans compte.',
      },
      {
        kind: 'p',
        text: 'Avant de vous déplacer, appelez la pharmacie pour vérifier qu’elle a le médicament dont vous avez besoin.',
      },
    ],
    action: { label: 'Pharmacies de garde', href: '/pharmacies-de-garde' },
  },
  {
    slug: 'commander-en-pharmacie',
    audience: 'PATIENT',
    title: 'Commander des produits en pharmacie',
    summary: 'Panier, retrait ou livraison, et suivi de la commande par e-mail.',
    body: [
      {
        kind: 'steps',
        items: [
          'Ouvrez la fiche d’une pharmacie et ajoutez des produits de son catalogue à votre panier.',
          'Choisissez le retrait à la pharmacie ou la livraison, si elle livre votre zone.',
          'Envoyez la commande : la pharmacie l’accepte, la prépare et vous prévient à chaque étape par e-mail.',
        ],
      },
      {
        kind: 'p',
        text: 'Vous payez directement la pharmacie, au retrait ou à la livraison. Tant que la pharmacie n’a pas commencé la préparation, vous pouvez annuler depuis « Mes commandes ».',
      },
    ],
    action: { label: 'Mes commandes', href: '/mon-compte/commandes' },
  },
  {
    slug: 'inscrire-mon-cabinet',
    audience: 'PRACTITIONER',
    title: 'Inscrire mon cabinet sur Twabibu Pro',
    summary: 'Quelques minutes en ligne, puis une vérification par l’équipe Twabibu.',
    body: [
      {
        kind: 'steps',
        items: [
          'Ouvrez « Twabibu Pro » puis « Inscrire mon cabinet ».',
          'Confirmez votre adresse e-mail avec le code reçu.',
          'Indiquez votre spécialité, votre numéro d’autorisation d’exercer et l’adresse du cabinet.',
          'Votre agenda est créé avec des motifs de départ que vous pouvez modifier.',
        ],
      },
      {
        kind: 'p',
        text: 'L’équipe Twabibu vérifie votre autorisation d’exercer avant de publier votre profil. Vous êtes prévenu par e-mail de sa décision. En attendant, vous pouvez déjà préparer votre agenda.',
      },
    ],
    action: { label: 'Inscrire mon cabinet', href: '/pro/inscription' },
  },
  {
    slug: 'valider-les-demandes-de-rendez-vous',
    audience: 'PRACTITIONER',
    title: 'Valider les demandes de rendez-vous',
    summary: 'Gardez la main : acceptez ou refusez chaque demande en ligne.',
    body: [
      {
        kind: 'p',
        text: 'Si vous choisissez la validation manuelle, les rendez-vous pris en ligne arrivent comme des demandes. Elles s’affichent sur votre accueil et dans l’agenda.',
      },
      {
        kind: 'p',
        text: 'Ouvrez une demande puis choisissez « Accepter » ou « Refuser ». Le patient est prévenu automatiquement, par e-mail ou par SMS. Une demande restée sans réponse 24 heures vous est rappelée par e-mail, à vous et aux responsables du cabinet.',
      },
    ],
    action: { label: 'Ouvrir Twabibu Pro', href: '/pro/connexion' },
  },
  {
    slug: 'droits-de-l-equipe',
    audience: 'PRACTITIONER',
    title: 'Ce que voit chaque membre de l’équipe',
    summary: 'La secrétaire gère l’agenda sans jamais voir le contenu médical.',
    body: [
      {
        kind: 'list',
        items: [
          'Praticien : son agenda, ses patients et leur dossier médical, avec l’accord du patient.',
          'Secrétaire : les agendas qui lui sont confiés, l’accueil et les coordonnées des patients. Jamais le dossier médical.',
          'Responsable du cabinet : l’organisation, l’équipe et les réglages. Pas le dossier médical, sauf s’il est lui-même praticien.',
        ],
      },
      {
        kind: 'steps',
        items: [
          'Titulaire ou administrateur : ouvrez « Réglages » puis « Gérer l’équipe ».',
          'Saisissez l’adresse e-mail de la personne, choisissez son rôle et, pour une secrétaire, les agendas qu’elle gère.',
          'Elle reçoit un lien valable 7 jours et confirme son adresse avec un code : son accès est ouvert.',
        ],
      },
      {
        kind: 'p',
        text: 'Un départ ? « Retirer » ferme aussitôt ses sessions sur tous ses appareils ; les rendez-vous et les dossiers restent au cabinet. Un nouveau praticien inscrit lui-même son activité, car son autorisation d’exercer doit être vérifiée.',
      },
    ],
    action: { label: 'Ouvrir Twabibu Pro', href: '/pro/connexion' },
  },
  {
    slug: 'rejoindre-twabibu-pharma',
    audience: 'PHARMACY',
    title: 'Rejoindre Twabibu Pharma',
    summary: 'Gardes, catalogue, ordonnances et commandes de vos clients.',
    body: [
      {
        kind: 'p',
        text: 'Twabibu Pharma permet à votre pharmacie de publier ses horaires et ses gardes, de tenir son catalogue, de recevoir les ordonnances que les patients vous envoient et de gérer leurs commandes.',
      },
      {
        kind: 'p',
        text: 'Pour inscrire votre pharmacie, écrivez-nous depuis le formulaire de contact en choisissant « Pharmacie ». L’équipe Twabibu vérifie l’autorisation d’exploitation avant d’ouvrir votre espace.',
      },
    ],
    action: { label: 'Nous contacter', href: '/contact' },
  },
  {
    slug: 'publier-les-gardes',
    audience: 'PHARMACY',
    title: 'Publier les gardes',
    summary: 'Le calendrier des gardes de chaque île, visible par tous.',
    body: [
      {
        kind: 'p',
        text: 'Le calendrier des gardes est saisi par l’équipe Twabibu à partir du planning officiel de chaque île. Votre pharmacie voit ses prochaines gardes dans son espace.',
      },
      {
        kind: 'p',
        text: 'Une erreur dans le calendrier ? Signalez-la-nous depuis le formulaire de contact : elle est corrigée pour tous les patients.',
      },
    ],
    action: { label: 'Nous contacter', href: '/contact' },
  },
];

export function helpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}
