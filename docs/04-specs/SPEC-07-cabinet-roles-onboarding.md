# SPEC-07 — Cabinet, rôles, onboarding et vérification des soignants

## Objectif
Faire entrer un soignant sur Twabibu en 15 minutes, vérifier son identité professionnelle, et lui permettre de travailler avec son équipe avec des droits adaptés.

## Inscription soignant (`/pro/inscription`)
1. Étape 1 : vous êtes ? (praticien indépendant / je représente un établissement) ; spécialité ; prénom, nom, titre ; e-mail (obligatoire, vérifié par lien), téléphone (OTP), mot de passe fort ; nom du cabinet ; île + localité ; CGV + confidentialité.
2. Création : `User(PROFESSIONAL)` + `Organization(PENDING)` + `Practitioner(UNVERIFIED)` + `Membership(OWNER)` + agenda par défaut + motifs modèles de la spécialité.
3. Redirection vers l'**onboarding** (`/pro/app/onboarding`), 6 étapes avec barre de progression, chacune ignorable sauf la 1 : (1) Vérification : dépôt des pièces (diplôme, autorisation d'exercer / inscription à l'Ordre, pièce d'identité ; PDF/JPG ≤ 10 Mo) ; (2) Lieu : adresse, localité, position sur la carte (glisser le marqueur), accès, téléphone du cabinet ; (3) Horaires d'ouverture ; (4) Motifs (modèles pré-cochés, durée, tarif) ; (5) Disponibilités en ligne (copier les horaires d'ouverture en un clic) ; (6) Profil public : photo, présentation, langues, expertises, moyens de paiement, assurances.
4. Pendant la vérification (`PENDING`) : le soignant peut tout paramétrer et tester son agenda ; son profil n'est pas public ; bandeau « Votre profil sera publié après vérification (sous 48 h ouvrées) ». À la validation : e-mail + SMS « Votre profil Twabibu est en ligne » + badge vérifié.

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

## Paramètres du cabinet
Nom, type, logo, description, téléphone, e-mail, site, lieux (CRUD), notification (SPEC-08), abonnement (SPEC-11), suppression (demande au support).

## Critères d'acceptation
- [ ] Inscription + onboarding complets en environnement de test en < 15 min par un utilisateur non formé (test utilisateur).
- [ ] Un praticien `PENDING` n'apparaît pas dans la recherche ; après validation admin il apparaît en < 1 min.
- [ ] Matrice de permissions couverte par des tests automatisés (chaque cellule).
- [ ] Une invitation expirée ne permet pas de créer un compte.

## Tickets
PRO-01 inscription soignant + création des entités · PRO-02 onboarding 6 étapes · PRO-03 dépôt de pièces + statuts de vérification · PRO-04 rôles/permissions (service + guards + tests) · PRO-05 équipe et invitations · PRO-06 paramètres cabinet et lieux (carte, marqueur) · PRO-07 profil public édition (photos, expertises, tarifs) · PRO-08 journal d'activité · PRO-09 tests.
