# CLAUDE.md — Guide pour tout modèle Claude travaillant sur Twabibu

Tu travailles sur **Twabibu**, la plateforme de santé des Comores : prise de rendez-vous (clone fonctionnel et visuel de Doctolib France, **sans téléconsultation**), dossier médical complet, ordonnance numérique et écosystème pharmacies (gardes, catalogue, commandes, livraison). Lis ce fichier en entier avant d'agir.

## 1. Où regarder (dans cet ordre)
1. `docs/00-PLAN-COMPLET.md` — le plan global (5 minutes de lecture).
2. `docs/01-produit/vision-et-perimetre.md` — ce qu'on construit, ce qu'on ne construit pas ; `docs/01-produit/ecosysteme-soins.md` — la boucle patient → médecin → pharmacie.
3. `docs/03-architecture/architecture-technique.md` + `modele-de-donnees.md` + `api.md` — comment c'est construit.
4. `docs/02-design/direction-artistique.md` + `design-tokens.json` + `composants-ui.md` — à quoi ça ressemble.
5. La spec du module que tu touches dans `docs/04-specs/` — règles, écrans, critères d'acceptation, tickets.
6. `docs/05-roadmap/backlog-epics.md` — le ticket que tu réalises et ses dépendances.
7. `docs/03-architecture/decisions-adr.md` — ne reviens pas sur une décision sans ADR.

## 2. Règles absolues
- **Pas de téléconsultation, pas de vidéo, pas d'IA** dans le produit (ADR-008, périmètre). Si on te le demande, rappelle l'ADR et demande une décision explicite.
- **Structure visuelle Doctolib, identité Twabibu** : bleu Twabibu `#2A6BCB` comme `primary` (bleu du logo éclairci), thème clair uniquement, aucune forme décorative en fond, logo officiel de `assets/brand/` (jamais recomposé en texte), signature « À vos côtés, dans chaque temps de soin. ». Utilise uniquement les tokens de `docs/02-design/design-tokens.json` (via `packages/tokens`). Jamais de couleur ou de police en dur. Jamais le logo, les images ou le nom Doctolib dans le produit.
- **Twabibu ne vend pas de médicaments et ne donne aucun conseil médical automatique** : les pharmacies dispensent, les médecins prescrivent, les alertes sont des règles (allergie, doublon), pas de l'IA (ADR-012).
- **Dossier médical** : accessible aux praticiens seulement, avec consentement du patient (ou entrées propres) ; chaque lecture est journalisée ; secrétaires, admins et back-office n'y accèdent jamais (SPEC-13).
- **Code en anglais, interface et docs en français** (ADR-010). Vouvoiement dans l'UI. Textes dans `packages/i18n`, jamais en dur dans les composants.
- **Données de santé** : pas de donnée médicale dans les SMS/e-mails/logs/URL ; notes cliniques chiffrées ; chaque route Pro vérifie l'appartenance (`MembershipGuard`) et les permissions ; tests IDOR pour toute route avec identifiant. Voir `securite-et-donnees-sante.md`.
- **Identité par e-mail** (ADR-016) : jamais de téléphone obligatoire pour créer un compte ; le SMS ne sert qu’aux patients inscrits par le cabinet sans e-mail.
- **Fuseau Indian/Comoro, devise KMF, téléphone +269** : utilise `packages/utils` (dates, téléphone, monnaie). Stockage UTC.
- **Un créneau n'est jamais créé hors du moteur** `packages/availability` + verrou Redis (SPEC-12).
- **Mobile d'abord** : chaque écran est vérifié à 375 px et à 1280 px. Cibles tactiles 44 px, texte 16 px dans les champs sur mobile.
- **Accessibilité AA** : labels, focus visible, contraste, navigation clavier, `aria-live` pour les confirmations.
- Ne modifie pas une migration déjà fusionnée ; ajoute-en une nouvelle.
- Ne commits/pushes que si on te le demande ; messages de commit en anglais, format `type(scope): message` (`feat(booking): lock slot before identification`).

## 3. Stack (résumé)
pnpm + Turborepo · TypeScript 6 strict · Next.js 16 App Router (web, admin) · NestJS 12 + Prisma 6.19 + PostgreSQL 16 + Redis 7 + BullMQ (api, worker) — versions : ADR-013 · Tailwind CSS 4 + shadcn/ui/Radix (`packages/ui`) · Expo + Expo Router (mobile) · Zod (`packages/contracts`) · Vitest, Supertest, Playwright, Storybook · Docker Compose · GitHub Actions.

