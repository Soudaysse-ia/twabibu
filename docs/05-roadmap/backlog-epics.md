# Backlog par epics — tickets prêts à distribuer

Chaque ticket est conçu pour être confié à **une session Claude** (ou un développeur) de façon autonome. Format minimal d'un ticket quand on le lance : identifiant, spec de référence, dépendances, fichiers attendus, critères d'acceptation (repris de la spec), et la commande de vérification. Voir le modèle de prompt dans `CLAUDE.md`.

Statut : ☐ à faire · ◐ en cours · ☑ fait. Mettre à jour ce fichier à chaque PR fusionnée.

**Phase 1, deuxième lot (12/11/2026)** : espace soignant Twabibu Pro (agenda, rendez-vous cabinet, statuts, réglages, absences). Détail : `docs/05-roadmap/journal-phase-1.md`.

**Phase 1, premier lot (12/11/2026)** : parcours patient complet en place (recherche, profil, réservation, connexion par SMS, mes rendez-vous, annulation). Détail : `docs/05-roadmap/journal-phase-1.md`.

**Bilan phase 0 (12/11/2026)** : INFRA-01, INFRA-02, DATA-01, DATA-03, API-01, CONTRACTS-01, DESIGN-01, DESIGN-02, WEB-01, AVAIL-01 et AVAIL-02 faits. UI-01 partiel (composants de base faits, Storybook non installé). Restent de la phase 0 : CLIENT-01 (client API typé), Storybook (UI-01/UI-04), image `og:image` (DESIGN-02), test du `docker-compose.dev.yml` (Docker absent du poste). Détail dans `docs/05-roadmap/journal-phase-0.md`.

## EPIC INFRA — socle technique
| ID | Titre | Dépend de | Taille |
|---|---|---|---|
| ☑ INFRA-01 | Monorepo pnpm + Turborepo, configs partagées, Docker Compose dev, `.env.example`, `README` de démarrage | — | M |
| ☑ INFRA-02 | CI GitHub Actions (lint, typecheck, test, build, e2e smoke), Dependabot, cache pnpm | INFRA-01 | S |
| ☐ INFRA-03 | Production : Docker Compose prod, Caddyfile, Cloudflare, sauvegardes pgBackRest, scripts restauration | API-01, WEB-01 | L |
| ☐ INFRA-04 | Déploiement staging (sur `main`) et prod (sur tag), migrations, rollback | INFRA-03 | M |
| ☐ INFRA-05 | Observabilité : Sentry, logs pino → Loki, métriques, Uptime Kuma, alertes | INFRA-03 | M |

## EPIC DATA / API / CONTRACTS
| ID | Titre | Dépend de | Taille |
|---|---|---|---|
| ☑ DATA-01 | Schéma Prisma complet + migrations + seed (référentiels, jours fériés, démo) | INFRA-01 | L |
| ☐ DATA-02 | Vue matérialisée de recherche + triggers `searchVector` | DATA-01 | M |
| ☑ DATA-03 | Contrainte d'exclusion anti-chevauchement + tests | DATA-01 | S |
| ☑ API-01 | Squelette NestJS (config, Prisma, Redis, BullMQ, OpenAPI, erreurs, logging, Sentry, health) | INFRA-01 | M |
| ☐ API-02 | Guards : auth JWT/cookie, rôles, `MembershipGuard`, `PermissionsService`, rate limiting | API-01, AUTH-01 | M |
| ☑ CONTRACTS-01 | `packages/contracts` : enums, schémas Zod, erreurs, utilitaires de pagination | INFRA-01 | M |
| ◐ CLIENT-01 | `packages/api-client` typé (fetch, auth, refresh, retry) utilisable web + mobile | CONTRACTS-01 | M |

