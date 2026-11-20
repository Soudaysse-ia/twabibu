/**
 * Institutional and legal pages (WEB-02): about, legal notice, privacy, terms of use. Same structured blocks as the
 * help centre (no HTML). These texts are a DRAFT written from what the product really does; they must be reviewed by
 * a lawyer before the public launch (ticket LEGAL-01). Everything about the publishing company is in LEGAL_PUBLISHER:
 * fill it in once, every page follows.
 */
import type { HelpBlock } from './help.js';

/** Shown on every legal page while LEGAL-01 is open. Set `draft: false` once the texts are validated. */
export const LEGAL_STATUS = {
  draft: true,
  updatedOn: '20 novembre 2026',
  draftNotice:
    'Version provisoire, en cours de validation juridique. Les informations marquées « à compléter » seront renseignées avant l’ouverture publique du service.',
};

const TO_COMPLETE = 'à compléter';

/** The company that publishes Twabibu. Every « à compléter » must be filled in before the public launch (LEGAL-01). */
export const LEGAL_PUBLISHER = {
  name: `Twabibu (raison sociale ${TO_COMPLETE})`,
  legalForm: TO_COMPLETE,
  registration: TO_COMPLETE,
  address: `${TO_COMPLETE}, Moroni, Union des Comores`,
  publicationDirector: TO_COMPLETE,
  contactPage: '/contact',
};

/** Hosting provider of the servers (runbook mise-en-production-hetzner.md). Change it here if the host changes. */
export const LEGAL_HOST = {
  name: 'Hetzner Online GmbH',
  address: 'Industriestraße 25, 91710 Gunzenhausen, Allemagne',
  website: 'https://www.hetzner.com',
};

export interface LegalSection {
  title: string;
  body: HelpBlock[];
}

export interface LegalDocument {
  slug: 'a-propos' | 'mentions-legales' | 'confidentialite' | 'cgu';
  title: string;
  description: string;
  /** Legal documents carry the draft notice and the update date; the about page does not. */
  legal: boolean;
  intro?: string;
  sections: LegalSection[];
}

const p = (text: string): HelpBlock => ({ kind: 'p', text });
const list = (...items: string[]): HelpBlock => ({ kind: 'list', items });
const note = (text: string): HelpBlock => ({ kind: 'note', text });

