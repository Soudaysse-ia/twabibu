# Sauvegarde et restauration

## Ce qui tourne tout seul
- **Chaque nuit à 02:30 UTC** : `scripts/backup.sh` fait un export complet de la base (`pg_dump`, format compressé) dans `/srv/twabibu/backups`, vérifie qu’il est lisible et le garde 14 jours. Si `BACKUP_RCLONE_REMOTE` et `BACKUP_AGE_RECIPIENT` sont renseignés, une copie **chiffrée** (`age`) part hors du serveur (Storage Box). Journal : `backups/backup.log`. Date du dernier succès : `backups/.last-success`.
- **Avant chaque mise en production** : la même sauvegarde, lancée par `deploy.sh`.
- **Le 1er de chaque mois à 04:00 UTC** : test de restauration de la dernière sauvegarde dans une base temporaire, supprimée ensuite. Journal : `backups/restore-test.log`.
- En production, les **sauvegardes Hetzner** du serveur s’ajoutent à tout cela.

Objectifs : au plus 24 h de données perdues (une sauvegarde par jour) et remise en service en moins de 2 h. Pour descendre sous 24 h, il faudra l’archivage continu (pgBackRest ou WAL-G, prévu dans le plan, non encore installé).

## Vérifier
```bash
ssh deploy@<IP> 'cat /srv/twabibu/backups/.last-success; ls -lh /srv/twabibu/backups | tail -3; tail -2 /srv/twabibu/backups/restore-test.log'
```
Alerte à mettre en place (INFRA-05) : aucune sauvegarde depuis plus de 26 h.

## Restaurer
**Symptômes** : données perdues ou abîmées (erreur humaine, migration ratée), serveur perdu.

1. Choisir la sauvegarde : la plus récente avant l’incident (`ls -lt /srv/twabibu/backups`). Pour une copie hors serveur : `rclone copy storagebox:twabibu/<fichier>.age .` puis `age -d -i twabibu-backup.key -o <fichier>.dump <fichier>.age` (la clé privée est dans le gestionnaire de mots de passe).
2. Tester d’abord : `./scripts/restore.sh --test backups/<fichier>.dump`.
3. Restaurer pour de bon : `./scripts/restore.sh backups/<fichier>.dump`. Le script demande de taper le nom de domaine, fait une sauvegarde de l’état actuel, arrête le site, remplace la base et redémarre.
4. Vérifier : `/api/ready`, une connexion patient, une connexion Pro, le nombre de rendez-vous du jour.

**Serveur perdu** : recréer un serveur (`mise-en-production-hetzner.md`, étapes 1 à 4, avec le **même** `.env`), déployer le dernier tag, puis restaurer la dernière copie hors serveur.

## Communication
Toute perte de données de santé est un incident de sécurité : suivre aussi `incident-securite.md` (à rédiger) et prévenir la personne responsable de la protection des données.
