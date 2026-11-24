# SPEC-07 — Cabinet, rôles, onboarding et vérification des soignants

## Objectif
Faire entrer un soignant sur Twabibu en 15 minutes, vérifier son identité professionnelle, et lui permettre de travailler avec son équipe avec des droits adaptés.

## Inscription soignant (`/pro/inscription`)
1. Étape 1 : vous êtes ? (praticien indépendant / je représente un établissement) ; spécialité ; prénom, nom, titre ; e-mail (obligatoire, vérifié par lien), téléphone (OTP), mot de passe fort ; nom du cabinet ; île + localité ; CGV + confidentialité.
2. Création : `User(PROFESSIONAL)` + `Organization(PENDING)` + `Practitioner(UNVERIFIED)` + `Membership(OWNER)` + agenda par défaut + motifs modèles de la spécialité.
3. Redirection vers l'**onboarding** (`/pro/app/onboarding`), 6 étapes avec barre de progression, chacune ignorable sauf la 1 : (1) Vérification : dépôt des pièces (diplôme, autorisation d'exercer / inscription à l'Ordre, pièce d'identité ; PDF/JPG ≤ 10 Mo) ; (2) Lieu : adresse, localité, position sur la carte (glisser le marqueur), accès, téléphone du cabinet ; (3) Horaires d'ouverture ; (4) Motifs (modèles pré-cochés, durée, tarif) ; (5) Disponibilités en ligne (copier les horaires d'ouverture en un clic) ; (6) Profil public : photo, présentation, langues, expertises, moyens de paiement, assurances.
4. Pendant la vérification (`PENDING`) : le soignant peut tout paramétrer et tester son agenda ; son profil n'est pas public ; bandeau « Votre profil sera publié après vérification (sous 48 h ouvrées) ». À la validation : e-mail + SMS « Votre profil Twabibu est en ligne » + badge vérifié.

> **Réalisé le 19/11/2026 (PRO-01)** : identité par e-mail et code (ADR-016), donc ni mot de passe ni téléphone de compte ; le téléphone demandé est celui du cabinet (affiché aux patients, utile à l’appel de vérification). Le numéro d’autorisation d’exercer est demandé dès l’inscription. Tant que le dépôt des pièces (PRO-03) n’existe pas, le praticien est créé directement en `PENDING` pour entrer dans la file de vérification ; la structure est `PENDING` puis passe `ACTIVE` à la première validation. Motifs de départ selon le groupe de la spécialité (`MOTIVE_TEMPLATES` dans `apps/api/src/pro/pro-signup.service.ts`).

## Vérification (back-office, SPEC-11)
Statuts : `UNVERIFIED` (pièces manquantes) → `PENDING` (dossier déposé) → `VERIFIED` | `REJECTED` (motif) | `CHANGES_REQUESTED` (message, pièces à refournir). Contrôles : lisibilité des pièces, cohérence nom/spécialité, numéro d'autorisation si disponible, appel téléphonique de confirmation (checklist dans l'outil). Revérification annuelle légère (rappel).

## Rôles et permissions
| Permission | OWNER | ADMIN | PRACTITIONER | SECRETARY |
|---|---|---|---|---|
| Voir/modifier ses agendas | ✔ | ✔ | ✔ (les siens) | ✔ (agendas autorisés) |
| Voir/modifier tous les agendas | ✔ | ✔ | option | option |
| Paramétrer motifs/plages/absences | ✔ | ✔ | ✔ (les siens) | option |
| Patientèle (administratif) | ✔ | ✔ | ✔ | ✔ |
| Notes cliniques | — | — | ✔ (les siennes) | — |
| Documents | ✔ | ✔ | ✔ | option |
| Profil public des praticiens | ✔ | ✔ | ✔ (le sien) | — |
| Équipe, invitations, rôles | ✔ | ✔ | — | — |
| Abonnement, factures | ✔ | ✔ | — | — |
| Statistiques | ✔ | ✔ | ✔ (les siennes) | option |
| Supprimer la structure | ✔ | — | — | — |

« option » = case à cocher dans `Membership.permissions`. Les permissions sont évaluées par `PermissionsService` (API) et exposées à l'UI via `/auth/me` pour masquer les menus.

