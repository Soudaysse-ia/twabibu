# SPEC-03 — Tunnel de réservation

## Objectif
Réserver un rendez-vous en moins de 2 minutes, sans ambiguïté, avec un récapitulatif permanent. Références : `assets/references/doctolib-07-tunnel-mode.jpg` (étape supprimée chez nous), `doctolib-08-tunnel-motif.jpg`, `doctolib-09-tunnel-creneaux.jpg`, `doctolib-11-identification-mobile.jpg`.

## Acteurs
Patient (connecté ou non), proche, moteur de disponibilités (SPEC-12), notifications (SPEC-08).

## Étapes et règles
Titre de page : « Prenez votre rendez-vous en ligne » / sous-titre « Renseignez les informations suivantes ». Carte d'étape à gauche avec « ← Étape précédente », récapitulatif à droite (« Votre rendez-vous en détail ») qui s'enrichit d'une coche à chaque étape ; sur mobile, récapitulatif replié en haut.

1. **Lieu** (si le praticien a > 1 lieu réservable) : liste de cartes lieu (nom, adresse). Sauté sinon.
2. **Motif** : liste verticale des motifs `isOnline` de l'agenda du lieu, dans l'ordre `sortOrder`, avec durée et tarif en sous-texte si renseignés. Si le motif a des `questions` (ex. « Avez-vous déjà consulté ce soignant ? » Oui/Non, ou un choix multiple), elles s'affichent à la suite dans la même carte. Si `newPatientsAllowed = false` et que le patient (connecté) n'a pas de `PatientRecord` chez ce cabinet → message bloquant « Ce motif est réservé aux patients déjà suivis » (vérifié de nouveau après identification).
3. **Créneau** : accordéon par jour (« Jeudi 13 novembre 2026 »), premier jour ouvert, chips d'heures (6 visibles puis « Voir plus »), « Voir plus de dates » charge 7 jours supplémentaires (jusqu'à l'horizon). Les créneaux sont recalculés à l'ouverture (jamais mis en cache plus de 30 s). Au clic : `POST /booking/locks` → verrou 10 min ; si refus (`SLOT_UNAVAILABLE`) → toast « Ce créneau vient d'être pris » et rafraîchissement.
4. **Identification** (si non connecté) : carte « Nouveau sur Twabibu ? » → bouton bleu **S'inscrire** ; « J'ai déjà un compte » → bouton jaune **Se connecter**. Les deux flux (SPEC-04) reviennent automatiquement au tunnel avec le verrou intact (`returnTo`). Compte à rebours discret du verrou (« Créneau réservé pour vous pendant 9:32 »).
5. **Pour qui ?** : « Moi » (identité du compte) ou un proche existant, ou « Ajouter un proche » (prénom, nom, date de naissance, lien, téléphone optionnel). Le motif peut imposer une tranche d'âge (ex. « Enfant ») → avertissement si incohérent.
6. **Consignes** : texte du motif/agenda (ex. « Apportez votre carnet de santé », « Arrivez 10 min avant », politique d'annulation : « Annulation possible jusqu'à 24 h avant »), case « J'ai lu et j'accepte les consignes », champ optionnel « Message pour le cabinet » (200 caractères, non médical).
7. **Confirmation** : `POST /booking/appointments` avec le `lockId`. Écran vert : « Votre rendez-vous est confirmé » (ou « Votre demande est envoyée, le cabinet la confirmera » si `requiresValidation`), récapitulatif complet, boutons « Ajouter à mon calendrier » (.ics), « Voir mes rendez-vous », « Prendre un autre rendez-vous », rappel « Vous recevrez un SMS de confirmation et un rappel la veille ». SMS envoyé immédiatement (SPEC-08).

## Règles transverses
- **Max RDV actifs** : `Agenda.maxActiveAppointmentsPerPatient` (défaut 2) pour la même personne (patient ou proche) chez le même praticien → erreur `TOO_MANY_ACTIVE_APPOINTMENTS` avec lien vers « Mes rendez-vous ».
- **Patient bloqué** par le cabinet (`PatientRecord.isBlocked`) → `BOOKING_BLOCKED` : « Veuillez contacter le cabinet par téléphone ».
- **Délai minimum** (`minNoticeMinutes`) et **horizon** appliqués par le moteur.
- **Doublon** : un même patient ne peut pas réserver deux créneaux qui se chevauchent chez deux praticiens (avertissement non bloquant).
- Création/mise à jour du `PatientRecord` du cabinet à la confirmation (rapprochement par téléphone + date de naissance).
- Le tunnel conserve son état dans l'URL + `sessionStorage` (rechargement sans perte).
- Analytics (sans données personnelles) : événements `booking_step_viewed`, `booking_completed`, `booking_abandoned` avec l'étape.

## Déplacer un rendez-vous (depuis le compte)
Réutilise l'étape 3 avec le même motif ; à la confirmation, l'ancien RDV passe `CANCELLED_BY_PATIENT` avec `rescheduledToId`, le nouveau référence `rescheduledFromId`, un seul SMS « Rendez-vous déplacé ». Soumis au délai d'annulation du motif.

## Cas limites
- Verrou expiré avant confirmation → retour étape 3 avec bandeau d'information.
- Praticien dépublié entre-temps → message + retour à la recherche.
- Patient arrive avec un créneau pré-sélectionné depuis la liste de résultats → étapes 1–3 pré-remplies, verrou posé immédiatement.
- Réseau lent : chaque étape fonctionne sans JavaScript lourd (formulaires HTML progressifs).

## Critères d'acceptation
- [ ] Scénario complet Playwright : recherche → profil → motif → créneau → inscription OTP (fake) → proche → consignes → confirmation, en < 90 s automatisés, sur desktop et mobile.
- [ ] Deux sessions tentant le même créneau : une seule réussit (test de concurrence).
- [ ] Un RDV n'est jamais créé en dehors d'un créneau calculé par le moteur (test de propriété).
- [ ] SMS de confirmation enregistré en base avec le bon contenu (sans motif détaillé).
- [ ] Accessibilité : chaque étape a un `h1`, le focus est placé sur le titre à chaque changement d'étape, erreurs annoncées.

## Tickets
BOOK-01 état du tunnel + layout + récapitulatif · BOOK-02 étapes lieu/motif/questions · BOOK-03 étape créneau + verrou · BOOK-04 identification + retour automatique · BOOK-05 pour qui + proches · BOOK-06 consignes + confirmation + .ics · BOOK-07 endpoint `POST /booking/appointments` (règles, PatientRecord, événements) · BOOK-08 déplacement · BOOK-09 tests concurrence + e2e.