## 4. Structure
```
apps/web  apps/admin (back-office, port 3200)  apps/api  apps/mobile
packages/contracts  api-client  tokens  ui  ui-native  i18n  availability  config  utils
infra/docker  infra/caddy  infra/scripts
docs/  CLAUDE.md  README.md
```
Un module NestJS par domaine (`auth`, `users`, `patients`, `directory`, `practitioners`, `organizations`, `agendas`, `availability`, `appointments`, `search`, `notifications`, `documents`, `clinical-notes`, `medical-records`, `prescriptions`, `pharmacies`, `billing`, `admin`, `audit`). Un dossier par composant UI avec `.stories.tsx` et `.test.tsx`.

## 5. Lexique (code ↔ interface)
| Code | Interface (fr) |
|---|---|
| `Practitioner` | soignant (côté patient) / praticien (côté Pro) |
| `Practice` | lieu de consultation, cabinet |
| `Organization` | cabinet / établissement / structure |
| `Agenda` | agenda |
| `Motive` | motif de consultation |
| `AvailabilityRule` | plage de disponibilité en ligne |
| `Absence` | absence / congé / blocage |
| `Slot` | créneau |
| `Appointment` | rendez-vous (RDV) |
| `PatientProfile` | compte patient |
| `Relative` | proche |
| `PatientRecord` | fiche patient (du cabinet) |
| `ClinicalNote` | note de consultation |
| `Membership` / `SECRETARY` | membre de l'équipe / secrétaire |
| `VerificationDocument` | pièce justificative |
| `Locality` / `Island` | localité / île |
| `MedicalRecord` / `Consultation` | dossier médical / consultation |
| `Allergy`, `CurrentTreatment`, `Vital`, `FollowUpPlan` | allergie, traitement en cours, constante, suivi |
| `Prescription` / `PrescriptionLine` / `Dispensation` | ordonnance / ligne / dispensation (délivrance) |
| `Drug` | médicament (référentiel) |
| `Organization(type=PHARMACY)` / `PharmacyProduct` | pharmacie / produit du catalogue |
| `DutySchedule` | garde (pharmacie de garde) |
| `Order` | commande |
| `SponsoredPlacement` | espace sponsorisé (« Pharmacie partenaire ») |

