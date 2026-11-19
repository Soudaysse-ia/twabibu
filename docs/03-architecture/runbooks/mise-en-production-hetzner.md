# Mise en production chez Hetzner (première installation)

Procédure à suivre **une fois par environnement** : d’abord la pré-production (`staging`, qui sert aussi de démo hébergée), puis la production. Compter environ deux heures la première fois. Les fichiers cités sont dans le dépôt : `infra/docker/`, `infra/caddy/`, `infra/scripts/`, `infra/env/`, `.github/workflows/deploy.yml`. Décisions : ADR-009 et ADR-020.

## 0. Ce qu’il faut avant de commencer
- Un compte **Hetzner Cloud** (projet « Twabibu »), un compte **Cloudflare**, un compte **Brevo** (e-mails, ADR-016) et l’accès administrateur au dépôt GitHub.
- Le domaine `twabibu.km` réservé auprès du registre `.km`, avec ses serveurs de noms pointés vers Cloudflare.
- Un gestionnaire de mots de passe d’équipe : on y range les secrets générés plus bas (surtout `ENCRYPTION_KEY` et la clé privée des sauvegardes).

## 1. Créer le serveur
Console Hetzner Cloud > *Add server* :
| | Pré-production | Production |
|---|---|---|
| Emplacement | Falkenstein ou Nuremberg (Union européenne) | idem |
| Image | Ubuntu 24.04 | Ubuntu 24.04 |
| Type | 2 vCPU, 4 Go (gamme CX ou CPX) | 4 vCPU, 8 Go, ≥ 160 Go de disque |
| Réseau | IPv4 + IPv6 | IPv4 + IPv6 |
| Clé SSH | la vôtre (jamais de mot de passe) | idem |
| Sauvegardes Hetzner | facultatif | **activées** (instantanés quotidiens, en plus de nos sauvegardes) |
| Pare-feu Hetzner | entrées 22, 80, 443 seulement | idem |

Le prix exact est affiché par Hetzner à la création ; l’ordre de grandeur prévu est de 30 à 60 € par mois pour la production (voir `infrastructure-et-deploiement.md`).

## 2. Préparer le système
Depuis votre poste :
```bash
ssh root@<IP-du-serveur>
curl -fsSL https://raw.githubusercontent.com/Soudaysse-ia/twabibu/main/infra/scripts/server-setup.sh -o setup.sh
less setup.sh
bash setup.sh
```
Le script installe les mises à jour automatiques de sécurité, Docker, le pare-feu (22, 80, 443), fail2ban, `age` et `rclone`. Il crée l’utilisateur `deploy` (clé SSH seulement), le dossier `/srv/twabibu` et les tâches planifiées : sauvegarde quotidienne à 02:30 UTC et test de restauration le 1er de chaque mois.

## 3. Clé de déploiement pour GitHub
Sur votre poste, une clé dédiée par environnement :
```bash
ssh-keygen -t ed25519 -N "" -C "github-deploy-staging" -f twabibu-deploy-staging
ssh-keyscan -t ed25519 <IP-du-serveur> > known_hosts-staging
```
Copiez le contenu de `twabibu-deploy-staging.pub` dans `/home/deploy/.ssh/authorized_keys` sur le serveur. La clé privée ne va que dans GitHub (étape 6), puis supprimez-la de votre poste.

## 4. Le fichier `.env` du serveur
```bash
ssh root@<IP-du-serveur>
nano /srv/twabibu/.env            # coller infra/env/staging.env.example (ou production.env.example) et l’adapter
chown deploy:deploy /srv/twabibu/.env && chmod 600 /srv/twabibu/.env
```
Générez chaque secret avec `openssl rand -hex 32` (`POSTGRES_PASSWORD`, `SESSION_SECRET`, `ENCRYPTION_KEY`) et rangez-les dans le gestionnaire de mots de passe. **`ENCRYPTION_KEY` ne doit jamais changer** : elle chiffre les notes médicales.

En production, renseignez aussi `EMAIL_PROVIDER=brevo`, `EMAIL_API_KEY` (clé Brevo) et `ADMIN_ALLOWED_IPS` (adresses du bureau qui ont accès au back-office). L’API refuse de démarrer en production avec de faux e-mails.

## 5. Noms de domaine (Cloudflare)
Enregistrements `A` (et `AAAA` pour l’IPv6) vers l’IP du serveur :
| Nom | Pré-production | Production |
|---|---|---|
| site | `staging` | `@` et `www` |
| back-office | `admin.staging` | `admin` |

