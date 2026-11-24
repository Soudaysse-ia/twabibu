# SPEC-11 — Back-office Twabibu

## Objectif
Donner à l'équipe Twabibu les outils pour vérifier les soignants, gérer les référentiels, assister les utilisateurs et suivre l'activité, sans toucher à la base de données à la main.

## Accès
App séparée (`apps/admin`, `admin.twabibu.km`), rôle `PLATFORM_ADMIN` (+ sous-rôles `SUPPORT`, `VERIFIER`, `FINANCE` en V1), 2FA obligatoire, toutes les actions journalisées.

## Fonctions
1. **Tableau de bord** : soignants vérifiés / en attente, RDV du jour / 7 j / 30 j, % en ligne, SMS envoyés et coût estimé, échecs de notification, nouveaux comptes patients, signalements ouverts.
2. **File de vérification** : liste triée par ancienneté (`PENDING`), fiche : identité, spécialité, cabinet, pièces (visionneuse), checklist (pièces lisibles, nom cohérent, autorisation valide, appel de confirmation fait), actions « Valider », « Demander des compléments » (message), « Refuser » (motif), historique. Notifications au soignant à chaque action.
3. **Soignants et structures** : recherche, fiche, suspendre/réactiver (avec motif, dépublication immédiate), éditer le profil pour le compte du soignant (journalisé), voir les agendas (lecture), forcer un nouveau slug, fusionner des doublons.
4. **Patients** (support) : recherche par téléphone/nom, voir les RDV (sans notes cliniques), renvoyer un OTP, corriger un numéro (avec vérification), anonymiser un compte sur demande, voir les notifications envoyées.
5. **Référentiels** : spécialités (nom, pluriel, groupe, motifs modèles, icône, actif), expertises, localités (île, nom, coordonnées, type), langues, assurances, jours fériés, articles du centre d'aide (markdown).
6. **Signalements** : file, détail, actions (ignorer, contacter le soignant, dépublier).
   > **Réalisé le 23/11/2026 (ADMIN-07)** : page « Signalements » (`apps/admin`), zone ouverte à la vérification et au support. « Écrire au soignant » envoie un e-mail avec le motif seulement, sans l’auteur ni les précisions, et garde le signalement à suivre ; « Retirer le profil du site » le dépublie (plus de recherche ni de réservation, jusqu’à nouvelle vérification) et clôt les autres signalements du profil. Modèle `Report` existant (`entityType = Practitioner`), décisions dans le journal d’audit.
7. **Abonnements** : plans (nom, prix KMF, quota SMS, sièges), abonnement par structure (statut, dates, sièges), saisie d'un paiement manuel (espèces / virement / MVola / Huri Money, référence), génération de facture PDF, relances.
8. **Notifications** : journal filtrable (statut, canal, numéro, date), détail, renvoi, statistiques par fournisseur et coût.
9. **Journal d'audit** : recherche par acteur, entité, période ; export.
10. **Feature flags** : activer/désactiver WhatsApp, liste d'attente, messagerie, paiements par structure ou globalement.

## Critères d'acceptation
- [x] Valider un dossier publie le profil et envoie les notifications ; refuser le dépublie et informe.
- [x] Toute action admin est présente dans `AuditLog` avec l'acteur (test).
- [x] Aucune note clinique n'est accessible depuis le back-office (test).
- [x] Les référentiels modifiés sont visibles dans la recherche après invalidation du cache (< 1 min). *(Cache de l’annuaire et des suggestions ramené à 60 s ; test.)*

### Règles ajoutées pendant la réalisation (13/11/2026, ADR-018)
- Rôles : `SUPERADMIN` (tout), `VERIFIER` (vérifications, structures, pharmacies, gardes), `SUPPORT` (patients, notifications, structures en lecture), `FINANCE` (emplacements). Journal d’audit et options : `SUPERADMIN` seulement.
- Connexion : code par e-mail puis code TOTP (application d’authentification, QR code à la première connexion), redemandé après 12 h ; 5 essais par 10 minutes. En local seulement (`EMAIL_PROVIDER=fake`), le code `000000` est accepté.
- Valider un soignant exige les 4 contrôles cochés ; demander des compléments ou refuser exige un message, envoyé par e-mail.
- Suspendre une structure dépublie aussitôt ses soignants et ferme l’espace Pro / Pharma ; la réactivation republie les soignants vérifiés qui étaient en ligne.
- Le support ne voit ni le motif des rendez-vous ni le contenu des messages ; chaque fiche patient ouverte est journalisée.
- Un calendrier de gardes importé est accepté entier ou refusé entier ; une pharmacie ne peut pas avoir deux gardes qui se chevauchent.

### Référentiels (16/11/2026, ADR-019)
- Rôle : `VERIFIER` (et `SUPERADMIN`). Faits : spécialités (nom, groupe, prescription, motifs modèles 5 à 240 min par pas de 5, ordre), localités (île, nom, coordonnées contrôlées dans les limites des Comores, type), jours fériés (ajout, confirmation d’une date estimée, déplacement, suppression), médicaments (DCI, dosage, forme, voie, noms commerciaux, code ATC, sur ordonnance, contrôlé, essentiel).
- L’adresse (slug) d’une spécialité, d’une localité ou d’un médicament ne change jamais ; une localité homonyme sur une autre île reçoit le nom de l’île (`mbeni-ndzuani`).
- On désactive, on ne supprime pas : refusé tant qu’un soignant publié utilise la spécialité ou qu’un lieu de soins utilise la localité. Un médicament retiré ne peut plus être prescrit ni ajouté à un catalogue ; il disparaît des recherches et de sa page publique.
- Un médicament contrôlé est toujours sur ordonnance ; ses indicateurs sont recopiés sur les produits des pharmacies qui le vendent.
- Pas encore faits : expertises, langues, assurances, articles du centre d’aide.

## Tickets
ADMIN-01 app + auth 2FA + layout · ADMIN-02 tableau de bord · ADMIN-03 file de vérification · ADMIN-04 soignants/structures (actions) · ADMIN-05 support patients · ADMIN-06 référentiels CRUD · ADMIN-07 signalements · ADMIN-08 abonnements + factures PDF · ADMIN-09 journal notifications + audit · ADMIN-10 feature flags · ADMIN-11 tests.