## EPIC DESIGN / UI
| ID | Titre | Dépend de | Taille |
|---|---|---|---|
| ☑ DESIGN-01 | `packages/tokens` depuis `design-tokens.json` → CSS vars, preset Tailwind, objet RN | INFRA-01 | S |
| ☑ DESIGN-02 | Intégrer le logo officiel (`assets/brand/`), icône app (stéthoscope), favicon, `og:image`, déclinaisons | — | S |
| ◐ UI-01 | Fondations + composants de base + Storybook (liste dans `composants-ui.md` §1–4) | DESIGN-01 | L |
| ☐ UI-02 | Composants métier patient : PractitionerCard, AvailabilityGrid, SearchBar, BookingSummary, MotiveList, DayAccordionSlots, AppointmentCard | UI-01 | L |
| ☐ UI-03 | Composants Pro : CalendarGrid, AppointmentEvent, AppointmentDrawer, PatientSearch, AvailabilityRuleEditor, AbsenceEditor | UI-01 | XL |
| ☐ UI-04 | Tests visuels (Chromatic ou Playwright screenshots) + audit accessibilité Storybook | UI-01 | M |

## EPIC WEB (coquille)
| ID | Titre | Dépend de | Taille |
|---|---|---|---|
| ☑ WEB-01 | Next.js : layouts, i18n, polices, PWA, pages institutionnelles, accueil | UI-01 | M |
| ☐ WEB-02 | Centre d'aide (markdown), pages légales, formulaire de contact | WEB-01 | S |
| ☐ WEB-03 | Page marketing « Vous êtes soignant ? » + tarifs + demande de démo | WEB-01 | M |

## EPIC AVAIL — moteur (SPEC-12)
AVAIL-01 ☑ · AVAIL-02 ☑ · AVAIL-03 ☑ · AVAIL-04 ☑ · AVAIL-05 ☐ (pas de cache encore) · AVAIL-06 ◐ (tests d’intégration faits, charge non testée) (détails dans la spec).

