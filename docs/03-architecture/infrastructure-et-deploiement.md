# Infrastructure, environnements et déploiement

## 1. Choix
**Un VPS Docker Compose par environnement** (staging, production), hébergé en Union européenne (Hetzner Falkenstein/Helsinki ou OVH Gravelines), derrière Cloudflare. Raisons : coût (≈ 30–60 €/mois en prod au démarrage), maîtrise complète des données de santé, simplicité pour une petite équipe. Évolution possible vers Kubernetes managé ou des services managés (Postgres managé) quand la charge le justifiera (> 500 soignants).

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

Dimensionnement de départ : 4 vCPU / 8 Go RAM / 160 Go SSD (prod), 2 vCPU / 4 Go (staging). Domaine : `twabibu.km` (à réserver auprès du registre .km) + `twabibu.com` en redirection.

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
