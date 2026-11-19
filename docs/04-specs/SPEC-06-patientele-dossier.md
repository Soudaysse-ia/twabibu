# SPEC-06 — Patientèle et dossier patient (cabinet)

## Objectif
Donner au cabinet une base patients propre, reliée aux rendez-vous, avec des notes et documents, sans construire un logiciel médical complet.

## Règles métier
1. **PatientRecord** = la fiche du patient *dans ce cabinet*. Elle est créée : automatiquement à la première réservation en ligne (copie identité + téléphone + lien `patientProfileId`/`relativeId`), par la secrétaire à la volée, ou par import CSV. Le cabinet A ne voit jamais la fiche du cabinet B.
2. **Rapprochement** : à chaque réservation en ligne, recherche d'une fiche existante par (téléphone + date de naissance) ou (`patientProfileId`) ; sinon création. Doublons détectés (même nom + naissance) → suggestion de fusion.
3. **Contenu de la fiche** : identité, naissance, sexe, téléphone(s), e-mail, adresse (localité/île), assurance, personne à contacter, étiquettes (ex. « VIP », « Diabète suivi » — libres, définies par le cabinet), notes administratives (visibles par la secrétaire), **notes cliniques** (visibles uniquement par les praticiens, chiffrées), documents (SPEC-09), historique des RDV (passés, à venir, annulés, non honorés avec compteur), compte Twabibu lié (oui/non, « inviter par SMS »).
4. **Blocage** : `isBlocked` + motif ; le patient ne peut plus réserver en ligne chez ce cabinet (message « contactez le cabinet ») ; le cabinet peut toujours créer un RDV. Déblocage à tout moment.
5. **Recherche instantanée** : par nom, prénom, téléphone (3 derniers chiffres suffisent), date de naissance ; résultats en < 200 ms sur 20 000 fiches (index trigram).
6. **Fusion** : conserve la fiche cible, rattache RDV/notes/documents, journalise.
7. **Import CSV** : modèle fourni (prénom, nom, naissance, téléphone, e-mail, notes), aperçu, détection de doublons, rapport d'erreurs par ligne.
8. **Export** : CSV de la patientèle (admin de structure, journalisé).
9. **Suppression** : à la demande du patient ou du cabinet, anonymisation (nom → « Patient supprimé »), RDV passés conservés anonymisés 3 ans.

## Écrans
- `/pro/app/patients` : barre de recherche + liste (nom, téléphone, dernier RDV, prochain RDV, étiquettes, badge bloqué), bouton « + Patient », « Importer ».
- `/pro/app/patients/{id}` : en-tête (identité, âge, téléphone cliquable, badges), onglets **Rendez-vous** (timeline), **Informations**, **Notes** (praticiens), **Documents** ; bouton « Prendre rendez-vous » (ouvre le tiroir agenda pré-rempli).
- Modale « Nouveau patient » réutilisée dans l'agenda.

## API
`GET /pro/orgs/{orgId}/patients?q=`, CRUD patients, `block/unblock/merge`, `import`, `GET/POST patients/{id}/notes`, documents (SPEC-09).

## Critères d'acceptation
- [ ] Une réservation en ligne d'un nouveau patient crée exactement une fiche ; une deuxième réservation la réutilise.
- [ ] Une secrétaire ne reçoit jamais le contenu des notes cliniques (test API 403 + absence dans la réponse).
- [ ] Recherche « 45 12 » trouve le patient dont le numéro finit par 4512.
- [ ] Fusion de deux fiches conserve tous les RDV et écrit un `AuditLog`.

## Tickets
PATIENT-01 modèle + rapprochement automatique · PATIENT-02 recherche + liste · PATIENT-03 fiche (onglets) · PATIENT-04 notes cliniques chiffrées + droits · PATIENT-05 blocage/fusion · PATIENT-06 import/export CSV · PATIENT-07 tests.