## EPIC SEARCH (SPEC-01) — SEARCH-01 ◐ (référentiels seedés, coordonnées à vérifier) · SEARCH-02 ☑ · SEARCH-03 ☑ · SEARCH-04 ☑ · SEARCH-05 ☑ · SEARCH-06 ☐ filtres · SEARCH-07 ☐ carte · SEARCH-08 ☐ pages SEO · SEARCH-09 ◐ · SEARCH-10 ☐ e2e
## EPIC PROFILE (SPEC-02) — PROFILE-01 ☑ · PROFILE-02 ☑ · PROFILE-03 ☑ · PROFILE-04 ◐ (itinéraire OSM, sans mini-carte ni galerie) · PROFILE-05 ◐ (métadonnées + JSON-LD, sans FAQ) · PROFILE-06 ☐ · PROFILE-07 ☐
## EPIC BOOK (SPEC-03) — BOOK-01…09 ☐, BOOK-10 liste d'attente côté patient ☐
## EPIC AUTH / ACCOUNT (SPEC-04) — AUTH-01 ☑ · AUTH-02 ☑ · AUTH-03 ◐ (connexion par code e-mail, ADR-016 ; pas de mot de passe) · AUTH-04 ☐ · ACCOUNT-01 ☑ · ACCOUNT-02 ◐ (ajout dans le tunnel et par API, pas d’écran dédié) · ACCOUNT-03…06 ☐
## EPIC AGENDA (SPEC-05) — accueil du praticien ☑ (journée, prochain patient, demandes à valider, patients récents, 17/11/2026) · AGENDA-01…06, 08…10 ☐ à auditer : une partie existe déjà (grille jour/semaine avec plages en ligne et absences, tiroir de création et de détail, statuts, déplacement par date/heure, annulation, historique ; réglages des motifs, plages en ligne et absences avec aperçu des RDV touchés) mais n’a pas été recensée ticket par ticket ; vue mois ajoutée le 19/11/2026 (RDV par jour, demandes à valider, remplissage des plages en ligne, jours fériés, absences, clic → vue jour) ; glisser-déposer ajouté le 19/11/2026 (souris ou stylet, confirmation avec ancien et nouvel horaire, patient prévenu) ; pas de redimensionnement ni d’impression · AGENDA-07 ◐ (validation manuelle : « Accepter / Refuser » dans le tiroir, e-mail ou SMS « demande acceptée » / « non acceptée » au patient, lien direct depuis l’accueil, 19/11/2026 ; manque le rappel au cabinet après 24 h) · AGENDA-11 liste d'attente côté cabinet ☐
## EPIC PATIENT (SPEC-06) — PATIENT-01 ☑ (fiche créée à la réservation ou par le cabinet) · PATIENT-02 ☑ (recherche nom / chiffres du téléphone) · PATIENT-03 ☑ fiche détaillée (coordonnées, rendez-vous à venir et passés, dossier médical pour les praticiens) · liste « mes patients » / « tout le cabinet » avec dernière visite (17/11/2026) · PATIENT-04…07 ☐
## EPIC PRO (SPEC-07) — PRO-01 ☐ inscription en ligne des soignants · PRO-02 ☐ onboarding · PRO-03 ☐ · PRO-04 ☑ (rôles et permissions, testés) · PRO-05 ☐ invitations · PRO-06…09 ☐
## EPIC NOTIF (SPEC-08) — NOTIF-01 ☑ · NOTIF-02 ◐ (e-mail : adaptateurs factice, Brevo, Resend ; SMS : factice) · NOTIF-03 ◐ (modèles e-mail HTML + texte et SMS de secours : code, confirmation, demande, changement, annulation) · NOTIF-04 ◐ · NOTIF-05 ☑ (rappels la veille ou J-2 / J-3 à l’heure choisie, fenêtre 07:00–21:00, sans doublon, confirmation de présence par lien) · NOTIF-06 ◐ (préférence « rappels » du patient ; pas de STOP par SMS ni de quotas) · NOTIF-07…08 ☐, NOTIF-09 WhatsApp ☐ (phase 5)
## EPIC DOC / MSG (SPEC-09) — DOC-01…05 ☐, DOC-06 modèles ☐, MSG-01…04 ☐ (phase 5)
## EPIC ORG (SPEC-10) — ORG-01…07 ☐
## EPIC ADMIN (SPEC-11) — ADMIN-01 ☑ (app `apps/admin`, code e-mail + TOTP, rôles) · ADMIN-02 ☑ · ADMIN-03 ◐ (file, checklist, décisions, e-mails ; visionneuse des pièces en attente du stockage objet) · ADMIN-04 ◐ (recherche, fiche, suspension / réactivation ; pas d’édition du profil ni de fusion de doublons) · ADMIN-05 ◐ (recherche, fiche sans donnée médicale, déconnexion partout ; pas de correction d’adresse ni d’anonymisation) · ADMIN-06 ◐ (spécialités, localités, jours fériés, médicaments ; pas les expertises, langues, assurances ni le centre d’aide) · ADMIN-07 ☐ · ADMIN-08 ◐ (emplacements « Partenaire » ; abonnements et factures à faire) · ADMIN-09 ☑ (journal des notifications, renvoi, journal d’audit, export CSV) · ADMIN-10 ☑ · ADMIN-11 ◐ (10 tests). Pharmacies (SPEC-15) depuis le back-office : vérification, calendrier des gardes avec import CSV, inventaire des emplacements.
## EPIC RECORD — dossier médical (SPEC-13) — RECORD-01 ☑ · RECORD-02 ☑ · RECORD-03 ◐ (consultation et clôture du RDV ; pas de modèles) · RECORD-04 ◐ (saisie des constantes ; pas de courbes) · RECORD-05…06 ☐ · RECORD-07 ◐ (consentement et historique des accès : API et écran patient « Partage de mon dossier » `/mon-compte/dossier`, 19/11/2026 ; case facultative à la réservation pour soi-même, 19/11/2026 ; pas encore pour les proches) · RECORD-08 ☐ · RECORD-09 ◐ (tests droits, consentement, chiffrement)
## EPIC RX — ordonnance numérique (SPEC-14) — RX-01 ◐ (référentiel de démonstration et recherche ; pas d’import LNME) · RX-02 ◐ (éditeur et posologies guidées ; pas de modèles) · RX-03 ☑ (allergie bloquante, doublon, déjà traité, stupéfiant) · RX-04 ◐ (signature, empreinte, page imprimable avec QR, vérification publique ; PDF par le navigateur) · RX-05 ☐ · RX-06 ◐ (liste patient ; pas d’envoi à une pharmacie) · RX-07 ☐ · RX-08 ◐
## EPIC PHARM — pharmacies (SPEC-15) — PHARM-01 ◐ (annuaire par île, fiche publique, statut vérifié ; pas de carte ni d’écran de vérification) · PHARM-02 ☑ (gardes : page publique, bloc accueil, vue pharmacie, saisie et import CSV dans le back-office) · PHARM-03 ☑ (catalogue, édition, import CSV, page médicament et comparateur) · PHARM-04 ☑ (envoi par le patient, file, réponse ligne par ligne, dispensation à la remise) · PHARM-05 ☑ (panier, retrait ou livraison par zone, statuts, e-mail à chaque étape, annulation) · PHARM-06 ◐ (tableau de bord, commandes en colonnes, catalogue, gardes, profil ; pas d’écran Équipe) · PHARM-07 ◐ (affichage « Partenaire » daté, inventaire de 3 places par île dans le back-office ; facturation à faire) · PHARM-08 ☐ · PHARM-09 ☐ · PHARM-10 ◐ (10 tests)
## EPIC REF — référentiels médicaux
| ID | Titre | Taille |
|---|---|---|
| ☐ REF-01 | Import du référentiel médicaments (LNME Comores + DCI/ATC), modèle `Drug`, admin | L |
| ☐ REF-02 | Maintenance : enrichissement par les pharmacies, validation, doublons | M |
| ☐ REF-03 | Vaccins (calendrier comorien), sous-ensemble CIM-10, courbes OMS (données) | M |

