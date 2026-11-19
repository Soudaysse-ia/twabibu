# Inventaire des pages et écrans (web)

Routes de l'app Next.js (`apps/web`). Chaque page indique : URL, accès, contenu, composants, états, mobile. Les wireframes sont textuels ; les captures Doctolib équivalentes sont dans `assets/references/`.

## A. Public (patients, SEO)

| Route | Page | Contenu principal | Réf. |
|---|---|---|---|
| `/` | Accueil | Hero + SearchBar, bénéfices, chiffres, confiance, apps, bloc soignants, aide, footer SEO | doctolib-01..03 |
| `/recherche?q=&ou=&lat=&lng=` | Résultats (requête libre) | chips filtres, compteur, PractitionerCard × n, ResultsMap, pagination | doctolib-04, 05, 10 |
| `/{specialite}` | Spécialité (toutes îles) | SEO + liste | |
| `/{specialite}/{ville}` | Spécialité × ville | SEO + liste + carte | doctolib-04 |
| `/{specialite}/{ville}/{slug}` | Profil soignant | PractitionerHero, sections, SummaryCard | doctolib-06 |
| `/etablissement/{slug}` | Page établissement | identité, praticiens, lieux, horaires | |
| `/soignants/{lettre}` | Index alphabétique | SEO | |
| `/specialites` | Toutes les spécialités | | |
| `/villes` | Toutes les localités (par île) | | |
| `/aide` + `/aide/{article}` | Centre d'aide | FAQ patients et soignants | |
| `/a-propos`, `/contact`, `/cgu`, `/confidentialite`, `/mentions-legales`, `/cookies` | Institutionnel | | |
| `/pro` | « Vous êtes soignant ? » (marketing Pro) | bénéfices, offres, demande de démo, inscription | doctolib-12 |
| `/pharmacies-de-garde` | **Pharmacies de garde** (par île, aujourd'hui / semaine, ouverte maintenant, carte) | page publique très fréquentée, bloc sur l'accueil | |
| `/pharmacies/{ile}/{localite}`, `/pharmacie/{slug}` | Annuaire et profil pharmacie | services, horaires, gardes, catalogue, « Commander » | |
| `/medicament/{slug}` | Page médicament et comparateur de disponibilité/prix | bannière « Partenaire » possible | |
| `/commander/...` | Tunnel de commande pharmacie (panier → ordonnance → retrait/livraison → coordonnées → confirmation) | | |
| `/o/{code}` | Vérification publique d'une ordonnance (QR) | | |
| `/pharma` | « Vous êtes pharmacien ? » (marketing Pharma) | | |
| `/pro/tarifs` | Offres | | |

## B. Tunnel de réservation (`/{specialite}/{ville}/{slug}/reserver/...`)

| Étape | Route | Écran |
|---|---|---|
| 1 | `.../reserver/lieu` | Choix du lieu (sauté si un seul) |
| 2 | `.../reserver/motif` | MotiveList (+ question « déjà consulté ? » si configurée) |
| 3 | `.../reserver/creneau` | DayAccordionSlots, « Voir plus de dates » |
| 4 | `.../reserver/identification` | S'inscrire (bleu) / Se connecter (jaune) → `/connexion` et `/inscription` avec retour automatique |
| 5 | `.../reserver/pour-qui` | Moi / proche existant / nouveau proche |
| 6 | `.../reserver/consignes` | Consignes du cabinet + case d'acceptation + documents à apporter |
| 7 | `.../reserver/confirmation` | Récapitulatif, .ics, « Vous recevrez un SMS », actions |
| — | état « créneau expiré » | si le verrou de 10 min a expiré : retour à l'étape 3 avec message |

Le `BookingSummary` (droite / replié en haut sur mobile) se remplit : lieu ✔, motif ✔, créneau ✔, pour qui ✔.

## C. Authentification

| Route | Écran |
|---|---|
| `/connexion` | Téléphone (ou e-mail) + mot de passe ; « Code par SMS » en alternative ; lien mot de passe oublié |
| `/inscription` | Civilité, prénom, nom, date de naissance, téléphone (+269), e-mail (optionnel), mot de passe, consentements → vérification du code SMS |
| `/verification` | OtpField, renvoyer le code (60 s) |
| `/mot-de-passe-oublie`, `/reinitialisation` | |
| `/pro/connexion`, `/pro/inscription` | Compte soignant : e-mail obligatoire, téléphone, mot de passe fort, 2FA optionnelle |

## D. Compte patient (`/mon-compte/...`, connecté)

| Route | Écran |
|---|---|
| `/mon-compte/rendez-vous` | Onglets À venir / Passés, AppointmentCard, actions annuler / déplacer / reprendre |
| `/mon-compte/rendez-vous/{id}` | Détail : soignant, lieu + carte, motif, consignes, documents à apporter, boutons |
| `/mon-compte/rendez-vous/{id}/deplacer` | Réutilise l'étape créneau |
| `/mon-compte/proches` | Liste, ajout, édition, suppression |
| `/mon-compte/soignants` | Soignants déjà consultés |
| `/mon-compte/documents` | Reçus / ajoutés, aperçu, téléchargement |
| `/mon-compte/profil` | Identité, coordonnées, adresse |
| `/mon-compte/securite` | Mot de passe, sessions actives, suppression du compte |
| `/mon-compte/notifications` | Canaux et préférences |
| `/mon-compte/carnet` | Carnet de santé : synthèse, traitements, vaccins, résultats, partage du dossier, historique des accès |
| `/mon-compte/ordonnances` | Ordonnances (PDF, envoyer à une pharmacie, statut de dispensation) |
| `/mon-compte/commandes` | Commandes pharmacie et suivi |

## E. Twabibu Pro (`/pro/app/...`, rôles cabinet)

| Route | Écran | Rôles |
|---|---|---|
| `/pro/app` | Tableau de bord : RDV du jour, nouveaux RDV en ligne, alertes (RDV à valider, absences), statut de vérification | tous |
| `/pro/app/agenda` | CalendarGrid jour / semaine / mois, sélecteur d'agendas, mini-calendrier, bouton « + Rendez-vous », AppointmentDrawer | praticien, secrétaire |
| `/pro/app/agenda/rdv/{id}` | Détail RDV (patient, motif, statut, notes, documents, historique) | |
| `/pro/app/patients` | PatientSearch + liste, import CSV | |
| `/pro/app/patients/{id}` | PatientCard, PatientTimeline, notes (praticien seulement), documents | |
| `/pro/app/documents` | Documents envoyés / reçus | |
| `/pro/app/liste-attente` | Demandes de créneau plus tôt | V1 |
| `/pro/app/statistiques` | StatCard, courbes | V1 |
| `/pro/app/parametres/profil` | Profil public : présentation, photos, expertises, langues, formations | praticien |
| `/pro/app/parametres/lieux` | Lieux de consultation, adresses, accessibilité, horaires d'ouverture | |
| `/pro/app/parametres/motifs` | Motifs : durée, couleur, en ligne, nouveaux patients, consignes, délais, tarif | |
| `/pro/app/parametres/disponibilites` | AvailabilityRuleEditor (plages récurrentes), règles de réservation | |
| `/pro/app/parametres/absences` | AbsenceEditor | |
| `/pro/app/parametres/notifications` | Rappels (J-1, J-2), demande de confirmation, canaux | |
| `/pro/app/parametres/equipe` | Utilisateurs, rôles, invitations, journal d'activité | admin |
| `/pro/app/parametres/abonnement` | Offre, factures | admin |
| `/pro/app/verification` | Dossier de vérification (pièces, statut) | praticien |
| `/pro/app/onboarding` | Assistant de configuration en 6 étapes | |
| `/pro/app/patients/{id}/dossier` | Dossier médical : synthèse, consultations, antécédents, traitements, constantes, résultats, ordonnances, suivi | praticien |
| `/pro/app/agenda/rdv/{id}/consultation` | Vue consultation (dossier à gauche, note au centre, actions à droite) | praticien |
| `/pro/app/ordonnances`, `/pro/app/ordonnances/nouvelle` | Ordonnances, éditeur, modèles | praticien |
| `/pro/app/parametres/modeles` | Modèles de consultation et d'ordonnance | praticien |

## E bis. Twabibu Pharma (`/pharma/app/...`, rôles pharmacie)

| Route | Écran |
|---|---|
| `/pharma/app` | Tableau de bord : ordonnances reçues, commandes du jour, gardes à venir |
| `/pharma/app/ordonnances` | File des ordonnances (numériques + photos), réponse, dispensation |
| `/pharma/app/commandes` | Kanban des statuts, détail, livreur |
| `/pharma/app/catalogue` | Tableau éditable, import CSV, produits signalés |
| `/pharma/app/parametres/profil`, `/horaires`, `/livraison`, `/equipe`, `/gardes`, `/abonnement` | |
| `/pharma/app/statistiques` | Vues, ordonnances reçues, commandes, panier moyen |

## F. Back-office Twabibu (`/admin/...`, rôle plateforme)

| Route | Écran |
|---|---|
| `/admin` | KPI plateforme |
| `/admin/verifications` | VerificationQueue, détail dossier, valider / compléter / refuser |
| `/admin/soignants`, `/admin/etablissements`, `/admin/patients` | Recherche, fiche, actions support |
| `/admin/referentiels` | Spécialités, actes, localités, langues, assurances |
| `/admin/signalements` | Modération |
| `/admin/abonnements` | Plans, paiements manuels, factures |
| `/admin/notifications` | Journal des SMS/e-mails, renvoi |
| `/admin/gardes` | Calendrier des pharmacies de garde par île, import |
| `/admin/medicaments` | Référentiel médicaments, validation des enrichissements |
| `/admin/espaces-sponsorises` | Inventaire et attribution des emplacements |
| `/admin/journal` | Audit |

## G. Comportements mobiles communs
- En-tête 56 px, retour à gauche, logo centré.
- Boutons d'action principaux collants en bas (`position: sticky; bottom: 0`), 48 px.
- Modales → tiroirs plein écran (`Drawer`).
- Listes en pleine largeur, cartes sans marge latérale supplémentaire au-delà de 16 px.
- Carte géographique en plein écran sur demande.
- Agenda Pro : vue jour par défaut, glissement horizontal pour changer de jour.
