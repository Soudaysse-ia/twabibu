# Architecture technique

## 1. Décisions clés (résumé — détails dans `decisions-adr.md`)

| Sujet | Choix | Pourquoi |
|---|---|---|
| Langage | **TypeScript partout** (web, API, mobile, scripts) | Un seul langage, types partagés, excellent support par les modèles Claude |
| Organisation | **Monorepo pnpm + Turborepo** | Code partagé (contrats, tokens, UI), builds incrémentaux |
| Web | **Next.js 15 (App Router, React 19)** + Tailwind CSS 4 + shadcn/ui (Radix) | SSR/SSG pour le SEO des pages soignants, image optimisée, i18n, PWA |
| API | **NestJS 11** + Prisma 6 + PostgreSQL 16 | Modules explicites, DI, validation, OpenAPI généré ; consommée par le web ET les apps mobiles |
| Contrats | **Zod** dans `packages/contracts` → types partagés + validation côté API et clients, OpenAPI dérivé | Une source de vérité |
| Données | PostgreSQL 16 (extensions `pg_trgm`, `unaccent`, `postgis` light ou calcul haversine), **Redis 7** (cache, verrous de créneaux, files) | Fiable, connu, suffisant pour 10⁵ RDV/mois |
| Jobs | **BullMQ** (Redis) : rappels, SMS, e-mails, recalculs, exports | Retries, planification |
| Recherche | Postgres full-text + `pg_trgm` (pas de Meilisearch en V1) | Volume comorien faible, une dépendance de moins |
| Cartes | **Leaflet + OpenStreetMap** (tuiles MapTiler ou OSM) ; géocodage Nominatim/Photon + référentiel de localités maison | Pas de clé Google, pas de bannière de consentement |
| Auth | Sessions JWT courts (15 min) + refresh tokens rotatifs (30 j) en cookie httpOnly (web) / stockage sécurisé (mobile) ; **OTP SMS** pour les patients ; e-mail + mot de passe + 2FA TOTP optionnelle pour les pros | Téléphone = identifiant naturel aux Comores |
| SMS | Interface `SmsProvider` avec adaptateurs **Twilio/Infobip** (démarrage) puis **passerelle opérateur locale** (Comores Telecom / Yas) via SMPP ou HTTP | Coût et délivrabilité |
| E-mail | Resend ou Brevo (SMTP) via `EmailProvider` | |
| Fichiers | Stockage objet S3-compatible (MinIO en local, Cloudflare R2 ou Scaleway en prod), URLs signées | Documents médicaux chiffrés |
| Mobile | **Expo (React Native) + Expo Router**, `packages/api-client` partagé | Android + iOS avec une seule base |
| Infra | Docker Compose sur VPS (Hetzner/OVH, UE) + Caddy + Cloudflare ; CI GitHub Actions | Coût faible, maîtrise des données (voir infrastructure) |
| Observabilité | Sentry (erreurs), OpenTelemetry → Grafana Cloud ou Better Stack (logs/metrics), Uptime Kuma | |
| Tests | Vitest (unit), Supertest (API), Playwright (e2e), Storybook + tests visuels | |

## 2. Vue d'ensemble

```
                    ┌──────────────────────────────────────────────┐
                    │                 Cloudflare (DNS, CDN, WAF)    │
                    └───────────────┬──────────────────────────────┘
                                    │ HTTPS
                    ┌───────────────▼──────────────┐
                    │  Caddy (reverse proxy, TLS)   │
                    └──────┬───────────────┬────────┘
                           │               │
             ┌─────────────▼───┐   ┌───────▼─────────────┐
             │ apps/web        │   │ apps/api (NestJS)    │◄──── apps/mobile (Expo)
             │ Next.js SSR/ISR │──►│ REST /v1 + OpenAPI   │◄──── apps/admin (Next.js)
             └─────────────────┘   └───┬─────┬─────┬──────┘
                                       │     │     │
                      ┌────────────────▼┐  ┌─▼───┐ ▼────────────┐
                      │ PostgreSQL 16   │  │Redis│ │ S3 (R2/MinIO)│
                      └─────────────────┘  └──┬──┘ └─────────────┘
                                              │
                                   ┌──────────▼──────────┐
                                   │ apps/worker (BullMQ)│──► SMS / WhatsApp / E-mail / Push
                                   └─────────────────────┘
```