**Au début, laissez-les en « DNS only » (nuage gris)** avec `TLS_MODE=acme` : Caddy obtient lui-même les certificats Let’s Encrypt.

Pour passer ensuite derrière Cloudflare (nuage orange, cache et protection) :
1. Cloudflare > SSL/TLS > *Origin Server* > créer un certificat pour `twabibu.km` et `*.twabibu.km`.
2. Le copier sur le serveur dans `/srv/twabibu/certs/origin.pem` et `origin.key` (`chmod 600`, propriétaire `deploy`).
3. Mettre `TLS_MODE=origin` dans `.env`, puis `docker compose up -d caddy`.
4. Dans Cloudflare : mode SSL/TLS « Full (strict) », puis passer les enregistrements en nuage orange.

## 6. GitHub
Dépôt > *Settings* :
1. **Environments** : créer `staging` et `production`. Pour `production`, cocher *Required reviewers* (une personne valide chaque mise en production).
2. Dans chaque environnement, **secrets** : `DEPLOY_HOST` (IP du serveur), `DEPLOY_SSH_KEY` (contenu de la clé privée de l’étape 3), `DEPLOY_KNOWN_HOSTS` (contenu de `known_hosts-…`). **Variable** : `SITE_URL` (`https://staging.twabibu.km` ou `https://twabibu.km`).
3. **Variables du dépôt** : `STAGING_SITE_URL`, `PRODUCTION_SITE_URL`, puis `DEPLOY_ENABLED=true` quand les serveurs sont prêts (avant, le workflow construit les images sans déployer).

Les images sont publiées sur GitHub Packages (`ghcr.io/soudaysse-ia/twabibu-api`, `-web`, `-admin`) et restent privées : à chaque déploiement, le serveur utilise un jeton temporaire du workflow, effacé juste après.

## 7. Premier déploiement
- **Pré-production** : chaque fusion sur `main` construit les images et déploie. On peut aussi lancer *Actions > Deploy > Run workflow* avec `staging` et un tag existant. Le premier déploiement crée la base, applique les migrations et charge les référentiels et les données de démo fictives.
- **Production** : créer un tag de version (`git tag v0.1.0 && git push origin v0.1.0`), puis valider le déploiement dans GitHub. Ensuite, **une seule fois**, charger les référentiels (îles, localités, spécialités, médicaments ; jamais de données de démo en production) et créer le premier administrateur :
```bash
ssh deploy@<IP-production>
cd /srv/twabibu
docker compose run --rm api node_modules/tsx/dist/cli.mjs prisma/seed.ts
docker compose run --rm api node_modules/tsx/dist/cli.mjs prisma/create-admin.ts prenom.nom@twabibu.km SUPERADMIN
```
L’administrateur se connecte sur `https://admin.twabibu.km` avec le code reçu par e-mail, puis enregistre l’application d’authentification (ADR-018).

## 8. Sauvegardes hors du serveur (production)
Une sauvegarde sur le même disque n’en est pas une. Le plus simple : une **Hetzner Storage Box** (dans un autre centre de données que le serveur).
1. Sur un poste de confiance : `age-keygen -o twabibu-backup.key`. La ligne `public key: age1…` va dans `.env` (`BACKUP_AGE_RECIPIENT`). Le fichier `twabibu-backup.key` va **hors ligne** dans le gestionnaire de mots de passe : sans lui, aucune restauration possible.
2. Sur le serveur, en tant que `deploy` : `rclone config` pour ajouter la Storage Box (type `sftp`), puis `BACKUP_RCLONE_REMOTE=storagebox:twabibu` dans `.env`.
3. Lancer une fois `./scripts/backup.sh` et vérifier qu’il n’affiche plus d’avertissement.

## 9. Vérifications avant d’annoncer le site
- [ ] `https://<domaine>/api/ready` répond `{"status":"ok", …}`.
- [ ] Inscription patient avec une vraie adresse e-mail : le code arrive (production) ; code `000000` (pré-production).
- [ ] `https://admin.<domaine>` refuse une adresse IP hors de `ADMIN_ALLOWED_IPS` (« Accès réservé »).
- [ ] `ssh deploy@<IP> 'ls -l /srv/twabibu/backups'` montre une sauvegarde du jour ; `./scripts/restore.sh --test <fichier>` réussit.
- [ ] Enregistrements SPF et DKIM de Brevo ajoutés dans Cloudflare (sinon les codes partent en indésirables).
- [ ] Les secrets sont dans le gestionnaire de mots de passe, nulle part ailleurs.
