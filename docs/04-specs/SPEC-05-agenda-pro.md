# SPEC-05 — Agenda Twabibu Pro

## Objectif
L'outil quotidien du cabinet : voir, créer, déplacer, annuler les rendez-vous ; paramétrer motifs, plages en ligne, absences et règles. C'est le module qui décide si les soignants adoptent Twabibu.

## Acteurs
Praticien, secrétaire, administrateur de structure. Notifications (SPEC-08), moteur (SPEC-12), patientèle (SPEC-06).

## Écrans

### Agenda (`/pro/app/agenda`)
- **En-tête** : sélecteur d'agendas (multi-sélection, couleur par agenda), boutons Jour / Semaine / Mois, « Aujourd'hui », ‹ ›, sélecteur de date (mini-calendrier), recherche patient (PatientSearch), bouton bleu « + Rendez-vous ».
- **Grille** : colonne horaire (pas `slotStepMinutes`, 07:00 → 20:00 par défaut, extensible), colonnes = jours (vue semaine) ou agendas (vue jour multi-praticiens). Fond : plages réservables en ligne en bleu très pâle hachuré, absences en gris, hors horaires en gris clair. Événements : bloc coloré par motif, texte « 09:20 Amina Saïd — Consultation adulte », icône source (🌐 en ligne / 📞 cabinet), icône statut (coche arrivée, etc.), badge « Nouveau patient ».
- **Interactions** : clic sur un créneau vide → tiroir de création pré-rempli (agenda, heure) ; clic sur un RDV → tiroir détail ; glisser-déposer pour déplacer (confirmation + SMS automatique) ; redimensionner pour changer la durée ; clic droit / menu : statut rapide (Arrivé, En consultation, Terminé, Non honoré), Annuler, Imprimer.
- **Vue mois** : compteur de RDV par jour, remplissage en %, clic → vue jour.
- **Mobile** : vue jour, liste chronologique avec cartes, glissement gauche/droite pour changer de jour, bouton flottant « + ».

### Tiroir « Rendez-vous » (création / édition)
Champs : agenda, patient (recherche instantanée nom/téléphone ; « + Nouveau patient » : prénom, nom, téléphone, naissance), motif (durée auto, modifiable), date/heure (créneau libre ; si chevauchement → avertissement « Forcer » réservé au praticien/admin), source (cabinet/téléphone/sur place), notes internes, demander confirmation par SMS (oui/non), statut. Historique des événements en bas (créé par, déplacé, SMS envoyés).

### Paramètres
- **Motifs** (`/parametres/motifs`) : tableau triable ; formulaire : nom, durée, couleur (8 pastels), visible en ligne, nouveaux patients autorisés, tarif KMF, consignes patient, questions préalables (type oui/non, choix, texte court ; réponse bloquante optionnelle), délai minimum (surcharge), délai d'annulation (h), actif. Modèles de motifs par spécialité à l'onboarding.
- **Disponibilités en ligne** (`/parametres/disponibilites`) : par agenda, grille hebdomadaire éditable (cliquer-glisser pour créer une plage 08:00–12:00), chaque plage : motifs autorisés (tous par défaut), capacité, lieu ; périodes de validité (ex. horaires de ramadan) ; règles globales : horizon (jours), délai minimum, max RDV actifs par patient, validation manuelle, pas de créneau (5/10/15/20/30 min), réservation en ligne activée.
- **Absences** (`/parametres/absences`) : ponctuelles ou récurrentes (RRULE : « tous les vendredis après-midi »), journée entière ou plage, motif libre ; à la création, aperçu des RDV impactés avec trois actions : « Annuler et prévenir les patients », « Proposer le prochain créneau disponible » (déplacement automatique + SMS « nouveau créneau proposé, répondez OUI »), « Garder les rendez-vous » (absence partielle).
- **Horaires d'ouverture** (affichage public, SPEC-02) distincts des plages en ligne.

