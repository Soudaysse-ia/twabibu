# Matrice fonctionnelle Twabibu

Légende priorité : **MVP** = indispensable au lancement (phase 1), **V1** = avant ouverture large (phases 2–3), **V2** = après les apps mobiles, **—** = exclu.

Chaque ligne renvoie à une spec dans `docs/04-specs/`.

## A. Patient — recherche et annuaire (SPEC-01)

| # | Fonctionnalité | Doctolib | Twabibu | Priorité |
|---|---|---|---|---|
| A1 | Recherche par nom, spécialité, motif, établissement (autocomplétion) | ✔ | ✔ | MVP |
| A2 | Recherche par ville / localité / île, « Autour de moi » (géolocalisation) | ✔ | ✔ (3 îles, localités comoriennes) | MVP |
| A3 | Liste de résultats avec grille de créneaux (5 jours) | ✔ | ✔ | MVP |
| A4 | Filtres : disponibilités (aujourd'hui / 3 / 7 / 14 j), langues parlées, nouveaux patients acceptés, moyens de paiement, assurance acceptée | ✔ (secteur, vidéo) | ✔ adaptés | MVP (dispo, langue), V1 (reste) |
| A5 | Carte des résultats (OpenStreetMap / Leaflet) | ✔ (Google) | ✔ | V1 |
| A6 | Pages SEO spécialité × ville, index alphabétique des soignants | ✔ | ✔ | V1 |
| A7 | Résultats « établissement » (centre, clinique) avec nombre de praticiens | ✔ | ✔ | V1 |
| A8 | Tri (pertinence, prochaine disponibilité, distance) | partiel | ✔ | V1 |

## B. Patient — profil du soignant (SPEC-02)

| # | Fonctionnalité | Priorité |
|---|---|---|
| B1 | Bandeau identité (photo, nom, spécialité), bouton « Prendre rendez-vous », carte « En résumé » | MVP |
| B2 | Adresses (multi-lieux), itinéraire, accessibilité | MVP |
| B3 | Présentation, photos du cabinet, expertises et actes (tags) | MVP |
| B4 | Tarifs (motif → prix en KMF), moyens de paiement, assurances/mutuelles acceptées | MVP |
| B5 | Horaires d'ouverture | MVP |
| B6 | Langues parlées (français, shikomori, arabe, anglais, swahili, malgache…) | MVP |
| B7 | Formations, expérience, informations légales (n° d'autorisation d'exercer) | V1 |
| B8 | FAQ générée automatiquement | V1 |
| B9 | Signaler un problème sur un profil | V1 |
| B10 | Badge « Profil vérifié Twabibu » | MVP |

## C. Patient — tunnel de réservation (SPEC-03)

| # | Fonctionnalité | Priorité |
|---|---|---|
| C1 | Choix du lieu (si plusieurs) | MVP |
| C2 | Choix du motif (liste, consignes, questions préalables, « déjà consulté ? ») | MVP |
| C3 | Choix du créneau (accordéon par jour, « voir plus de dates ») | MVP |
| C4 | Verrouillage temporaire du créneau (10 min) | MVP |
| C5 | Identification : inscription par téléphone + code SMS, ou connexion | MVP |
| C6 | Pour qui : moi / un proche (créer un proche) | MVP |
| C7 | Consignes du praticien + acceptation | MVP |
| C8 | Confirmation : récapitulatif, ajout au calendrier (.ics), SMS de confirmation | MVP |
| C9 | Liste d'attente (être prévenu si un créneau plus tôt se libère) | V1 |
| C10 | Réservation sans compte (invité, vérification SMS uniquement) | V2 (à décider) |

## D. Patient — compte (SPEC-04)

| # | Fonctionnalité | Priorité |
|---|---|---|
| D1 | Mes rendez-vous (à venir / passés), détail, annuler, déplacer, reprendre RDV | MVP |
| D2 | Mes proches (ajout, édition, RDV pour un proche) | MVP |
| D3 | Mon identité, mes coordonnées, mot de passe, sessions | MVP |
| D4 | Mes soignants (déjà consultés) | V1 |
| D5 | Mes documents (reçus des soignants, ajoutés par moi) | V1 |
| D6 | Préférences de notification (SMS / WhatsApp / e-mail / push) | V1 |
| D7 | Données et confidentialité : export, suppression de compte | V1 |
| D8 | Messagerie avec le cabinet | V2 |

## E. Notifications (SPEC-08)

| # | Fonctionnalité | Priorité |
|---|---|---|
| E1 | SMS : code de vérification, confirmation, rappel 24 h, annulation / déplacement | MVP |
| E2 | E-mail (si renseigné) : mêmes événements + .ics | MVP |
| E3 | Rappel J-2 et J-1 paramétrables par le cabinet, demande de confirmation (répondre OUI) | V1 |
| E4 | WhatsApp Business (modèles approuvés) | V2 |
| E5 | Push mobile (Expo) | Phase mobile |
| E6 | Notifications cabinet : nouveau RDV en ligne, annulation patient, liste d'attente | MVP |

## F. Pro — agenda (SPEC-05, SPEC-12)

| # | Fonctionnalité | Priorité |
|---|---|---|
| F1 | Vues jour / semaine / mois, navigation, aujourd'hui, mini-calendrier | MVP |
| F2 | Multi-agendas (par lieu / par praticien), colonnes côte à côte | MVP |
| F3 | Motifs : libellé, durée, couleur, visible en ligne, nouveaux patients, consignes, délai min, délai d'annulation, tarif | MVP |
| F4 | Plages réservables en ligne récurrentes (par jour de semaine, par lieu, motifs autorisés) | MVP |
| F5 | Horaires d'ouverture affichés sur le profil | MVP |
| F6 | Absences / congés / blocages, avec RDV impactés et notifications | MVP |
| F7 | Création / modification / annulation de RDV par le cabinet, recherche patient, création rapide | MVP |
| F8 | Statut du RDV (confirmé, arrivé, en consultation, terminé, non honoré, annulé) | MVP |
| F9 | Règles : horizon de réservation, max RDV par patient, validation manuelle | V1 |
| F10 | Liste d'attente côté cabinet | V1 |
| F11 | RDV en série / récurrents | V1 |
| F12 | Remplaçant (accès temporaire) | V1 |
| F13 | Impression de la journée, export CSV | V1 |
| F14 | Glisser-déposer pour déplacer un RDV | V1 |
| F15 | Ressources partagées (salles, équipements) | V2 |

## G. Pro — patientèle (SPEC-06)

| # | Fonctionnalité | Priorité |
|---|---|---|
| G1 | Fiche patient (identité, contacts, adresse, notes administratives), recherche instantanée | MVP |
| G2 | Historique des RDV (honorés / non honorés / annulés) | MVP |
| G3 | Création automatique à la première réservation, rapprochement avec le compte patient | MVP |
| G4 | Notes de consultation (texte libre, privées au praticien) | V1 |
| G5 | Documents (envoyer au patient, recevoir du patient, classement) | V1 |
| G6 | Étiquettes, fusion de doublons, blocage (patient absent à répétition) | V1 |
| G7 | Import CSV d'une patientèle existante | V1 |

## H. Pro — cabinet, rôles, secrétariat (SPEC-07)

| # | Fonctionnalité | Priorité |
|---|---|---|
| H1 | Inscription soignant, dossier de vérification, activation par Twabibu | MVP |
| H2 | Paramètres du cabinet : lieux, horaires, profil public, photos | MVP |
| H3 | Utilisateurs : praticien, secrétaire, administrateur ; invitations | MVP |
| H4 | Droits fins (agenda, patientèle, paramètres, documents) | V1 |
| H5 | Journal d'activité | V1 |
| H6 | Abonnement et facturation Twabibu (vue, factures) | V1 |

## I. Documents et communication (SPEC-09)

| # | Fonctionnalité | Priorité |
|---|---|---|
| I1 | Envoi de documents PDF au patient depuis le RDV / la fiche (ordonnance, certificat, compte rendu) | V1 |
| I2 | Demande de documents au patient avant le RDV | V1 |
| I3 | Modèles de documents (en-tête du cabinet) | V2 |
| I4 | Messagerie patient ↔ cabinet | V2 |
| I5 | Adressage entre soignants | V2 |

## J. Établissements (SPEC-10)

| # | Fonctionnalité | Priorité |
|---|---|---|
| J1 | Structure regroupant plusieurs praticiens et plusieurs sites, page établissement publique | V1 |
| J2 | Gestion centralisée des accès, agendas partagés | V1 |
| J3 | Tableau de bord d'activité (RDV, taux en ligne, non-honorés, délais) | V1 |
| J4 | Ressources (salles, équipements) | V2 |

## K. Back-office Twabibu (SPEC-11)

| # | Fonctionnalité | Priorité |
|---|---|---|
| K1 | File de vérification des soignants (pièces, validation, refus motivé) | MVP |
| K2 | Référentiels : spécialités, actes, localités, langues, assurances | MVP |
| K3 | Support : rechercher un patient/soignant, renvoyer un SMS, journaux | MVP |
| K4 | Modération des profils, signalements | V1 |
| K5 | Abonnements, plans, factures | V1 |
| K6 | Statistiques plateforme | V1 |

## M. Pro — dossier médical (SPEC-13)

| # | Fonctionnalité | Priorité |
|---|---|---|
| M1 | Synthèse du dossier à l'ouverture du RDV (allergies, traitements, antécédents, constantes, alertes) | MVP |
| M2 | Antécédents, allergies, vaccinations, traitements en cours (structurés) | MVP |
| M3 | Consultation structurée (modèles par spécialité), clôture du RDV | MVP |
| M4 | Constantes et courbes (croissance OMS, poids, tension, glycémie) | V1 |
| M5 | Résultats de laboratoire et documents rattachés | V1 |
| M6 | Suivi des chroniques (contrôles attendus, alertes) | V1 |
| M7 | Carnet du patient (web/app), partage avec consentement, historique des accès | V1 |
| M8 | Export PDF/JSON du dossier | V1 |

## N. Pro — ordonnance numérique (SPEC-14)

| # | Fonctionnalité | Priorité |
|---|---|---|
| N1 | Référentiel médicaments (LNME + DCI), recherche instantanée | MVP |
| N2 | Éditeur d'ordonnance : posologie guidée, modèles, renouvellement, favoris | MVP |
| N3 | Alertes par règles (allergie bloquante, doublon, posologie, contre-indication déclarative) | MVP |
| N4 | Signature, PDF officiel avec QR, page de vérification publique | MVP |
| N5 | Envoi à une pharmacie, suivi de dispensation, mise à jour des traitements | V1 |
| N6 | Ordonnances de laboratoire, imagerie, soins | V1 |

## O. Pharmacies — Twabibu Pharma (SPEC-15)

| # | Fonctionnalité | Priorité |
|---|---|---|
| O1 | Annuaire des pharmacies, profil, carte, vérification | MVP |
| O2 | **Pharmacies de garde** par île (page publique, bloc accueil, onglet app) | MVP |
| O3 | Catalogue produits et prix (édition, import), page médicament, comparateur | V1 |
| O4 | Réception des ordonnances numériques, réponse, dispensation | V1 |
| O5 | Commandes : retrait, livraison, statuts, notifications | V1 |
| O6 | Espaces sponsorisés « Pharmacie partenaire » | V1 |
| O7 | Statistiques pharmacie, livreurs partenaires, paiement mobile money | V2 |

## L. Transverse

| # | Fonctionnalité | Priorité |
|---|---|---|
| L1 | Responsive complet (320 px → 1440 px), PWA installable | MVP |
| L2 | i18n (fr) avec architecture prête pour shikomori / arabe (RTL) | MVP (fr) / V2 |
| L3 | Accessibilité WCAG 2.1 AA (contrastes, clavier, lecteurs d'écran) | MVP |
| L4 | SEO (SSR, métadonnées, sitemap, données structurées Physician / MedicalClinic) | V1 |
| L5 | Pages institutionnelles : à propos, centre d'aide, CGU, confidentialité, contact, « Vous êtes soignant ? » | MVP |
| L6 | Sécurité : chiffrement, journaux d'audit, limitation de débit, 2FA pro | MVP |
| L7 | Téléconsultation / vidéo | — (exclu) |
| L8 | Paiement en ligne (MVola / Huri Money) pour commandes, acomptes ou abonnements | V2 |
| L9 | Logo officiel et couleurs du logo (`#1956B4`) sur tous les supports | MVP |