## 6. Commandes
Prérequis : Node 24 (`.nvmrc`), pnpm 9, PostgreSQL 16 et Redis 7 (Homebrew sur le poste d'origine, ou `docker compose -f infra/docker/docker-compose.dev.yml up -d`, non testé). Copier `.env.example` en `.env` et remplacer `<utilisateur>`.
```bash
pnpm install
pnpm db:deploy      # applique les migrations (non interactif)
pnpm db:seed        # référentiels + démo fictive (jamais en production)
pnpm build          # paquets, API, site
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter @twabibu/api start   # API sur :4000, documentation sur /v1/docs
pnpm --filter @twabibu/web dev     # site sur :3100
```
- Nouvelle migration : modifier `apps/api/prisma/schema.prisma`, puis `pnpm db:migrate` dans un terminal interactif. Pour du SQL écrit à la main (contraintes, index spéciaux), créer le dossier de migration puis `pnpm db:deploy`. Toujours vérifier l'absence d'écart avec `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <base vide> --script` (résultat attendu : migration vide).
- Dans `packages/ui`, imports internes sans extension ; ailleurs, imports relatifs en `.js`.
- Connexion par e-mail et code à 6 chiffres (ADR-016). En dev : `EMAIL_PROVIDER=fake` et `SMS_PROVIDER=fake`, le code est toujours `000000`, les messages envoyés sont lisibles sur `GET /v1/dev/messages?to=<e-mail ou +269…>`.
- Comptes de démonstration après `pnpm db:seed` : patient à créer soi-même sur le site (n’importe quelle adresse e-mail) ; Twabibu Pro (`/pro/connexion`) : praticienne `amina.said@demo.twabibu.km`, secrétaire `secretariat@demo.twabibu.km`, responsable `direction@demo.twabibu.km` ; Twabibu Pharma (`/pharma/connexion`) : titulaire `titulaire.port@demo.twabibu.km`, préparateur `preparateur.port@demo.twabibu.km`, autre pharmacie `titulaire.medina@demo.twabibu.km`. Back-office (`pnpm --filter @twabibu/admin dev`, port 3200) : `admin@demo.twabibu.km` (tous les droits), `verification@demo.twabibu.km`, `support@demo.twabibu.km` ; code e-mail puis code d’authentification, tous deux `000000` en local. En production, créer un administrateur avec `pnpm --filter @twabibu/api admin:create <e-mail> <RÔLE>`. Le calendrier des gardes de démo est recréé à chaque `pnpm db:seed` (relancer le seed si « aujourd’hui » n’a plus de garde).
- Référentiels (spécialités, localités, jours fériés, médicaments) : gérés dans le back-office (ADR-019). Le seed ne crée que les lignes manquantes ; ne pas compter sur `pnpm db:seed` pour corriger une base existante.
- Rappels de rendez-vous : tâche BullMQ `reminder-scheduler` toutes les 15 min (file `reminders`), logique dans `apps/api/src/notifications/reminder-rules.ts` (testée avec une horloge simulée). Désactivée en `NODE_ENV=test`.
- Version de démonstration hébergée : construire le site avec `NEXT_PUBLIC_DEMO_MODE=true` (page `/demo`, bandeau, comptes affichés sur les pages de connexion) et l’API avec `EMAIL_PROVIDER=fake` et `SMS_PROVIDER=fake`. En développement, ces aides sont toujours visibles. Jamais en production.
- Parcours de bout en bout (QA-01) : `apps/web/e2e/*.e2e.ts` (Playwright). Avec l’API (:4000), le site (:3100) et le back-office (:3200) lancés sur une base semée : `pnpm --filter @twabibu/web e2e`. Ils tournent aussi en CI (job « Parcours de bout en bout »).
- Mise en production (ADR-020) : images `infra/docker/*.Dockerfile`, `infra/docker/docker-compose.prod.yml`, `infra/caddy/Caddyfile`, scripts serveur `infra/scripts/` (déploiement, retour arrière, sauvegarde, restauration), workflow `.github/workflows/deploy.yml` (pré-production sur `main`, production sur tag `vX.Y.Z`). Procédures dans `docs/03-architecture/runbooks/`. Une migration doit toujours rester compatible avec la version précédente (le retour arrière ne la défait pas).
- Journaux de livraison : `docs/05-roadmap/journal-phase-0.md`, `journal-phase-1.md`.

## 7. Comment réaliser un ticket
1. Lis la spec et le ticket ; liste les critères d'acceptation ; vérifie les dépendances dans `backlog-epics.md` (si une dépendance n'est pas faite, dis-le et arrête-toi).
2. Regarde le code existant du module (`apps/api/src/<module>`, `apps/web/app/...`, `packages/...`) et réutilise les composants/services existants avant d'en créer.
3. Implémente : contrats Zod → migration Prisma (si besoin) → service + tests → contrôleur → client → UI + story → e2e si parcours.
4. Vérifie : `pnpm lint && pnpm typecheck && pnpm test`, puis l'écran à 375 px et 1280 px (capture), puis chaque critère d'acceptation coché dans ta réponse.
5. Mets à jour `backlog-epics.md` (☐ → ☑), la spec si tu as découvert une règle manquante, et ajoute un ADR si tu as pris une décision structurante.
6. Rends compte en français : ce qui est fait, ce qui ne l'est pas, comment vérifier.

## 8. Modèle de prompt pour lancer une session sur un ticket
```
Tu travailles sur Twabibu (lis CLAUDE.md). Réalise le ticket <ID> « <titre> » décrit dans docs/04-specs/<SPEC>.md (section Tickets) et docs/05-roadmap/backlog-epics.md.
Dépendances déjà faites : <liste>. Fichiers attendus : <liste>.
Critères d'acceptation : ceux de la spec. Vérification : pnpm lint && pnpm typecheck && pnpm test (+ capture 375 px / 1280 px si UI).
Ne touche pas aux autres modules. Ne commite pas. Termine par un compte rendu en français.
```

## 9. Quand demander avant d'agir
- Toute fonctionnalité absente des specs (surtout vidéo, IA, paiement, vente directe de médicaments).
- Tout changement de stack, de schéma partagé (`User`, `Appointment`) ou de tokens de design.
- Toute suppression de données, toute action sur la production, tout envoi réel de SMS ou d’e-mail.