- `apps/web` appelle l'API côté serveur (SSR) et côté client (React Query) avec le même `packages/api-client`.
- `apps/admin` est une app Next.js séparée (back-office) pour isoler les droits et le déploiement.
- `apps/worker` partage le code de `apps/api` (même image Docker, commande différente).

## 3. Structure du monorepo

```
twabibu/
├── apps/
│   ├── web/            # Site patient + Twabibu Pro (Next.js)
│   ├── admin/          # Back-office Twabibu (Next.js)
│   ├── api/            # API NestJS + worker BullMQ
│   └── mobile/         # Expo (patient d'abord, puis pro)
├── packages/
│   ├── contracts/      # Schémas Zod + types (DTO, enums, erreurs) — source de vérité
│   ├── api-client/     # Client HTTP typé généré depuis contracts (fetch, auth, retry)
│   ├── tokens/         # design-tokens.json → CSS vars, Tailwind preset, objet RN
│   ├── ui/             # Composants React web (shadcn/Radix) + Storybook
│   ├── ui-native/      # Composants React Native équivalents
│   ├── i18n/           # Messages fr (puis zdj/ar), formats dates/KMF
│   ├── availability/   # Moteur de disponibilités pur (sans IO) — utilisé par api et tests
│   ├── config/         # eslint, tsconfig, prettier, tailwind partagés
│   └── utils/          # dates (Indian/Comoro), téléphone (+269), slugs, etc.
├── infra/
│   ├── docker/         # Dockerfiles, docker-compose.{dev,prod}.yml
│   ├── caddy/          # Caddyfile
│   └── scripts/        # sauvegardes, restauration, seed
├── docs/               # cette documentation
├── .github/workflows/  # CI (lint, typecheck, tests, build, deploy)
├── CLAUDE.md
├── package.json / pnpm-workspace.yaml / turbo.json
└── README.md
```

## 4. Modules de l'API (NestJS)

Un module par domaine métier, chacun avec `controller` (HTTP), `service` (règles), `repository` (Prisma), `dto` (Zod via `nestjs-zod`), `events` (domain events), tests.

| Module | Responsabilité | Spec |
|---|---|---|
| `auth` | OTP SMS, mots de passe, JWT/refresh, 2FA, sessions, rôles | SPEC-04, 07 |
| `users` | comptes (patient, pro, admin), préférences, suppression | SPEC-04 |
| `patients` | profil patient, proches (`Relative`), fusion | SPEC-04, 06 |
| `directory` | référentiels : spécialités, actes, langues, localités, assurances | SPEC-01, 11 |
| `practitioners` | profil public, lieux (`Practice`), horaires, tarifs, vérification | SPEC-02, 07 |
| `organizations` | établissements, membres, rôles, invitations | SPEC-07, 10 |
| `agendas` | agendas, motifs, règles de disponibilité, absences | SPEC-05 |
| `availability` | calcul des créneaux (utilise `packages/availability`), verrous Redis | SPEC-12 |
| `appointments` | cycle de vie du RDV, statuts, déplacement, annulation, liste d'attente | SPEC-03, 05 |
| `search` | recherche soignants/établissements, géo, tri, pagination | SPEC-01 |
| `notifications` | templates, canaux (SMS/e-mail/WhatsApp/push), journal, préférences | SPEC-08 |
| `documents` | upload S3, partage patient ↔ cabinet, antivirus optionnel | SPEC-09 |
| `clinical-notes` | notes de consultation (privées au praticien) | SPEC-06 |
| `medical-records` | dossier médical : antécédents, allergies, traitements, consultations, constantes, suivi, consentements, carnet patient | SPEC-13 |
| `prescriptions` | référentiel médicaments, ordonnances, signature/PDF/QR, dispensations | SPEC-14 |
| `pharmacies` | profils pharmacie, gardes, catalogue, ordonnances reçues, commandes, livraisons, espaces sponsorisés | SPEC-15 |
| `billing` | plans, abonnements, factures (manuel V1) | SPEC-11 |
| `admin` | file de vérification, modération, support, stats | SPEC-11 |
| `audit` | journal d'audit immuable | sécurité |
| `health` | `/health`, `/ready` | infra |

