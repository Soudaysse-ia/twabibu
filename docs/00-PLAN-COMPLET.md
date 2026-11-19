# Twabibu — Plan complet de construction

> Version 1.1 — 11 novembre 2026 (ajout : logo officiel, dossier médical, ordonnance numérique, pharmacies). Rédigé par Fable 5 (Claude) à partir du dossier « Doctolib — Comprendre la plateforme et son fonctionnement » et de l'analyse en direct de doctolib.fr / info.doctolib.fr. Ce document est la synthèse ; chaque section renvoie au détail.

## 1. En une page

**Quoi.** Twabibu est le Doctolib des Comores, étendu à tout le parcours de soin : les patients trouvent un soignant sur les trois îles et réservent en ligne ; les médecins travaillent dans **Twabibu Pro** avec agenda, secrétariat, **dossier médical complet** (antécédents, allergies, traitements, constantes, consultations) et **ordonnance numérique** ; les **pharmacies** (Twabibu Pharma) publient gardes, catalogue et prix, reçoivent les ordonnances, livrent, et louent des espaces sponsorisés ; les établissements administrent plusieurs praticiens et sites ; l'équipe Twabibu vérifie et pilote. **Pas de téléconsultation, pas d'IA, pas de vente de médicaments par Twabibu.** Signature : *À vos côtés, dans chaque temps de soin.*

**Comment.** Un site web responsive d'abord (Next.js), une API dédiée (NestJS + PostgreSQL) consommée ensuite par les applications Android et iOS (Expo). Structure visuelle de Doctolib (en-tête colorée, barre de recherche pilule, cartes blanches sur fond bleu pâle, Montserrat/Roboto) avec l'identité Twabibu : logo officiel (stéthoscope), bleu `#2A6BCB`, thème clair sans formes décoratives. Identifiant patient = téléphone + code SMS. Hébergement chiffré en Europe, sauvegardes, journal d'audit.

**Quand.** 5 phases : fondations (2 sem.) → MVP patient + agenda + dossier/ordonnance de base + pharmacies de garde (4 sem.) → Pro complet + écosystème pharmacies (6 sem.) → établissements, sécurité, lancement public web (4 sem.) → apps mobiles (6 sem.) → extensions (livreurs, WhatsApp, messagerie, mobile money, shikomori).

**Avec qui.** Une petite équipe qui distribue des **tickets autonomes** à des sessions Claude (Opus/Sonnet/Haiku) grâce à `CLAUDE.md`, aux 15 specs et au backlog (≈ 175 tickets). Fable 5 tient le rôle d'architecte : specs, revues, arbitrages.

**Pourquoi le médecin ne pourra plus s'en passer.** Le dossier arrive avant le patient (allergies, traitements, antécédents, constantes sur un écran), la consultation s'écrit en deux minutes sur un modèle, l'ordonnance se rédige plus vite qu'à la main avec alertes allergies, la pharmacie confirme la dispensation, les patients reviennent grâce aux rappels et au suivi des chroniques. Détail : `docs/01-produit/ecosysteme-soins.md`.

## 2. Ce que nous reproduisons de Doctolib (inventaire)
Détail : `docs/01-produit/analyse-doctolib.md` et `docs/01-produit/fonctionnalites-twabibu.md`.

| Côté patient | Côté soignant (Twabibu Pro) | Plateforme |
|---|---|---|
| Recherche quoi/où, autocomplétion, « autour de moi » | Agenda jour/semaine/mois, multi-agendas | Vérification des soignants (pièces) |
| Résultats avec grille de créneaux sur 5 jours, filtres, carte | Motifs (durée, couleur, en ligne, consignes, questions, tarif, délais) | Référentiels (spécialités, localités, langues, assurances) |
| Profil riche (adresses, accès, présentation, tarifs, horaires, langues, formations, FAQ) | Plages réservables en ligne, règles (délai, horizon, max RDV, validation) | Support, modération, signalements |
| Tunnel : lieu → motif → créneau → identification → pour qui → consignes → confirmation | Absences avec RDV impactés et actions | Abonnements et factures |
| Compte : rendez-vous (annuler/déplacer), proches, soignants, documents, sécurité | Prise de RDV par le cabinet, statuts (arrivé, terminé, non honoré) | Statistiques, journaux, feature flags |
| Rappels SMS/e-mail, liste d'attente | Patientèle : fiche, historique, notes, documents, blocage, import | |
| Pages SEO spécialité × ville | Équipe : rôles praticien/secrétaire/admin, invitations, journal | |
| PWA puis apps mobiles | Documents vers le patient, établissements multi-sites, tableau de bord | |

**Au-delà de Doctolib (écosystème, ADR-012)** : dossier médical complet avec consentement et carnet du patient (SPEC-13) · ordonnance numérique signée, QR, envoi à la pharmacie, dispensation (SPEC-14) · pharmacies : **pharmacies de garde** publiques, catalogue et prix, comparateur, ordonnances reçues, commandes avec retrait ou livraison, espaces sponsorisés « Pharmacie partenaire » (SPEC-15).

