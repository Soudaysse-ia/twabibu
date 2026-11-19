# Sécurité et données de santé

Twabibu traite des données personnelles et des données de santé (motif de consultation, notes, documents). Il n'existe pas aux Comores d'équivalent au référentiel HDS français ; nous appliquons volontairement **le niveau d'exigence RGPD / HDS** comme standard interne, ce qui est aussi un argument commercial auprès des soignants.

## 1. Principes
1. **Minimisation** : on ne collecte que ce qui sert au rendez-vous. Pas de numéro d'identité nationale pour les patients.
2. **Cloisonnement** : un cabinet ne voit que sa patientèle ; une secrétaire ne voit jamais les notes cliniques ; un patient ne voit que ses données et celles de ses proches déclarés.
3. **Traçabilité** : toute lecture ou écriture de donnée de santé est journalisée (`AuditLog`) avec l'acteur, l'horodatage et l'IP.
4. **Aucune donnée médicale dans les canaux non sécurisés** : SMS, WhatsApp, e-mails ne contiennent que date, heure, nom du soignant, adresse, lien — jamais le motif détaillé ni un document.
5. **Chiffrement** : TLS 1.2+ partout ; disques chiffrés ; champs sensibles (`ClinicalNote.content`, pièces de vérification, documents) chiffrés applicativement (AES-256-GCM, clés en variable d'environnement puis KMS) ; mots de passe argon2id ; OTP et tokens hachés (SHA-256) en base.
6. **Défense en profondeur** : WAF Cloudflare, limitation de débit, validation stricte des entrées (Zod), en-têtes de sécurité (CSP, HSTS, X-Frame-Options), cookies `Secure; HttpOnly; SameSite=Lax`.

## 2. Authentification et sessions
- Patients : téléphone + OTP (6 chiffres, 5 min, 5 essais) à l'inscription et pour la connexion sans mot de passe ; mot de passe facultatif mais proposé (8 caractères min, vérification contre les listes de mots de passe compromis).
- Professionnels : e-mail + mot de passe fort (12 caractères, zxcvbn ≥ 3), **2FA TOTP recommandée** (obligatoire pour les rôles `OWNER`/`ADMIN` à partir de la V1), notification de nouvelle connexion.
- Admins plateforme : 2FA obligatoire, allowlist d'IP optionnelle.
- Sessions : access token JWT 15 min (signature ES256), refresh token rotatif 30 j avec détection de réutilisation (révocation de la famille), liste des sessions actives visible par l'utilisateur.
- Déconnexion automatique de l'espace Pro après 12 h d'inactivité ; verrouillage d'écran recommandé sur les postes partagés.

## 3. Autorisations (RBAC + ownership)
| Ressource | Patient | Secrétaire | Praticien | Admin structure | Admin Twabibu |
|---|---|---|---|---|---|
| Ses RDV / ses proches | lecture/écriture | — | — | — | support (lecture, journalisée) |
| Agenda du cabinet | — | lecture/écriture (agendas autorisés) | lecture/écriture (ses agendas, ou tous si autorisé) | tout | lecture |
| Fiche patient (administratif) | — | lecture/écriture | lecture/écriture | tout | support |
| Notes cliniques | — | **jamais** | auteur (+ confrères autorisés) | **jamais** par défaut | **jamais** |
| Documents patient | les siens | envoi/réception si autorisé | oui | oui | non |
| Paramètres agenda / motifs | — | si autorisé | oui | oui | — |
| Équipe, abonnement | — | — | — | oui | oui |
| Vérification, référentiels | — | — | — | — | oui |

Dossier médical (SPEC-13) : lecture/écriture réservée aux praticiens de la structure **avec consentement du patient** (ou entrées propres) ; accès d'urgence journalisé et notifié ; secrétaires et admins exclus. Pharmacies : accès au contenu d'une ordonnance uniquement si le patient la leur a envoyée ; livreurs : adresse et nombre de colis seulement.

Implémentation : `MembershipGuard` + `PermissionsService.can(user, action, resource)` centralisé ; tests d'autorisation obligatoires pour chaque route Pro (ticket SEC-02).

## 4. Données personnelles (inspiré du RGPD)
- Information claire à l'inscription (finalités, destinataires, durée), consentement séparé pour les communications non essentielles.
- Droits : accès (export JSON/PDF), rectification (dans le compte), suppression (anonymisation des RDV passés, suppression des proches et documents, conservation du journal 1 an), opposition aux rappels.
- Durées de conservation : compte inactif 3 ans → anonymisation ; journaux 1 an ; sauvegardes 35 jours ; OTP 5 min ; verrous 10 min.
- Sous-traitants documentés (hébergeur, SMS, e-mail, stockage) dans `docs/07-references/sous-traitants.md` (à créer au moment des contrats).
- Registre des traitements tenu par l'équipe Twabibu.

## 5. Sécurité applicative (checklist par ticket)
- [ ] Validation Zod de toutes les entrées, y compris query et params.
- [ ] Autorisation vérifiée côté service (pas seulement côté UI).
- [ ] Pas de donnée sensible dans les logs ni dans les URL.
- [ ] Uploads : types MIME vérifiés par signature, taille max 10 Mo, nom de fichier régénéré, URL signée 5 min, scan antivirus (ClamAV) en V1.
- [ ] Limitation de débit sur toute route publique d'écriture.
- [ ] Tests d'IDOR (accéder à l'objet d'un autre) sur chaque route avec identifiant.
- [ ] Dépendances auditées (`pnpm audit`, Dependabot).
- [ ] Secrets uniquement via variables d'environnement / gestionnaire de secrets ; jamais dans le dépôt.

## 6. Sauvegardes et continuité
- PostgreSQL : sauvegarde complète quotidienne + WAL en continu (pgBackRest ou `wal-g`) vers un bucket chiffré dans une autre région ; test de restauration mensuel (script `infra/scripts/restore-test.sh`).
- Objets S3 : versioning activé.
- RPO 15 min, RTO 4 h. Procédure d'incident documentée (`docs/03-architecture/runbooks/`), contacts, communication aux cabinets.

## 7. Conformité locale
- Vérifier le cadre comorien applicable (loi sur la protection des données personnelles si adoptée, code de la santé publique 1995, exigences de l'Ordre / du ministère pour l'affichage des soignants). Action : consultation juridique avant le lancement public (ticket LEGAL-01).
- CGU patients, CGV soignants, politique de confidentialité, mentions légales : rédigées en français, validées juridiquement.
