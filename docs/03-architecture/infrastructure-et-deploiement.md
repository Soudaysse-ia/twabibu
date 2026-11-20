# Infrastructure, environnements et déploiement

> **État au 19/11/2026 (ADR-020)** : images, Compose de production, Caddy, sauvegardes, installation du serveur et workflow de déploiement sont dans le dépôt (`infra/`, `.github/workflows/deploy.yml`). Écarts avec ce qui suit : pas de `worker` séparé (les tâches BullMQ tournent dans l’API), pas encore de stockage objet ni de supervision, sauvegarde par `pg_dump` quotidien au lieu de pgBackRest, pas d’environnement `preview`. Procédure d’installation : `runbooks/mise-en-production-hetzner.md`.

## 1. Choix
**Un VPS Docker Compose par environnement** (staging, production), hébergé en Union européenne (Hetzner Falkenstein/Helsinki ou OVH Gravelines), derrière Cloudflare. Raisons : coût (≈ 15 €/mois HT pour la production au démarrage, voir §8), maîtrise complète des données de santé, simplicité pour une petite équipe. Évolution possible vers Kubernetes managé ou des services managés (Postgres managé) quand la charge le justifiera (> 500 soignants).

Alternative conservée en une ligne : Vercel (web) + Fly.io (API/worker) + Neon (Postgres) + Upstash (Redis) + R2 : plus rapide à mettre en place, plus cher à l'échelle et données réparties chez 5 fournisseurs. Non retenue par défaut.

## 2. Topologie production
| Service | Image / outil | Rôle |
|---|---|---|
| `caddy` | caddy:2 | TLS automatique, reverse proxy, compression, en-têtes de sécurité |
| `web` | apps/web (Next.js standalone) | site patient + Pro |
| `admin` | apps/admin | back-office (sous-domaine `admin.twabibu.km`, accès restreint) |
| `api` | apps/api | API NestJS |
| `worker` | apps/api (commande worker) | BullMQ : rappels, SMS, e-mails, exports |
| `postgres` | postgres:16 + extensions | base (volume chiffré) |
| `redis` | redis:7 | cache, verrous, files |
| `minio` (staging) / R2 (prod) | stockage objet | documents, photos |
| `backup` | pgbackrest / wal-g + cron | sauvegardes |
| `uptime-kuma`, `node-exporter`, `otel-collector` | supervision | |

Dimensionnement de départ (revu le 20/11/2026, §8) : 4 vCPU / 8 Go RAM / 75 à 80 Go SSD (prod), 2 vCPU / 4 Go / 40 Go (staging). Domaine : `twabibu.km` (à réserver auprès du registre .km) + `twabibu.com` en redirection.

## 3. Environnements
| Env | URL | Base | Données | Déploiement |
|---|---|---|---|---|
| `dev` | localhost | Docker Compose local (`pnpm dev`) | seed fictif | manuel |
| `preview` | `pr-123.preview.twabibu.km` (optionnel) | éphémère | seed | par PR (phase 2 de la CI) |
| `staging` | `staging.twabibu.km` | VPS staging | seed + données de test | automatique sur `main` |
| `production` | `twabibu.km` | VPS prod | réelles | manuel (tag `vX.Y.Z`) après validation staging |

