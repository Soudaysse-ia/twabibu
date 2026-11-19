# Déployer, revenir en arrière

**Symptômes / quand** : une nouvelle version est prête (fusion sur `main` pour la pré-production, tag `vX.Y.Z` pour la production), ou une version déployée pose problème.

## Déploiement normal
1. **Pré-production** : fusionner sur `main`. Le workflow *Deploy* construit les trois images (`api`, `web` en mode démo, `admin`), les publie avec le tag `sha-<commit>` et les déploie.
2. Vérifier la pré-production (parcours patient, Pro, Pharma, back-office).
3. **Production** : `git tag v0.2.0 && git push origin v0.2.0`. Le workflow construit les images sans le mode démo, puis attend la validation d’un relecteur (environnement GitHub `production`).
4. Sur le serveur, `scripts/deploy.sh` fait dans l’ordre : téléchargement des images, **sauvegarde** (production), migrations Prisma, données de démo (pré-production seulement), redémarrage, attente des contrôles de santé. Il s’arrête à la première erreur. **Si la nouvelle version échoue à ses contrôles de santé, il relance aussitôt la précédente**, garde les journaux dans `deploy-failure-<date>.log` et le note dans `deployments.log` ; le workflow GitHub apparaît alors en échec.
5. Le workflow vérifie enfin `https://<domaine>/api/ready`.

L’historique est dans `/srv/twabibu/deployments.log`.

## Revenir à la version précédente
- Depuis GitHub : *Actions > Deploy > Run workflow*, choisir l’environnement et le tag précédent (voir `deployments.log` ou les tags Git).
- Depuis le serveur : `ssh deploy@<IP> /srv/twabibu/scripts/rollback.sh` (ou `rollback.sh v0.1.0`). Les images des 14 derniers jours restent sur le serveur.

Les migrations ne sont **pas** annulées : elles doivent toujours rester compatibles avec la version précédente. Pour renommer ou supprimer une colonne, on procède en deux versions : d’abord ajouter la nouvelle et écrire dans les deux, ensuite seulement retirer l’ancienne. Si une migration a abîmé des données, voir `sauvegarde-restauration.md`.

## Diagnostic
```bash
ssh deploy@<IP>
cd /srv/twabibu
docker compose ps                       # état et santé des services
docker compose logs --tail 200 api      # erreurs de l’API (aucune donnée médicale dans les journaux)
docker compose logs --tail 100 caddy    # certificats, accès
cat deployments.log
```
- **`Invalid environment`** au démarrage de l’API : une variable manque ou est invalide dans `.env` (le message dit laquelle).
- **`EMAIL_PROVIDER=fake is not allowed`** : la production exige un vrai fournisseur d’e-mails (`brevo`).
- **Certificat absent** : en `TLS_MODE=acme`, l’enregistrement DNS doit être en « DNS only » et les ports 80 et 443 ouverts.

## Communication
Prévenir l’équipe (et les cabinets pilotes si le site a été indisponible plus de 5 minutes) : ce qui s’est passé, la durée, ce qui a été fait.
