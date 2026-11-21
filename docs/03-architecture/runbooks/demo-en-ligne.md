# Mettre la démo en ligne en 15 minutes

La démo hébergée (pré-production, ADR-020) sur un serveur neuf, **sans nom de domaine, sans Cloudflare et sans réglage GitHub**. Un seul script fait tout : `infra/scripts/demo-quickstart.sh`. Données fictives uniquement, code de connexion toujours `000000`, aucun e-mail réellement envoyé.

Pour la production (vrai domaine, Cloudflare, e-mails réels, déploiement automatique), suivre `mise-en-production-hetzner.md`.

## 1. Créer le serveur (5 minutes)
Console Hetzner Cloud > *Add server* :
- **Emplacement** : Falkenstein, Nuremberg ou Helsinki (Union européenne).
- **Image** : Ubuntu 24.04.
- **Type** : CX23 (environ 6 € par mois). S’il est « indisponible », essayez un autre emplacement ou prenez un VPS-1 chez OVHcloud (voir l’encadré plus bas).
- **Réseau** : IPv4 publique cochée (nécessaire pour l’adresse gratuite de la démo).
- **Clé SSH** : ajoutez la vôtre si vous en avez une (recommandé). Sans clé, Hetzner envoie un mot de passe root par e-mail : le script le laisse fonctionner.
- **Cloud config** (champ « Cloud config » en bas de la page) : collez exactement ceci.

```yaml
#cloud-config
runcmd:
  - curl -fsSL https://raw.githubusercontent.com/Soudaysse-ia/twabibu/main/infra/scripts/demo-quickstart.sh -o /root/demo-quickstart.sh
  - bash /root/demo-quickstart.sh > /var/log/twabibu-quickstart.log 2>&1
```

Cliquez sur *Create & Buy now*. Notez l’**adresse IPv4** affichée (par exemple `203.0.113.5`).

## 2. Attendre (environ 10 minutes)
Le serveur s’installe tout seul : mises à jour, Docker, pare-feu (ports 22, 80 et 443 seulement), sauvegarde quotidienne, secrets générés sur place, images de Twabibu, base de données, données de démonstration, certificat HTTPS.

## 3. Ouvrir la démo
Remplacez les points de l’adresse IP par des tirets : `203.0.113.5` donne

- **Site** : `https://203-0-113-5.sslip.io`
- **Comptes de démonstration** : `https://203-0-113-5.sslip.io/demo` (code `000000`)

`sslip.io` est un service gratuit qui fait pointer ce nom vers l’adresse du serveur ; Caddy obtient un vrai certificat HTTPS pour ce nom. Il convient à une démo, pas à la production.

Rien ne s’affiche après 15 minutes ? Connectez-vous (`ssh root@203.0.113.5`, ou console web Hetzner > *Console*) et lisez la fin du journal :
```bash
tail -50 /var/log/twabibu-quickstart.log
```

## Sans « Cloud config » (OVHcloud, ou si vous avez oublié le champ)
Connectez-vous au serveur en root, puis :
```bash
curl -fsSL https://raw.githubusercontent.com/Soudaysse-ia/twabibu/main/infra/scripts/demo-quickstart.sh -o quickstart.sh
```
```bash
bash quickstart.sh
```
Le script affiche l’adresse du site à la fin.

## Ensuite
- **Mettre à jour la démo** avec la dernière version de `main` : `bash /srv/twabibu/scripts/demo-quickstart.sh` (garde les secrets et l’adresse ; relance migrations et données de démo).
- **Back-office** (`https://admin.<adresse>`) : fermé par défaut. Pour l’ouvrir à votre adresse IP, modifiez `ADMIN_ALLOWED_IPS` dans `/srv/twabibu/.env`, puis `cd /srv/twabibu && docker compose up -d caddy`. Il n’y a pas de compte de démonstration du back-office en ligne (ADR-020) : créez-en un avec `cd /srv/twabibu && docker compose run --rm api node_modules/tsx/dist/cli.mjs prisma/create-admin.ts <votre e-mail> SUPERADMIN` (voir `mise-en-production-hetzner.md` §7).
- **Passer sur un vrai nom** (`staging.twabibu.km`) quand le domaine existe : enregistrement DNS `A` vers l’IP, puis dans `/srv/twabibu/.env` remplacez l’ancienne adresse dans `APP_URL`, `ADMIN_URL`, `SITE_DOMAIN` et `ADMIN_DOMAIN`, puis `cd /srv/twabibu && docker compose up -d`. Sur un serveur neuf : `DEMO_DOMAIN=staging.twabibu.km bash quickstart.sh`.
- **Déploiement automatique à chaque fusion dans `main`** : secrets GitHub `DEPLOY_HOST`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS` et variable `DEPLOY_ENABLED=true` (`mise-en-production-hetzner.md` §3 et §6). Le serveur installé par ce script a déjà l’utilisateur `deploy` et le dossier attendus.

## Ce que fait le script
| Étape | Détail |
|---|---|
| Système | `server-setup.sh` : mises à jour automatiques, Docker, utilisateur `deploy`, pare-feu, SSH par clé seulement si root a une clé, sauvegarde quotidienne à 02:30 UTC |
| Fichiers | `docker-compose.yml`, `Caddyfile` et `scripts/` dans `/srv/twabibu`, depuis la branche `main` du dépôt (option `TWABIBU_REF`) |
| Configuration | `/srv/twabibu/.env` créé une seule fois à partir de `infra/env/staging.env.example` : adresse, secrets tirés au hasard sur le serveur (`openssl rand`), e-mails et SMS factices, back-office fermé |
| Déploiement | `scripts/deploy.sh staging` : images publiques `ghcr.io/soudaysse-ia/twabibu-*:staging` (construites à chaque fusion dans `main`), migrations, données de démo, démarrage, contrôles de santé |

Testé le 21/11/2026 dans un conteneur avec Docker (images locales, nom `twabibu.localhost`) : 6 services en bonne santé, pages et `/api/ready` en 200 à travers Caddy, back-office refusé (403), parcours Playwright P1, P2, aide et contact verts en HTTPS, deuxième passage sans régénérer les secrets. La partie « Système » (`server-setup.sh`) et le certificat `sslip.io` ne peuvent se vérifier que sur un vrai serveur.