export const LEGAL_DOCUMENTS: Record<LegalDocument['slug'], LegalDocument> = {
  'a-propos': {
    slug: 'a-propos',
    title: 'À propos de Twabibu',
    description:
      'Twabibu facilite l’accès aux soins aux Comores : rendez-vous en ligne, dossier médical, ordonnance numérique et pharmacies.',
    legal: false,
    intro:
      'Twabibu est la plateforme de santé des Comores. Elle aide les patients à trouver un soignant et à prendre rendez-vous, et elle aide les soignants et les pharmacies à mieux s’organiser.',
    sections: [
      {
        title: 'Ce que vous pouvez faire avec Twabibu',
        body: [
          list(
            'Trouver un soignant sur Ngazidja, Ndzuani ou Mwali, et prendre rendez-vous en ligne, jour et nuit.',
            'Recevoir une confirmation et un rappel, puis déplacer ou annuler en quelques clics.',
            'Gérer les rendez-vous de vos proches depuis un seul compte.',
            'Retrouver vos ordonnances et les envoyer à la pharmacie de votre choix.',
            'Trouver la pharmacie de garde la nuit, le dimanche et les jours fériés.',
          ),
        ],
      },
      {
        title: 'Nos engagements',
        body: [
          list(
            'Gratuit pour les patients. Les soignants et les établissements paient un abonnement pour les outils qu’ils utilisent.',
            'Tous les rendez-vous ont lieu au cabinet : Twabibu ne propose pas de consultation à distance.',
            'Twabibu ne donne aucun conseil médical et ne vend pas de médicaments : les soignants soignent et prescrivent, les pharmacies délivrent.',
            'Votre dossier médical n’est visible que par vos soignants, avec votre accord. Chaque consultation de votre dossier est enregistrée.',
            'Aucune publicité ciblée, aucune revente de données.',
          ),
        ],
      },
      {
        title: 'Soignants et pharmacies',
        body: [
          p(
            'Chaque soignant est vérifié par l’équipe Twabibu avant d’apparaître dans les résultats : nous contrôlons son autorisation d’exercer. Les pharmacies sont vérifiées de la même façon.',
          ),
          p('Vous êtes soignant ? Découvrez Twabibu Pro. Vous êtes pharmacien ? Découvrez Twabibu Pharma.'),
        ],
      },
      {
        title: 'Nous contacter',
        body: [
          p(
            'Une question, une suggestion ou une erreur à signaler ? Écrivez-nous depuis le formulaire de contact : nous vous répondons par e-mail.',
          ),
        ],
      },
    ],
  },

  'mentions-legales': {
    slug: 'mentions-legales',
    title: 'Mentions légales',
    description: 'Éditeur, hébergeur et propriété intellectuelle du site Twabibu.',
    legal: true,
    sections: [
      {
        title: 'Éditeur du site',
        body: [
          list(
            `Dénomination : ${LEGAL_PUBLISHER.name}`,
            `Forme juridique : ${LEGAL_PUBLISHER.legalForm}`,
            `Immatriculation : ${LEGAL_PUBLISHER.registration}`,
            `Siège : ${LEGAL_PUBLISHER.address}`,
            `Directeur ou directrice de la publication : ${LEGAL_PUBLISHER.publicationDirector}`,
            'Contact : formulaire de contact du site',
          ),
        ],
      },
      {
        title: 'Hébergement',
        body: [
          list(
            `Hébergeur : ${LEGAL_HOST.name}`,
            `Adresse : ${LEGAL_HOST.address}`,
            `Site : ${LEGAL_HOST.website}`,
          ),
        ],
      },
      {
        title: 'Nature du service',
        body: [
          p(
            'Twabibu est un service de prise de rendez-vous et de gestion de cabinet. Twabibu n’est ni un établissement de santé ni une pharmacie : la plateforme ne fournit aucun soin, aucun conseil médical et ne vend aucun médicament.',
          ),
          p(
            'Les informations affichées sur les fiches des soignants et des pharmacies sont fournies par ceux-ci et vérifiées par l’équipe Twabibu.',
          ),
          note('En cas d’urgence, rendez-vous à l’hôpital le plus proche.'),
        ],
      },
      {
        title: 'Propriété intellectuelle',
        body: [
          p(
            'Le nom Twabibu, le logo et l’ensemble des éléments du site (textes, interface, illustrations) sont protégés. Toute reproduction sans autorisation écrite est interdite.',
          ),
          p(
            'Les fonds de carte sont fournis par OpenStreetMap, © les contributeurs d’OpenStreetMap, sous licence ODbL. Les icônes proviennent de la bibliothèque libre Lucide (licence ISC).',
          ),
        ],
      },
      {
        title: 'Données personnelles',
        body: [
          p('Le traitement de vos données est décrit dans la page « Protection des données personnelles ».'),
        ],
      },
    ],
  },

  confidentialite: {
    slug: 'confidentialite',
    title: 'Protection des données personnelles',
    description:
      'Quelles données Twabibu traite, pourquoi, qui y a accès, combien de temps, et comment exercer vos droits.',
    legal: true,
    intro:
      'Twabibu traite des données de santé. Nous appliquons volontairement un niveau d’exigence inspiré du règlement européen sur la protection des données (RGPD) : ne collecter que le nécessaire, cloisonner, tracer chaque accès au dossier médical.',
    sections: [
      {
        title: 'Responsable du traitement',
        body: [
          p(
            `${LEGAL_PUBLISHER.name}, ${LEGAL_PUBLISHER.address}. Pour toute question sur vos données, écrivez-nous depuis le formulaire de contact.`,
          ),
          p(
            'Les soignants restent responsables du dossier qu’ils tiennent pour leurs patients ; Twabibu leur fournit l’outil et l’héberge.',
          ),
        ],
      },
      {
        title: 'Les données que nous traitons',
        body: [
          list(
            'Votre compte : adresse e-mail, civilité, nom, prénom, date de naissance ; si vous les indiquez, téléphone, adresse, localité et assurance.',
            'Vos proches : nom, prénom et date de naissance des personnes dont vous gérez les rendez-vous.',
            'Vos rendez-vous : soignant, lieu, date, motif choisi, statut et historique des changements.',
            'Votre dossier médical : antécédents, allergies, traitements, constantes et notes de consultation saisis par vos soignants, et ce que vous y ajoutez vous-même.',
            'Vos ordonnances et vos commandes en pharmacie : médicaments, pharmacie choisie, adresse de livraison si vous en demandez une.',
            'Des données techniques : adresse IP, type d’appareil, journaux de connexion et journal des accès à votre dossier.',
          ),
          p('Nous ne demandons pas votre numéro d’identité nationale.'),
        ],
      },
      {
        title: 'Pourquoi nous les utilisons',
        body: [
          list(
            'Prendre, confirmer, rappeler, déplacer et annuler vos rendez-vous.',
            'Permettre à vos soignants de tenir votre dossier, et de le partager entre eux si vous l’acceptez.',
            'Transmettre vos ordonnances à la pharmacie que vous choisissez et suivre vos commandes.',
            'Sécuriser le service : connexion par code, détection des abus, journal des accès.',
            'Répondre à vos demandes d’aide.',
          ),
          p(
            'Vos données ne sont jamais vendues ni utilisées pour de la publicité. Twabibu ne fait aucun traitement automatique de vos données médicales pour vous conseiller : les seules alertes affichées aux soignants sont des règles simples, comme une allergie déclarée.',
          ),
        ],
      },
      {
        title: 'Qui peut y accéder',
        body: [
          list(
            'Le cabinet où vous prenez rendez-vous voit vos coordonnées et vos rendez-vous chez lui, pas ceux pris ailleurs.',
            'Le dossier médical n’est visible que par les soignants : chacun voit ce qu’il a noté, et ce qu’ont noté vos autres soignants seulement avec votre accord.',
            'Les secrétaires, les responsables administratifs des cabinets et l’équipe Twabibu n’ont jamais accès au dossier médical.',
            'Une pharmacie ne lit une ordonnance que si vous la lui avez envoyée. Un livreur ne voit que l’adresse de livraison.',
            'L’équipe d’assistance de Twabibu voit vos coordonnées et vos rendez-vous pour vous aider ; chacune de ses actions est enregistrée.',
          ),
        ],
      },
      {
        title: 'Où sont vos données',
        body: [
          p(
            `Les données sont hébergées sur des serveurs situés en Allemagne, chez ${LEGAL_HOST.name}. Les sauvegardes sont chiffrées.`,
          ),
          list(
            'Cloudflare protège le site contre les attaques et accélère son affichage ; le trafic transite par son réseau.',
            'Un prestataire d’envoi d’e-mails transmet les codes de connexion, les confirmations et les rappels. Ces messages ne contiennent jamais d’information médicale.',
            'Les cartes sont affichées à partir des serveurs d’OpenStreetMap : votre navigateur leur transmet votre adresse IP pour charger la carte.',
          ),
        ],
      },
      {
        title: 'Combien de temps',
        body: [
          list(
            'Compte sans activité pendant 3 ans : il est anonymisé.',
            'Journaux techniques et de connexion : 1 an.',
            'Sauvegardes : 35 jours.',
            'Codes de connexion : 5 minutes.',
          ),
          p(
            'Les notes de vos soignants font aussi partie du dossier qu’ils doivent tenir : leur durée de conservation suit les règles qui s’imposent aux soignants. Elle sera précisée ici à l’issue de la validation juridique.',
          ),
        ],
      },
      {
        title: 'Comment nous les protégeons',
        body: [
          list(
            'Connexion chiffrée (HTTPS) sur tout le site.',
            'Notes de consultation chiffrées dans la base de données.',
            'Codes de connexion à usage unique, valables 5 minutes, jamais conservés en clair.',
            'Cloisonnement strict entre cabinets, et journal de chaque consultation du dossier médical.',
          ),
        ],
      },
      {
        title: 'Vos droits',
        body: [
          p(
            'Vous pouvez consulter et corriger vos données, demander leur suppression, retirer votre accord au partage de votre dossier et refuser les rappels.',
          ),
          list(
            '« Mon profil » : vos coordonnées, vos préférences de rappel et vos appareils connectés.',
            '« Partage de mon dossier » : votre accord et l’historique des accès.',
            'Pour une copie de vos données ou la suppression de votre compte : écrivez-nous depuis le formulaire de contact. Nous vérifions votre identité avant d’agir.',
          ),
        ],
      },
      {
        title: 'Cookies',
        body: [
          p(
            'Twabibu n’utilise que les cookies nécessaires au fonctionnement du site, ce qui explique l’absence de bandeau de consentement :',
          ),
          list(
            'tw_session : garde votre connexion pendant 30 jours au plus, sur cet appareil.',
            'tw_bsid : garde le créneau choisi pendant que vous terminez une réservation.',
          ),
          p('Aucun cookie publicitaire et aucun outil de mesure d’audience.'),
        ],
      },
      {
        title: 'Évolution de cette page',
        body: [
          p(
            'Nous vous informerons par e-mail de tout changement important. La date de mise à jour figure en haut de la page.',
          ),
        ],
      },
    ],
  },

  cgu: {
    slug: 'cgu',
    title: 'Conditions générales d’utilisation',
    description: 'Les règles d’utilisation de Twabibu pour les patients.',
    legal: true,
    intro:
      'Ces conditions s’appliquent à toute personne qui utilise Twabibu pour chercher un soignant, prendre rendez-vous ou suivre ses ordonnances. Les soignants et les pharmacies ont en plus leurs propres conditions.',
    sections: [
      {
        title: 'Le service',
        body: [
          p(
            'Twabibu vous permet de trouver un soignant, de prendre et gérer vos rendez-vous et ceux de vos proches, de consulter votre dossier médical et vos ordonnances, et de commander auprès des pharmacies.',
          ),
          p(
            'Twabibu est un outil. Ce n’est ni un établissement de santé ni une pharmacie : nous ne fournissons aucun soin, aucun diagnostic, aucun conseil médical, et nous ne vendons aucun médicament.',
          ),
          note(
            'Twabibu n’est pas un service d’urgence. En cas d’urgence, rendez-vous à l’hôpital le plus proche.',
          ),
        ],
      },
      {
        title: 'Prix',
        body: [
          p(
            'Twabibu est gratuit pour les patients. Les consultations se règlent au cabinet et les produits de pharmacie à la pharmacie, aux conditions de chacun.',
          ),
        ],
      },
      {
        title: 'Votre compte',
        body: [
          list(
            'Vous vous connectez avec votre adresse e-mail et un code à usage unique. Ne communiquez jamais ce code.',
            'Les informations que vous donnez doivent être exactes : le cabinet s’en sert pour vous accueillir.',
            'Vous pouvez gérer les rendez-vous d’un proche seulement si vous en avez la charge ou son accord.',
            'Vous pouvez supprimer votre compte à tout moment en nous écrivant.',
          ),
        ],
      },
      {
        title: 'Vos rendez-vous',
        body: [
          list(
            'Un rendez-vous est confirmé quand vous recevez la confirmation. Si le cabinet valide les demandes lui-même, il reste en attente jusqu’à sa réponse.',
            'Si vous ne pouvez pas venir, annulez ou déplacez dans le délai fixé par le cabinet, pour libérer la place. Passé ce délai, appelez le cabinet.',
            'Un cabinet peut déplacer ou annuler un rendez-vous ; vous en êtes prévenu.',
            'Des absences répétées sans prévenir peuvent conduire un cabinet à bloquer vos réservations en ligne chez lui.',
          ),
          p('La consultation elle-même relève de la seule responsabilité du soignant.'),
        ],
      },
      {
        title: 'Dossier médical et ordonnances',
        body: [
          p(
            'Votre dossier est tenu par vos soignants. Vous décidez s’il est partagé entre eux, et vous pouvez retirer votre accord à tout moment.',
          ),
          p(
            'Une ordonnance est rédigée et signée par le soignant. Elle porte un code de vérification. Vous choisissez librement la pharmacie à laquelle l’envoyer.',
          ),
        ],
      },
      {
        title: 'Pharmacies et commandes',
        body: [
          p(
            'Une commande est passée auprès de la pharmacie, qui reste seule responsable de la délivrance, du prix, du paiement et, le cas échéant, de la livraison. Certains médicaments ne peuvent être délivrés que sur ordonnance.',
          ),
          p(
            'Les mentions « Pharmacie partenaire » signalent un espace sponsorisé. Elles sont toujours indiquées comme telles et ne changent pas la liste des pharmacies de garde. Aucune publicité n’est faite pour un médicament sur ordonnance.',
          ),
        ],
      },
      {
        title: 'Utilisation loyale',
        body: [
          p(
            'Il est interdit de créer un faux compte, de réserver des créneaux sans intention de venir, de gêner le fonctionnement du service ou de tenter d’accéder aux données d’autrui. Nous pouvons suspendre un compte qui ne respecte pas ces règles.',
          ),
        ],
      },
      {
        title: 'Disponibilité',
        body: [
          p(
            'Nous faisons notre possible pour que Twabibu soit accessible à tout moment, mais des interruptions (maintenance, panne de réseau) peuvent arriver. En cas de doute sur un rendez-vous, appelez le cabinet.',
          ),
        ],
      },
      {
        title: 'Données personnelles',
        body: [
          p('Le traitement de vos données est décrit dans la page « Protection des données personnelles ».'),
        ],
      },
      {
        title: 'Modifications et droit applicable',
        body: [
          p(
            'Nous pouvons faire évoluer ces conditions ; vous serez informé de tout changement important. Ces conditions sont soumises au droit de l’Union des Comores.',
          ),
          p(
            'Une question ou un désaccord ? Écrivez-nous d’abord depuis le formulaire de contact : nous cherchons toujours une solution amiable.',
          ),
        ],
      },
    ],
  },
};