## EPIC SEC / QA / LEGAL
| ID | Titre | Taille |
|---|---|---|
| ☐ SEC-01 | Chiffrement applicatif (notes, pièces), gestion des clés, rotation | M |
| ☐ SEC-02 | Tests d'autorisation systématiques (matrice SPEC-07) + tests IDOR | M |
| ☐ SEC-03 | En-têtes de sécurité, CSP, cookies, CSRF, audit `pnpm audit` en CI | S |
| ☐ SEC-04 | Revue de sécurité externe avant lancement + corrections | L |
| ☐ QA-01 | Playwright : parcours P1–P6, desktop + mobile, données seed | L |
| ☐ QA-02 | Audit accessibilité (axe + manuel lecteur d'écran) et corrections | M |
| ☐ QA-03 | Budget performance + tests Lighthouse CI (3G) | S |
| ☐ LEGAL-01 | CGU patients, CGV soignants, confidentialité, mentions légales, consultation juridique | M |
| ☐ LEGAL-02 | Validité juridique de l'ordonnance numérique, cadre de la commande/livraison de médicaments, produits contrôlés, CGV pharmacies | M |

## EPIC MOBILE (phase 4) — MOBILE-01…08 ☐ (voir `docs/06-mobile/strategie-mobile.md`)

## EPIC PAY / I18N (phase 5)
PAY-01 abonnements via mobile money (quand API disponible) ☐ · PAY-02 factures automatiques ☐ · PAY-03 acomptes patient (si décidé) ☐ · I18N-02 shikomori ☐ · I18N-03 arabe (RTL) ☐.

## Ordre de lancement recommandé des sessions (phase 0 → 1)
1. INFRA-01 (seul, bloquant).
2. En parallèle : DATA-01, API-01, CONTRACTS-01, DESIGN-01, DESIGN-02, AVAIL-01.
3. En parallèle : INFRA-02, DATA-02, DATA-03, UI-01, WEB-01, AVAIL-02, AUTH-01, NOTIF-01.
4. En parallèle : API-02, CLIENT-01, UI-02, SEARCH-01/02, PROFILE-01, AVAIL-03/04, AUTH-02/03, NOTIF-02/03, PRO-01, AGENDA-01, ADMIN-01.
5. Dès que DATA-01 et API-02 sont faits : REF-01, RECORD-01, RX-01, PHARM-01/02 en parallèle (ils conditionnent l'adoption par les médecins et le trafic public des gardes).
6. Puis le reste des epics MVP par spec, chaque ticket vérifiant ses dépendances dans la spec.