Exclusions : vidéo/téléconsultation, assistants IA, vente de médicaments par Twabibu, facturation à l'assurance, paiement patient obligatoire.

## 3. Adaptations Comores
Téléphone +269 comme identifiant · 3 îles et ~60 localités comme pivot géographique · tarifs en KMF, assurances locales · SMS d'abord puis WhatsApp · français puis shikomori/arabe · fuseau Indian/Comoro · vérification documentaire des soignants (pas de RPPS) · pages légères pour la 3G · encaissement manuel puis mobile money (MVola, Huri Money). Détail : `docs/01-produit/vision-et-perimetre.md` §4 et `docs/07-references/contexte-comores.md`.

## 4. Direction artistique
Logo officiel fourni (stéthoscope blanc, wordmark, signature, fond `#1956B4`) dans `assets/brand/` ; structure visuelle mesurée sur Doctolib et transposée : `docs/02-design/direction-artistique.md`, tokens v1.1 `design-tokens.json`, bibliothèque de composants `composants-ui.md`, inventaire des ~90 écrans `pages-et-ecrans.md` (dont Twabibu Pharma). Photos en contexte comorien. Mobile d'abord, accessibilité AA.

## 5. Architecture
Monorepo TypeScript (pnpm/Turborepo) : `apps/web` (Next.js 15), `apps/admin`, `apps/api` (NestJS 11 + Prisma + PostgreSQL 16 + Redis + BullMQ), `apps/mobile` (Expo), packages partagés (`contracts` Zod, `api-client`, `tokens`, `ui`, `ui-native`, `i18n`, `availability`, `utils`). Moteur de disponibilités pur et testé + verrous Redis + contrainte SQL anti-chevauchement. Cartes OpenStreetMap. SMS via agrégateur puis opérateur local. VPS Docker Compose en UE derrière Cloudflare, CI GitHub Actions. Détail : `docs/03-architecture/` (technique, données, API, sécurité, infra, ADR).

## 6. Spécifications
15 specs prêtes à implémenter dans `docs/04-specs/` : recherche, profil, tunnel, compte patient, agenda Pro, patientèle, cabinet/rôles/onboarding, notifications, documents/messagerie, établissements, back-office, moteur de disponibilités, **dossier médical, ordonnance numérique, pharmacies**. Chacune : règles, écrans, API, cas limites, critères d'acceptation, tickets. Le moteur de disponibilités (SPEC-12) et le dossier médical (SPEC-13) sont les deux cœurs.

## 7. Roadmap et organisation du travail
`docs/05-roadmap/roadmap.md` (phases, jalons, risques) et `backlog-epics.md` (≈ 175 tickets par epic, ordre de lancement). Mobile : `docs/06-mobile/strategie-mobile.md`. Pour confier un ticket à un modèle Claude : modèle de prompt dans `CLAUDE.md` §8.

### Prochaines actions immédiates
1. Valider ce plan et les arbitrages (nom des offres, tarifs indicatifs, hébergeur, fournisseur SMS).
2. Réserver `twabibu.km` / `twabibu.com`, créer les comptes (GitHub, Cloudflare, hébergeur, Twilio/Infobip, Sentry, Apple/Google plus tard).
3. Lancer la **phase 0** : ticket INFRA-01 (monorepo) puis, en parallèle, DATA-01, API-01, CONTRACTS-01, DESIGN-01/02, AVAIL-01.
4. Commander les photos (contexte comorien) ; le logo est livré.
5. Identifier 5 cabinets pilotes (Moroni, Mutsamudu) et 3 pharmacies pilotes pour la phase 1 ; obtenir le calendrier officiel des gardes et la liste nationale des médicaments essentiels.
6. Lancer la consultation juridique sur l'ordonnance numérique et la livraison de médicaments (LEGAL-02).

## 8. Décisions à prendre par l'équipe (non bloquantes pour la phase 0)
| Sujet | Recommandation |
|---|---|
| Hébergeur | VPS Hetzner (UE) + Cloudflare ; alternative managée notée dans l'ADR-009 |
| Fournisseur SMS initial | Twilio **et** Infobip en test de délivrabilité sur les deux opérateurs ; garder le meilleur |
| Réservation sans compte (invité) | Non en V1 (compte par OTP = 30 s) ; réévaluer après les pilotes |
| Tarifs des offres | Hypothèses dans `modele-economique.md` ; valider avec 5 cabinets |
| Nom public de l'espace soignant | « Twabibu Pro » |
| Diaspora | Autoriser les indicatifs étrangers dès la V1 |
| Ordonnance numérique | PDF signé + QR comme référence tant que LEGAL-02 n'a pas confirmé la validité du tout-numérique |
| Commandes en pharmacie | Paiement au comptoir ou à la livraison en V1 ; mobile money en V2 ; produits contrôlés jamais en ligne |
| Espaces sponsorisés | 3 emplacements par île, toujours libellés « Partenaire », jamais de publicité pour un médicament sur ordonnance |
