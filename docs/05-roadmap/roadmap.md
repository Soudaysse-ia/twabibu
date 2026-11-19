# Roadmap

Hypothèse de rythme : une équipe de 2 à 3 personnes qui pilotent des modèles Claude (plusieurs sessions en parallèle sur des tickets indépendants) + 1 designer à temps partiel. Les durées sont des ordres de grandeur ; chaque phase se termine par une démo et une revue.

## Phase 0 — Fondations (semaines 1–2)
**But** : un monorepo qui tourne, un design system, une base de données, une CI, pour que tous les tickets suivants puissent démarrer en parallèle.
- INFRA-01 monorepo pnpm/Turborepo, lint/prettier/tsconfig partagés, `.env.example`, Docker Compose dev (Postgres, Redis, MinIO, Mailpit).
- INFRA-02 CI GitHub Actions (lint, typecheck, test, build), Dependabot.
- DATA-01 schéma Prisma initial (toutes les entités de `modele-de-donnees.md`), migrations, seed (îles, localités, spécialités, langues, jours fériés, jeu de démo).
- DATA-03 contrainte d'exclusion anti-chevauchement (SQL).
- API-01 squelette NestJS : config, Prisma, Redis, BullMQ, OpenAPI, health, erreurs typées, logging pino, Sentry.
- CONTRACTS-01 `packages/contracts` : enums, schémas Zod des entités publiques, erreurs.
- DESIGN-01 `packages/tokens` (depuis `design-tokens.json`) → CSS variables + preset Tailwind + objet RN.
- DESIGN-02 logo SVG Twabibu + icône app + favicon + `og:image` par défaut.
- UI-01 `packages/ui` : fondations + Button, TextField, PhoneField, OtpField, Card, Chip, SlotChip, Modal/Drawer, Toast, Skeleton, Header, Footer + Storybook.
- WEB-01 `apps/web` : Next.js, layouts (public/pro/compte), `next-intl`, polices, PWA manifest, page d'accueil statique avec SearchBar (sans résultats).
- AVAIL-01/02 moteur de disponibilités + tests (peut démarrer dès que les types existent).
**Livrable** : `pnpm dev` lance tout ; Storybook publié ; accueil Twabibu visible ; moteur de créneaux testé.

