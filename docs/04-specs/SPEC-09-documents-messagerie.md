# SPEC-09 — Documents et messagerie

## Objectif
Faire circuler les documents utiles au parcours (ordonnance, certificat, compte rendu, résultat) entre le cabinet et le patient, de façon sécurisée, puis (V2) permettre des échanges écrits encadrés.

## Documents (V1)
1. **Depuis le cabinet** (fiche patient ou RDV) : téléverser un PDF/JPG/PNG (≤ 10 Mo), choisir le type, « Partager avec le patient » (coché par défaut) → `Document(direction: TO_PATIENT)` ; notification « un document vous a été envoyé » ; visible dans « Mes documents » du patient, avec aperçu et téléchargement (URL signée 5 min). Horodatage de première consultation (`viewedAt`) visible par le cabinet.
2. **Depuis le patient** : « Ajouter un document » (à partir de « Mes documents » ou du détail d'un RDV à venir : « Documents à apporter ») → `FROM_PATIENT`, visible par le cabinet concerné uniquement si rattaché à un RDV ou partagé explicitement avec un cabinet.
3. **Demande de documents** : un motif peut lister des documents demandés avant le RDV (ex. « résultats d'analyses ») ; rappel dans le SMS de confirmation (« pensez à apporter … »), zone d'upload dans le détail du RDV.
4. **Proches** : les documents d'un proche sont dans l'onglet du proche, accessibles au titulaire du compte.
5. **Sécurité** : fichiers chiffrés côté stockage (SSE) + clé applicative, scan antivirus (ClamAV) avant mise à disposition, type MIME vérifié par signature, nom régénéré, journal d'accès.
6. **Conservation** : tant que le compte existe ; suppression par le patient possible pour ses propres documents ; le cabinet garde sa copie 3 ans (obligation de suivi) sauf demande expresse.
7. **Modèles de documents** (V2) : en-tête du cabinet (logo, adresse, n° d'autorisation), génération PDF d'un certificat/ordonnance simple à partir d'un texte, signature image.

## Messagerie (V2)
- Activée par cabinet (`messagingEnabled`), avec règles affichées au patient : délai de réponse indicatif, « pas pour les urgences », horaires.
- Fil par patient × cabinet ; le cabinet peut clore un fil ; pièces jointes = documents ; notifications « nouveau message » (sans contenu).
- Le patient ne peut initier un fil que s'il a un RDV passé ou à venir dans ce cabinet (anti-spam).
- Modèles de réponses rapides pour le secrétariat.
- Adressage entre soignants (V2+) : demande d'avis avec pièce jointe, visible uniquement entre praticiens vérifiés.

## API
`POST /pro/orgs/{orgId}/patients/{id}/documents`, `POST .../appointments/{id}/documents`, `GET /me/documents`, `POST /me/documents`, `GET /me/documents/{id}/download`, V2 : `/me/threads`, `/pro/orgs/{orgId}/threads`.

## Critères d'acceptation
- [ ] Un document envoyé par le cabinet apparaît chez le patient en < 5 s avec notification journalisée ; le cabinet voit « Consulté le … » après ouverture.
- [ ] Un fichier `.exe` renommé `.pdf` est rejeté.
- [ ] Un autre cabinet ne peut pas télécharger le document (403, test IDOR).
- [ ] Les URL signées expirent (test après 6 min → 403).

## Tickets
DOC-01 stockage S3 + upload sécurisé + antivirus · DOC-02 envoi cabinet → patient + notification · DOC-03 « Mes documents » patient + upload · DOC-04 documents demandés par motif · DOC-05 tests · MSG-01..04 (V2) messagerie.
