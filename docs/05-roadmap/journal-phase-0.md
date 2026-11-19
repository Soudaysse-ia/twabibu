# Journal de la phase 0 — Fondations (12 novembre 2026)

## Ce qui est en place

| Élément | Où | Vérifié par |
|---|---|---|
| Monorepo pnpm + Turborepo, TypeScript strict, ESLint, Prettier | racine | `pnpm build`, `pnpm lint`, `pnpm typecheck` |
| CI GitHub Actions (Postgres 16 + Redis 7, build, lint, types, migrations, seed, tests) + Dependabot | `.github/` | non exécutée : le dépôt n'est pas encore sur GitHub |
| `@twabibu/utils` : téléphone +269, KMF, dates `Indian/Comoro`, slugs | `packages/utils` | 10 tests |
| `@twabibu/contracts` : enums, codes d'erreur, schémas Zod, référentiels (3 îles, 25 localités, 31 spécialités) | `packages/contracts` | 4 tests |
| `@twabibu/tokens` : CSS Tailwind et objet TS générés depuis `design-tokens.json` | `packages/tokens` | 2 tests (dont contrastes AA) |
| `@twabibu/i18n` : textes français de l'interface | `packages/i18n` | typecheck |
| `@twabibu/availability` : moteur de créneaux pur (SPEC-12) | `packages/availability` | 16 tests, dont 1 test de propriété sur 300 cas aléatoires |
| Schéma Prisma complet (62 tables : comptes, agenda, RDV, dossier médical, ordonnances, pharmacies, plateforme) | `apps/api/prisma/schema.prisma` | migrations appliquées, aucun écart schéma/migrations |
| Contrainte SQL anti-chevauchement des RDV, index de recherche trigram, journaux en ajout seul | migration `…_appointment_no_overlap` | présente en base |
| Seed idempotent : référentiels, jours fériés 2026–2027, 18 médicaments essentiels ; démo fictive hors production | `apps/api/prisma/seed.ts` | exécuté deux fois sans doublon |
| API NestJS : config validée, Prisma, Redis, BullMQ, erreurs typées, `/health`, `/ready`, OpenAPI `/v1/docs`, référentiels, autocomplétion | `apps/api/src` | 5 tests d'intégration sur base réelle |
| `@twabibu/ui` : Button, Card, Chip, SlotChip, Badge, Container, Logo | `packages/ui` | typecheck, rendu dans le site |
| Site Next.js : accueil, barre de recherche avec autocomplétion (API, repli hors ligne), aperçu de créneaux calculé par le moteur, pied de page SEO, pages d'attente, 404, manifeste PWA, icône | `apps/web` | build de production, 2 tests, vérification visuelle 1280 px et 375 px |
| Logo : versions recadrées blanche et bleue, icône d'application | `assets/brand/` | affichage vérifié |

## Écarts par rapport au plan (voir ADR-013)
- Versions plus récentes que celles écrites dans le plan : Next.js 16 (et non 15), NestJS 12 (et non 11). TypeScript reste en 6.0 car `typescript-eslint` ne supporte pas encore TypeScript 7. Prisma reste en 6.19 (la 7 change la configuration du client ; migration à planifier).
- Textes : objet `fr` simple au lieu de `next-intl` tant qu'il n'y a qu'une langue (ticket I18N-02 au moment du shikomori).
- Tests de l'API avec le lanceur natif de Node (`node --test`) plutôt que Vitest, car Vitest ne gère pas les métadonnées de décorateurs dont NestJS a besoin.
- Services locaux : PostgreSQL 16 et Redis via Homebrew sur le poste d'origine ; `infra/docker/docker-compose.dev.yml` est écrit mais pas testé (Docker absent).

## Pièges connus
- `prisma migrate dev` peut rester bloqué en attente d'une réponse dans un terminal non interactif. Pour appliquer des migrations écrites à la main : `pnpm db:deploy`. Pour vérifier l'absence d'écart : `prisma migrate diff --from-migrations … --to-schema-datamodel …` (voir `CLAUDE.md`).
- Dans `packages/ui`, les imports internes sont **sans extension** (Turbopack ne résout pas `./x.js` vers `./x.tsx`). Dans les autres paquets, ils gardent `.js` (modules Node).
- Les coordonnées des 25 localités sont approximatives (centres-villes) : à vérifier avant le lancement (SEARCH-01). Les dates des fêtes islamiques sont des estimations (`isEstimated`).

## Prochaine étape recommandée
Phase 1, en parallèle : CLIENT-01, API-02 (auth et gardes), AUTH-01 (OTP), SEARCH-03 (résultats), AVAIL-03/04 (service et verrous), AGENDA-01, RECORD-01, RX-01/REF-01, PHARM-01/02.