Événements de domaine (bus interne NestJS `EventEmitter2`, puis BullMQ pour l'asynchrone) : `appointment.booked`, `appointment.cancelled`, `appointment.rescheduled`, `appointment.reminder_due`, `absence.created`, `practitioner.verified`, `waitlist.slot_freed`, `consultation.closed`, `prescription.signed`, `prescription.sent`, `prescription.dispensed`, `order.status_changed`, `duty.starts_soon`, etc. Les notifications s'abonnent aux événements ; aucun module métier n'envoie de SMS directement.

## 5. Front web (Next.js)

- **App Router**, composants serveur par défaut, composants client pour l'interactif (agenda, tunnel).
- Routes groupées : `(public)`, `(booking)`, `(account)`, `(pro)`, `(pharma)`, `(auth)`. Layouts distincts (en-tête bleu public vs. barre latérale Pro).
- Données : `packages/api-client` + **TanStack Query** côté client ; SSR avec `fetch` + cache Next (revalidation 60 s pour les profils, 0 pour les disponibilités).
- Formulaires : `react-hook-form` + schémas Zod de `packages/contracts`.
- État global minimal (zustand) : tunnel de réservation (panier), session.
- i18n : `next-intl`, messages dans `packages/i18n`, dates via `Intl` et `date-fns-tz` (`Indian/Comoro`).
- SEO : `generateMetadata`, sitemap dynamique, JSON-LD (`Physician`, `MedicalClinic`), pages spécialité × ville en ISR.
- PWA : `manifest.webmanifest`, service worker (Serwist) pour le cache des assets et un mode hors-ligne minimal (page « Vous êtes hors ligne », RDV à venir en cache).
- Performance : budget 170 kB JS initial sur la page résultats, images `next/image` AVIF/WebP, polices auto-hébergées, pas de carte chargée avant interaction sur mobile.

## 6. Moteur de disponibilités (`packages/availability`)

Fonction pure `computeSlots({ rules, absences, appointments, locks, motive, range, now, settings }) → Slot[]`. Entrées normalisées en UTC, sortie en UTC avec affichage `Indian/Comoro`. Testée exhaustivement (jours fériés, chevauchements, durées variables, délai minimum, horizon, capacité). Détails : SPEC-12.

## 7. Principes de code
- **Code en anglais, interface en français.** Noms d'entités : `Practitioner`, `Practice` (lieu), `Agenda`, `Motive`, `AvailabilityRule`, `Absence`, `Appointment`, `Patient`, `Relative`, `Organization`, `Membership`, `MedicalRecord`, `Consultation`, `Prescription`, `Drug`, `Pharmacy` (= `Organization` de type `PHARMACY`), `Order`, `DutySchedule`.
- Pas de logique métier dans les contrôleurs ni dans les composants React : services (API) et hooks (web).
- Toute écriture passe par un service qui émet un événement de domaine et écrit dans l'audit si la donnée est sensible.
- Erreurs typées (`packages/contracts/errors.ts`) : `SLOT_UNAVAILABLE`, `SLOT_LOCK_EXPIRED`, `CANCELLATION_DEADLINE_PASSED`, `NEW_PATIENTS_NOT_ACCEPTED`, `OTP_INVALID`, etc. ; messages utilisateur dans `packages/i18n`.
- Migrations Prisma versionnées ; jamais de modification manuelle de la base.
- Feature flags simples (table `feature_flags`) pour activer WhatsApp, liste d'attente, paiements.