## Règles métier
1. Un agenda appartient à un praticien et à un lieu ; un praticien peut avoir plusieurs agendas ; une secrétaire voit les agendas que son rôle autorise.
2. Le cabinet peut toujours créer un RDV hors plages en ligne (dans les horaires d'ouverture ou non) ; seul le patient est contraint par les plages.
3. Chevauchement : interdit par défaut (contrainte base) ; « Forcer » crée un RDV avec `capacity` dépassée, signalé en rouge (praticien/admin seulement).
4. Statuts et transitions : `PENDING_VALIDATION → CONFIRMED | CANCELLED_BY_PRACTICE` ; `CONFIRMED → ARRIVED → IN_CONSULTATION → DONE` ; `CONFIRMED → NO_SHOW` (après l'heure) ; `CONFIRMED → CANCELLED_*`. Un `NO_SHOW` incrémente `PatientRecord.noShowCount` ; à 3, suggestion de blocage.
5. Déplacement par le cabinet → SMS au patient ; annulation par le cabinet → SMS avec lien « reprendre rendez-vous ».
6. Validation manuelle : si `requiresValidation`, les RDV en ligne arrivent `PENDING_VALIDATION`, le cabinet a 24 h (rappel), le patient reçoit « demande envoyée » puis « confirmé » / « refusé ».
   > **Réalisé le 23/11/2026** : le rappel part par e-mail (modèle `appointment.validation-reminder`) au praticien de l’agenda et au titulaire et aux administrateurs, jamais à la secrétaire ni au patient ; une seule fois par demande, entre 07:00 et 21:00, avec un lien direct vers la demande et sans aucune donnée patient ; plus rien après l’heure du rendez-vous. Même tâche planifiée que les rappels patients (`reminder-scheduler`, toutes les 15 min), règle dans `reminder-rules.ts`.
7. Les plages en ligne ne peuvent pas être réduites de façon à orpheliner des RDV existants sans affichage des RDV impactés.
8. Fuseau `Indian/Comoro` partout dans l'UI ; stockage UTC.
9. Journal : toute action sur un RDV crée un `AppointmentEvent` (acteur, avant/après).

## API
`GET /pro/orgs/{orgId}/agenda/events`, CRUD agendas/motifs/availability-rules/absences, `GET absences/preview`, `POST/PATCH appointments`, `POST appointments/{id}/cancel|validate` (voir `api.md`).

## Cas limites
- Deux secrétaires modifient le même RDV : verrouillage optimiste (`updatedAt`), message « modifié par X, recharger ».
- Changement de pas (15 → 10 min) : les RDV existants restent, les créneaux futurs suivent le nouveau pas.
- Jours fériés : affichés, pas de plage en ligne par défaut (configurable).
- Remplaçant (V1) : `Membership` temporaire avec dates.

## Critères d'acceptation
- [ ] Vue semaine avec 3 agendas et 150 RDV se rend en < 1 s (données locales) et reste fluide au scroll.
- [ ] Créer un RDV par le cabinet envoie le SMS de confirmation (fake) avec les bonnes informations.
- [ ] Créer une absence qui couvre 4 RDV affiche les 4 RDV et « Annuler et prévenir » envoie 4 SMS et libère les créneaux (visible en ligne immédiatement).
- [ ] Un RDV déplacé par glisser-déposer met à jour l'`AppointmentEvent` et notifie le patient.
- [ ] Les règles d'autorisation : une secrétaire sans droit « paramétrer » ne voit pas le menu Paramètres (UI) et reçoit 403 (API).
- [ ] Tests unitaires des transitions de statut.

## Tickets
AGENDA-01 modèle + CRUD agendas/motifs · AGENDA-02 règles de disponibilité (éditeur hebdo + API) · AGENDA-03 absences + aperçu impact + actions · AGENDA-04 endpoint events + grille CalendarGrid (jour/semaine/mois) · AGENDA-05 tiroir RDV (création/édition/statuts) · AGENDA-06 glisser-déposer + redimensionner · AGENDA-07 validation manuelle · AGENDA-08 vue mobile Pro · AGENDA-09 impression/export · AGENDA-10 tests.