SMS en dev/staging : adaptateur `FakeSmsProvider` (journalise dans la base et l'UI admin) ; liste blanche de numéros de test pour un vrai envoi.

## 4. CI/CD (GitHub Actions)
1. `ci.yml` (sur PR) : installation pnpm avec cache → `lint` → `typecheck` → `test` (unit + API avec Postgres service) → `build` → `e2e` Playwright (smoke) → rapport de couverture.
2. `deploy-staging.yml` (sur `main`) : build des images Docker (multi-stage, `node:22-alpine`), push sur GHCR, `ssh` → `docker compose pull && up -d` → migrations Prisma (`prisma migrate deploy`) → smoke test `/health`.
3. `deploy-prod.yml` (sur tag) : identique + sauvegarde avant migration + notification.
4. Rollback : retour à l'image précédente (`docker compose` avec tag) ; migrations toujours rétro-compatibles (expansion puis contraction).

## 5. Configuration (variables d'environnement)
`DATABASE_URL`, `REDIS_URL`, `S3_*`, `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`, `ENCRYPTION_KEY`, `SMS_PROVIDER` (`fake|twilio|infobip|local`), `SMS_*`, `EMAIL_PROVIDER`, `EMAIL_*`, `MAPTILER_KEY`, `SENTRY_DSN`, `APP_URL`, `API_URL`, `DEFAULT_TIMEZONE=Indian/Comoro`, `FEATURE_*`. Fichier `.env.example` tenu à jour (ticket INFRA-01). Secrets de prod dans GitHub Environments et sur le serveur (`/srv/twabibu/.env`, permissions 600).

## 6. Observabilité
- Sentry (web, api, mobile) avec `release` = SHA.
- Logs JSON structurés (pino) → Loki/Grafana Cloud ou Better Stack ; pas de données personnelles en clair (masquage des téléphones).
- Métriques : latence API, taux d'erreurs, taille des files BullMQ, SMS envoyés/échoués, créneaux verrouillés, RDV/jour.
- Alertes : API indisponible, file de rappels en retard > 10 min, échec SMS > 5 %, espace disque < 20 %, sauvegarde absente > 26 h.

## 7. Performance aux Comores
- Cloudflare en frontal (cache des assets, images, pages ISR) ; point de présence le plus proche : Nairobi / Johannesburg / Île Maurice — latence acceptable.
- Pages de résultats rendues côté serveur, JS minimal, images compressées, polices auto-hébergées, `preconnect` vers l'API.
- Tests réguliers avec limitation réseau « 3G rapide » dans Lighthouse (budget : LCP < 3 s sur mobile).

## 8. Coût et choix de l’hébergeur (revu le 20/11/2026)
**Conclusion : on garde l’architecture (un VPS Docker Compose par environnement, derrière Cloudflare gratuit) ; c’est à la fois la plus simple à exploiter et la moins chère.** Les plateformes gérées (Vercel, Fly.io, Render, Railway avec Postgres et Redis gérés) coûtent plusieurs fois plus cher pour trois applications, une base et un Redis, et répartissent les données de santé chez plusieurs fournisseurs.

**Ce qui a changé en 2026** : Hetzner a augmenté ses prix deux fois (1er avril et 15 juin 2026) ; la gamme CPX a plus que doublé, la gamme CX (processeurs partagés) a pris environ 30 à 40 %. Depuis fin juin 2026, Hetzner signale une disponibilité limitée : certains types de serveurs ne sont pas commandables certains jours. OVHcloud a lancé sa gamme « VPS 2027 », moins chère à taille égale. Les deux restent dans l’Union européenne ; nos scripts (`infra/scripts/server-setup.sh`) visent Ubuntu 24.04 et fonctionnent chez l’un comme chez l’autre.

Prix mensuels hors taxes relevés le 20/11/2026 sur des sources publiques (à confirmer à la commande) :
| Besoin | Hetzner Cloud (Falkenstein / Nuremberg) | OVHcloud VPS 2027 (France) |
|---|---|---|
| Pré-production / démo : 2 vCPU, 4 Go | CX23, 40 Go : 5,49 € + 0,50 € d’IPv4 | VPS-1, 40 Go : 3,81 € |
| Production : 4 vCPU, 8 Go | CX33, 80 Go : 8,49 € + 0,50 € d’IPv4 | VPS-2, 75 Go : 7,21 € |
| Sauvegarde hors serveur (1 To) | Storage Box BX11 : 3,20 € (utilisable depuis n’importe quel hébergeur) | idem |
| Instantanés quotidiens du serveur | + 20 % du prix du serveur | option payante |

Budget de départ :
| Étape | Contenu | Coût |
|---|---|---|
| **Maintenant (démo en ligne)** | un seul serveur de pré-production (données fictives), Cloudflare, Brevo gratuit | ≈ 4 à 6 €/mois |
| **Lancement (vrais patients)** | + serveur de production, instantanés, Storage Box | ≈ 15 à 20 €/mois au total |
| Croissance | passer la production à 8 vCPU / 16 Go (redimensionnement en quelques minutes), puis base gérée à partir d’environ 500 soignants | selon la charge |

Recommandations :
1. **Ne pas créer la production avant le lancement** : tant qu’il n’y a que des données fictives, la pré-production suffit (c’est aussi la démo).
2. **Hetzner si CX23 / CX33 sont commandables le jour de la création, sinon OVHcloud VPS-1 / VPS-2** ; ne pas prendre CPX (même taille, environ quatre fois plus cher depuis juin 2026). Les serveurs ARM (CAX) demanderaient des images multi-architecture : pas d’intérêt au prix actuel.
3. **Mesurer la latence depuis Moroni avant de choisir** (les câbles EASSy, FLY-LION3 et Avassa passent par l’Afrique de l’Est et l’océan Indien) : `ping fsn1-speed.hetzner.com` et `ping proof.ovh.net` depuis une connexion Comores Telecom puis Yas ; garder le plus rapide. Cloudflare sert les fichiers statiques depuis un point de présence proche dans tous les cas.
4. **Postgres et Redis restent sur le serveur** (pas de base gérée tant que la charge est faible) ; la sécurité repose sur la sauvegarde chiffrée hors serveur et le test de restauration mensuel (`runbooks/sauvegarde-restauration.md`).
5. Les images Docker sont stockées sur GitHub Packages, gratuit pour le registre de conteneurs à ce jour (GitHub s’engage à prévenir un mois avant tout changement).
