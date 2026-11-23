# SPEC-14 — Ordonnance numérique

## Objectif
Permettre au médecin de prescrire plus vite qu'à la main, sans erreur d'allergie, et de transmettre l'ordonnance à la pharmacie choisie par le patient, tout en restant valable sur papier.

## Acteurs
Praticien prescripteur (médecin, dentiste, sage-femme selon leurs droits), patient, pharmacie (SPEC-15), back-office (référentiel médicaments).

## Référentiel médicaments (`Drug`)
- Source : liste nationale des médicaments essentiels des Comores + référentiel DCI/ATC international ; champs : DCI, nom(s) commercial(aux) locaux, forme (comprimé, sirop…), dosage, unité, voie, classe ATC, sur ordonnance (oui/non), stupéfiant/contrôlé, posologies usuelles (adulte/enfant par kg), contre-indications déclaratives majeures (grossesse, allaitement, insuffisance rénale) — champs simples, pas de base d'interactions complète en V1.
- Enrichi par les pharmacies (noms commerciaux et prix) et validé par le back-office.

## Rédaction (Twabibu Pro)
1. Depuis la consultation ou la fiche patient : « Nouvelle ordonnance ».
2. Recherche instantanée (DCI ou nom commercial), sélection → ligne de prescription : dosage, forme, **posologie** (champ guidé : « 1 comprimé matin et soir pendant 7 jours » construit par des sélecteurs + texte libre), quantité calculée, durée, renouvellement (0–11), mention « non substituable » optionnelle, note au pharmacien.
3. **Alertes par règles** (non bloquantes sauf allergie) : allergie déclarée à la DCI (bloquante, justification obligatoire), doublon de DCI dans la même ordonnance ou avec un traitement en cours, posologie hors fourchette usuelle, contre-indication déclarative (grossesse déclarée, âge pédiatrique), médicament contrôlé (mention légale).
4. Favoris et **modèles d'ordonnance** du praticien (« angine adulte », « paludisme simple ») en un clic ; renouvellement d'une ordonnance précédente en un clic.
5. Ordonnances libres : examens biologiques (prescription de laboratoire), imagerie, soins infirmiers, dispositifs — liste d'actes + texte.
6. Signature : le praticien valide avec son mot de passe ou 2FA (horodatage, hash du contenu).

## Sortie
- **PDF** au format officiel (en-tête du cabinet avec logo Twabibu bleu, identité du prescripteur et numéro d'autorisation, patient, date, lignes, signature image, **QR code** de vérification pointant vers `twabibu.km/o/{code}`), imprimable immédiatement et envoyé dans le carnet du patient.
- **Numérique** : le patient (web/app/SMS avec lien) choisit une pharmacie → la pharmacie reçoit l'ordonnance dans Twabibu Pharma, voit les lignes et peut indiquer disponibilité et prix avant que le patient se déplace.
- Vérification par QR : page publique minimale « Ordonnance valide, délivrée le …, prescripteur Dr … », sans détail médical tant que le pharmacien n'est pas connecté.

## Cycle de vie
`DRAFT → SIGNED → SENT_TO_PHARMACY (optionnel) → PARTIALLY_DISPENSED | DISPENSED → EXPIRED (3 mois par défaut, 1 an si renouvelable) | CANCELLED`. Chaque dispensation (par renouvellement) est enregistrée par la pharmacie (date, pharmacie, lignes délivrées, substitution éventuelle) et visible par le prescripteur et le patient.

> **Réalisé le 22/11/2026 (RX-05, partie dispensation)** : la remise d’une commande faite sur ordonnance enregistre la dispensation (lignes délivrées, quantités, substitution) et fait passer l’ordonnance à `PARTIALLY_DISPENSED` ou `DISPENSED`. « Délivrée le … par … » et les médicaments remis apparaissent dans « Mes ordonnances », sur la fiche patient du praticien et dans le document de l’ordonnance (`apps/api/src/medical/dispensation-view.ts`). Les renouvellements restent à faire. Les traitements actifs du dossier (SPEC-13) sont mis à jour à la signature.

## Règles
1. Seuls les praticiens `VERIFIED` avec droit de prescription (champ `canPrescribe` défini par spécialité, validé au back-office) peuvent signer.
2. Une ordonnance signée est immuable ; correction = annulation + nouvelle ordonnance (lien).
3. Médicaments contrôlés : durée limitée, mention obligatoire, pas d'envoi numérique sans validation juridique (feature flag).
4. Le patient peut envoyer la même ordonnance à plusieurs pharmacies pour comparer disponibilité/prix, mais une seule dispensation par renouvellement (verrou lors de « Je prépare »).
5. Pas de conseil automatique au patient ; les notices restent de la responsabilité du pharmacien.
6. Validité juridique aux Comores : LEGAL-02 ; en attendant, le PDF signé + QR est la version de référence.

## Écrans
Pro : éditeur d'ordonnance (recherche, lignes, alertes, modèles, aperçu PDF), liste des ordonnances du patient, statut de dispensation. Patient : `/mon-compte/ordonnances` (liste, PDF, « Envoyer à une pharmacie », statut). Pharmacie : voir SPEC-15. Public : `/o/{code}` vérification.

## Données
`Drug`, `Prescription` (recordId, practitionerId, appointmentId?, type MED/LAB/IMAGING/CARE, status, signedAt, contentHash, pdfKey, qrCode, expiresAt, renewals), `PrescriptionLine` (drugId | freeText, dosage, posology JSON + text, quantity, duration, substitutable, notes), `PrescriptionTemplate`, `Dispensation` (prescriptionId, pharmacyId, lines JSON, dispensedAt, substitution), `PrescriptionShare` (prescriptionId, pharmacyId, sentAt, status).

## API
`/v1/pro/orgs/{orgId}/prescriptions` (CRUD brouillon, `POST /{id}/sign`, `GET /{id}/pdf`, `POST /{id}/cancel`), `/v1/directory/drugs?q=`, `/v1/me/prescriptions`, `POST /v1/me/prescriptions/{id}/send` ({pharmacyId}), `GET /v1/o/{code}` (public), pharmacie : SPEC-15.

## Critères d'acceptation
- [ ] Une ordonnance de 3 lignes se rédige en < 60 s avec les modèles (test utilisateur).
- [ ] Prescrire une DCI pour laquelle une allergie est enregistrée bloque sans justification (test).
- [ ] Le PDF est conforme au gabarit, le QR mène à une page de vérification qui reflète le statut.
- [ ] Une ordonnance signée ne peut plus être modifiée (test API 409).
- [ ] L'envoi à une pharmacie crée une notification côté pharmacie et le statut est visible par le médecin.

## Tickets
RX-01 référentiel médicaments (import LNME + DCI, API de recherche, admin) · RX-02 éditeur d'ordonnance + posologie guidée + modèles · RX-03 moteur d'alertes par règles · RX-04 signature, hash, PDF avec QR, page de vérification · RX-05 cycle de vie, renouvellements, dispensations · RX-06 côté patient (liste, envoi à une pharmacie) · RX-07 ordonnances labo/imagerie/soins · RX-08 tests.