## Phase 1 — MVP patient + agenda minimal (semaines 3–6)
**But** : un patient réserve un vrai créneau chez un vrai soignant et reçoit un SMS.
- SEARCH-01…10 (recherche, résultats, filtres, carte, SEO).
- PROFILE-01…07 (profil public).
- AVAIL-03…06 (service, verrous, cache).
- BOOK-01…09 (tunnel).
- AUTH-01…04, ACCOUNT-01…03 (compte patient).
- NOTIF-01…05 (SMS fake + Twilio/Infobip, confirmations, rappels).
- PRO-01…03 (inscription soignant, onboarding, pièces), AGENDA-01…05 (agendas, motifs, plages, absences, grille, tiroir RDV), PATIENT-01…03 (fiche de base).
- ADMIN-01…03, 06 (back-office : vérification, référentiels).
- RECORD-01…03 (dossier médical : synthèse, antécédents/allergies/traitements, consultation structurée) et RX-01…04 (référentiel médicaments, éditeur d'ordonnance, alertes, PDF signé avec QR) : dès le MVP, c'est l'argument d'adoption des médecins.
- PHARM-01, 02 (annuaire des pharmacies et **pharmacies de garde**, page publique et bloc accueil).
- QA-01 Playwright e2e des parcours P1, P2, P3 ; QA-02 audit accessibilité ; QA-03 budget performance.
**Livrable** : déploiement staging, 5 cabinets pilotes à Moroni/Mutsamudu avec de vrais SMS, retours hebdomadaires ; les médecins pilotes rédigent leurs ordonnances dans Twabibu.

## Phase 2 — Twabibu Pro complet + écosystème pharmacies (semaines 7–12)
- AGENDA-06…10 (glisser-déposer, validation manuelle, mobile Pro, impression).
- PATIENT-04…07 (notes, blocage/fusion, import).
- PRO-04…09 (permissions fines, équipe, journal).
- NOTIF-06…08 (préférences, STOP, quotas, journal), rappels J-2 + demande de confirmation.
- DOC-01…05 (documents).
- ACCOUNT-04…06 (mes soignants, export/suppression), liste d'attente (BOOK-10, AGENDA-11).
- ADMIN-04, 05, 07, 08, 09 (support, signalements, abonnements, journaux).
- RECORD-04…08 (constantes et courbes, résultats, suivi des chroniques, carnet patient et consentement, export), RX-05…07 (dispensations, côté patient, ordonnances labo/imagerie).
- PHARM-03…07 (catalogue et comparateur, réception d'ordonnances, commandes retrait/livraison, Twabibu Pharma, espaces sponsorisés).
**Livrable** : offres « Agenda », « Cabinet » et « Pharma » commercialisables ; 30 cabinets, 15 pharmacies, première boucle complète RDV → ordonnance → dispensation.

## Phase 3 — Établissements, SEO, robustesse (semaines 13–16)
- ORG-01…05, 07.
- SEO : pages spécialité × localité complètes, index alphabétique, sitemap, performances.
- SEC-01…04 : revue de sécurité, tests IDOR, chiffrement des notes, sauvegardes testées, runbooks.
- INFRA-03 production (VPS, Caddy, Cloudflare, sauvegardes, supervision), INFRA-04 déploiement par tag, INFRA-05 alertes.
- LEGAL-01 : CGU/CGV/confidentialité validées, consultation juridique ; LEGAL-02 : validité de l'ordonnance numérique et cadre de la vente/livraison de médicaments.
- PHARM-08 (statistiques), REF-02 (maintenance du référentiel médicaments).
**Livrable** : **lancement public web** aux Comores.

## Phase 4 — Applications mobiles (semaines 17–22)
- MOBILE-01 Expo + Expo Router + `ui-native` + tokens ; MOBILE-02 auth OTP + stockage sécurisé ; MOBILE-03 recherche + résultats + carte ; MOBILE-04 profil + tunnel ; MOBILE-05 mes rendez-vous / proches / documents ; MOBILE-06 push (Expo Notifications) ; MOBILE-07 app Pro (agenda jour, statuts, création RDV, dossier en lecture, ordonnance rapide, notifications) ; PHARM-09 onglet « Pharmacies de garde » et commandes dans l'app patient, app Twabibu Pharma (ordonnances reçues, commandes) ; MOBILE-08 EAS Build, TestFlight / Play interne, fiches stores (captures, textes), publication.
**Livrable** : Twabibu sur Google Play et App Store ; Twabibu Pro mobile en bêta.

## Phase 5 — Extension (à partir de la semaine 23)
livreurs partenaires et suivi de livraison, API catalogue pour les logiciels de stock, résultats de laboratoire numériques, WhatsApp Business (NOTIF-09), messagerie (MSG-01…04), paiements mobile money (PAY-01…03 : abonnements pro, puis acomptes patient si demandé), shikomori/arabe (I18N-02), ressources partagées (ORG-06), modèles de documents (DOC-06), statistiques avancées, API partenaires (laboratoires, pharmacies), téléconsultation **uniquement si décidée explicitement** (ADR-008).

## Jalons et critères de sortie
| Jalon | Critère |
|---|---|
| M0 Fondations | CI verte, Storybook, accueil déployé en staging |
| M1 Premier RDV réel | un RDV pris par un patient pilote, SMS reçu, visible dans l'agenda du cabinet |
| M2 Pro complet + Pharma | 30 cabinets et 15 pharmacies actifs, 500 ordonnances numériques émises, < 2 % d'erreurs de notification, NPS soignants ≥ 40 |
| M3 Lancement public | 100 soignants vérifiés, Lighthouse ≥ 85 mobile, sauvegarde restaurée avec succès, mentions légales publiées |
| M4 Apps | apps publiées, ≥ 4,5 ★ sur les 100 premières notes, crash-free ≥ 99,5 % |

## Risques et parades
| Risque | Parade |
|---|---|
| Délivrabilité / coût des SMS | Deux fournisseurs dès le départ, négociation opérateur locale, WhatsApp en phase 5, surveillance des échecs |
| Adoption lente des soignants | Offre gratuite « Découverte », onboarding assisté sur site, import de patientèle, ambassadeurs par île |
| Adresses imprécises | Référentiel de localités + marqueur positionné par le soignant + description d'accès en texte |
| Connectivité | SSR, pages légères, PWA, SMS comme canal fiable |
| Données de santé | Chiffrement, droits, audit, hébergement UE, revue de sécurité phase 3 |
| Dérive de périmètre (vidéo, IA) | ADR-008, backlog verrouillé par phase |
| Cadre juridique de l'ordonnance numérique et de la livraison de médicaments | LEGAL-02 avant la phase 2 ; PDF signé + QR comme référence ; produits contrôlés jamais en ligne |
| Référentiel médicaments incomplet | Import LNME + DCI, enrichissement par les pharmacies, validation back-office |
| Médecins qui n'écrivent pas dans le dossier | Modèles par spécialité, saisie < 2 min testée avec les pilotes, synthèse visible à chaque RDV, valeur immédiate (ordonnance plus rapide) |