## Équipe (`/pro/app/parametres/equipe`)
- Liste des membres (nom, rôle, agendas, dernier accès), « Inviter » (e-mail ou téléphone, rôle, agendas autorisés) → lien d'invitation 7 jours ; l'invité crée son mot de passe ; retirer un membre révoque ses sessions.
- Journal d'activité (V1) : filtre par membre, type, date.

> **Réalisé le 21/11/2026 (PRO-05)** : page `/pro/app/reglages/equipe`. Identité par e-mail et code (ADR-016), donc invitation par e-mail seulement et pas de mot de passe : l’invité confirme l’adresse invitée avec un code, son compte professionnel est créé à ce moment. On invite une secrétaire (agendas autorisés, droit aux réglages) ou, titulaire seulement, un administrateur ; un praticien rejoint par sa propre inscription, son autorisation d’exercer devant être vérifiée. Règles : personne ne se retire soi-même ni ne retire le titulaire ; un administrateur ne retire pas un autre administrateur ; retirer ferme toutes les sessions du membre ; une nouvelle invitation à la même adresse annule la précédente.

## Profil public (`/pro/app/reglages/profil`)
> **Réalisé le 24/11/2026 (PRO-07, partiel)** : présentation (2 000 caractères), « J’accepte de nouveaux patients », expertises (20 mots-clés, doublons écartés sans tenir compte des majuscules), langues et assurances prises dans les référentiels (ce qui garde les filtres de la recherche justes), moyens de paiement (espèces, MVola, Huri Money, carte, virement), formations (année, diplôme, établissement ; année à venir refusée ; triées de la plus récente). Le praticien modifie son profil, le titulaire et les administrateurs ceux de tous les praticiens du cabinet, la secrétaire aucun. Nom, spécialité et numéro d’autorisation sont affichés sans être modifiables : ils sont vérifiés, la correction passe par le support (SPEC-02 §Règles 8). Les tarifs restent réglés motif par motif. Chaque enregistrement qui change quelque chose est journalisé (`practitioner.profile.update`, noms des champs seulement). Restent : photos (stockage de fichiers à mettre en place, comme pour PRO-03) et rubrique « Expérience ».

## Paramètres du cabinet
Nom, type, logo, description, téléphone, e-mail, site, lieux (CRUD), notification (SPEC-08), abonnement (SPEC-11), suppression (demande au support).

> **Réalisé le 24/11/2026 (PRO-06, partiel)** : page « Cabinet et horaires » (`/pro/app/reglages/cabinet`), une fiche par lieu existant : nom, adresse (avec repère local), île et localité, téléphone (vide = non affiché), position (repère à faire glisser ou toucher la carte, « Je suis au cabinet : utiliser ma position », retour au centre de la localité ; une position hors des Comores est refusée ; sans repère, le centre de la localité), accès (étage, fauteuil roulant, ascenseur, stationnement, précisions), horaires d’ouverture (jusqu’à 3 plages par jour, au quart d’heure, écrits en 24 h quel que soit le téléphone ; plages qui se chevauchent ou finissent avant de commencer refusées ; « Copier le lundi du mardi au vendredi »). Toute l’équipe lit, le titulaire et l’administration modifient. Changer de localité change l’adresse du profil public. Chaque modification est journalisée (`practice.update`, noms des champs). Restent : ajouter ou retirer un lieu, logo, description, e-mail et site du cabinet.

## Critères d'acceptation
- [ ] Inscription + onboarding complets en environnement de test en < 15 min par un utilisateur non formé (test utilisateur).
- [ ] Un praticien `PENDING` n'apparaît pas dans la recherche ; après validation admin il apparaît en < 1 min.
- [ ] Matrice de permissions couverte par des tests automatisés (chaque cellule).
- [x] Une invitation expirée ne permet pas de créer un compte (test `apps/api/src/team.test.ts`).

## Tickets
PRO-01 inscription soignant + création des entités · PRO-02 onboarding 6 étapes · PRO-03 dépôt de pièces + statuts de vérification · PRO-04 rôles/permissions (service + guards + tests) · PRO-05 équipe et invitations · PRO-06 paramètres cabinet et lieux (carte, marqueur) · PRO-07 profil public édition (photos, expertises, tarifs) · PRO-08 journal d'activité · PRO-09 tests.
