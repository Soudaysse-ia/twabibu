# Analyse de Doctolib (état observé le 11 novembre 2026)

Source : navigation sur doctolib.fr et info.doctolib.fr, plus le dossier `Doctolib_Dossier_illustre_V1_sans_IA.docx`. Captures dans `assets/references/`.

## 1. Structure du site patient (doctolib.fr)

### 1.1 En-tête (64 px, bleu #107ACA)
- Logo wordmark blanc à gauche.
- À droite : bouton blanc « Vous êtes soignant ? » (lien vers le site Pro), « Centre d'aide », « Se connecter ».
- Sur les pages de résultats, la barre de recherche est intégrée dans l'en-tête bleu.

### 1.2 Page d'accueil
1. **Hero bleu** avec formes organiques (« blobs ») et photo d'une consultation à droite ; titre H1 « Vivez en meilleure santé » (Montserrat 700, 32 px, blanc sur bleu, navy #00264C ailleurs).
2. **Barre de recherche « pilule »** (hauteur 60 px, rayon 32 px, ombre douce) : champ « Nom, spécialité, établissement,… » + champ « Où ? » avec bouton « Autour de moi » + bouton navy « Rechercher ».
3. Carte promotionnelle flottante (santé mentale).
4. Section « Votre compagnon de santé au quotidien » : 3 bénéfices illustrés (accès aux soins, soins personnalisés, gérer votre santé).
5. Bandeau chiffres clés (100 M de personnes, 580 000 soignants, 18 M de documents/mois).
6. Bloc « Votre santé. Vos données. » (engagements confidentialité).
7. Bloc application mobile (note 4,7 ★, badges App Store / Google Play).
8. Bloc navy « Vous êtes soignant ? » (4 arguments + CTA).
9. Bloc recrutement.
10. Bandeau « Des questions ? » + bouton « Ouvrir le centre d'aide ».
11. **Pied de page** très riche (SEO) : spécialités fréquentes, recherches fréquentes « Spécialité + Ville », index alphabétique des soignants, pays/langue, mentions légales, liens vers les Ordres.

### 1.3 Page de résultats (`/{specialite}/{ville}`)
- En-tête bleu avec la barre de recherche pré-remplie.
- Barre de filtres (chips blanches, rayon 16 px, hauteur 32 px) : **Filtres**, **Disponibilités**, **Secteur**.
- Modale « Filtres » : Disponibilités (aujourd'hui / 3 / 7 / 14 jours), Secteur de conventionnement, Langues parlées (18 langues), Consultation vidéo. Boutons « Effacer ces filtres » / « Afficher les résultats ».
- Texte « 7262 résultats » + phrase SEO.
- **Carte praticien** (fond blanc, rayon 8 px) : photo ronde (badge vidéo), nom en bleu 14 px gras, spécialité, adresse (icône), conventionnement (icône €), puis à droite la **grille de disponibilités** : 5 colonnes de jours (mercredi 11 nov. …), 4 créneaux par colonne (chips bleu très clair #E5F9FF, rayon 8 px, hauteur 40 px), tirets « — » si vide, flèches ‹ › pour changer de semaine, lien « Voir plus de créneaux ».
- Message alternatif : « Ce soignant réserve la prise de rendez-vous en ligne aux patients déjà suivis. » ou « Disponibilités à partir du … ».
- Résultats « établissement » : logo, nom du centre, « 7 médecins généralistes », « Établissement conventionné ».
- Colonne droite : **carte** (chargée après consentement Google Maps, bouton « Afficher la carte »).
- Pagination « Page précédente / Page suivante ». Fil d'Ariane Doctolib / Spécialité / Ville.
- **Mobile** : en-tête bleu avec flèche retour + logo centré, chips de filtres horizontales, « 7262 résultats » + lien « Afficher la carte », cartes empilées, grille de créneaux remplacée par un bouton « Prendre rendez-vous ».

### 1.4 Page profil praticien (`/{specialite}/{ville}/{slug}`)
- **Bandeau navy** (#294056) : photo ronde 72 px, nom H1 blanc 18 px Montserrat, spécialité.
- Bandeau info bleu pâle (ex. « N'accepte pas la carte vitale… »).
- Colonne principale (cartes blanches, titres H2 Montserrat 14 px navy, icône devant) :
  - **Adresses** (+ bouton d'itinéraire), **Accessibilité** (« Rez-de-chaussée sans ascenseur », « Voir toutes les informations d'accès »).
  - **Présentation** (texte libre) + galerie photos (+3).
  - **Expertises et actes** (tags) + « En savoir plus sur le soignant ».
  - **Tarifs et remboursement** (liste motif → prix, secteur, carte Vitale, **Moyens de paiement**), « Voir tous les prix ».
  - **Horaires d'ouverture** (lundi → samedi, plages), « Voir plus ».
  - **Langues parlées**.
  - **Formations** (année, diplôme, établissement), **Expérience**.
  - **Informations légales** (RPPS, ADELI, SIREN).
  - **FAQ** générée (adresse, horaires, paiement, nouveaux patients…).
- Colonne droite collante : carte **« En résumé »** (accepte les nouveaux patients, adresse, vidéo) + bouton **« PRENDRE RENDEZ-VOUS »** (bleu, majuscules, rayon 8 px, hauteur 40 px).
- Lien « Partager un problème avec un profil ».

### 1.5 Tunnel de réservation (`/booking/...`)
Page sur fond bleu pâle, titre « Prenez votre rendez-vous en ligne / Renseignez les informations suivantes », **carte d'étapes à gauche**, **récapitulatif à droite** (photo + nom + « Votre rendez-vous en détail » qui se remplit au fil des étapes, avec des coches).
1. **Mode de consultation** : En vidéo / Au cabinet (si le praticien propose la vidéo). *(Twabibu : étape supprimée.)*
2. *(Si plusieurs lieux)* Choix du lieu de consultation.
3. **Motif de consultation** : liste verticale cliquable (« Adulte - Consultation de médecine générale », « Enfant - … », « Urgence »…). Un motif peut avoir des sous-questions (« Avez-vous déjà consulté ce praticien ? » Oui / Non).
4. **Date de consultation** : accordéon par jour (« Jeudi 12 novembre 2026 ») avec chips d'heures, « Voir plus », « Voir plus de dates ».
5. **Identification** : « Nouveau sur Doctolib ? S'inscrire » (bouton bleu) / « J'ai déjà un compte » (bouton jaune #F5CF66). Inscription : civilité, prénom, nom, date de naissance, téléphone (vérification SMS), e-mail, mot de passe, consentements.
6. **Pour qui ?** : moi / un proche (sélection ou création d'un proche).
7. **Consignes du praticien** (texte libre : documents à apporter, règles) + case à cocher d'acceptation.
8. **Confirmation** : récapitulatif, ajout au calendrier, « Vous recevrez un SMS de rappel », liens annuler/déplacer.
- Le créneau est **verrouillé temporairement** pendant l'identification (≈ 15 min).
- « Étape précédente » disponible à chaque étape.

### 1.6 Compte patient (connecté)
- **Mes rendez-vous** : à venir / passés, détail (adresse, itinéraire, motif, consignes, documents à apporter), **Annuler**, **Déplacer**, « Reprendre rendez-vous ».
- **Mes documents** : documents envoyés par les soignants (ordonnances, comptes rendus), documents ajoutés par le patient, téléchargement PDF.
- **Mes proches** : ajouter un proche (identité, date de naissance, lien), prendre RDV pour lui.
- **Mes soignants** : soignants déjà consultés, raccourci « Prendre rendez-vous ».
- **Messages** (si activé par le soignant).
- **Mon compte** : identité, coordonnées, connexion et sécurité (mot de passe, 2FA), notifications, données et confidentialité (export, suppression), déconnexion.

### 1.7 Notifications patient
- SMS + e-mail à la **confirmation**, **rappel 48 h** (et parfois 24 h) avant, à l'**annulation / déplacement** (y compris si le cabinet annule), **liste d'attente** (un créneau plus tôt s'est libéré), push dans l'app.

## 2. Doctolib Pro (espace soignant)

Offres observées (France, médecin généraliste) : Essentiel 229 €, Standard 229 €, Plus 349 €, Intégral 489 € / mois ; à la carte : **Agenda & prise de RDV 149 €/mois**, Téléconsultation 119 €, Logiciel médical & facturation 181 €, Assistant consultation 79 €, Assistant téléphonique 99 €, Lecteur CV/CPS 29 €. Les 5 piliers marketing : Consultation, Coordination, Facturation, Secrétariat, Pilotage.

### 2.1 Agenda (cœur du produit)
- Vues **jour / semaine / mois**, colonne par praticien ou par agenda, codes couleur par motif.
- **Multi-agendas** : un praticien peut avoir plusieurs agendas (cabinet A, cabinet B, salle), une secrétaire voit plusieurs praticiens.
- **Motifs de consultation** : libellé, durée, couleur, visible en ligne ou non, réservé aux patients déjà suivis, consignes au patient, questions préalables, délai minimum avant réservation, délai d'annulation, tarif.
- **Plages de disponibilité** : horaires d'ouverture par jour, plages réservables en ligne (récurrentes), quels motifs sur quelle plage, exceptions.
- **Absences / congés / blocages** ponctuels ou récurrents, avec gestion des RDV impactés (propositions de déplacement, notifications automatiques).
- **Prise de RDV par le cabinet** (recherche patient ou création à la volée), RDV en série, RDV « surbooking » forcé, notes sur le RDV, statut (arrivé, en salle d'attente, en consultation, terminé, non honoré).
- **Règles de réservation** : horizon max (ex. 3 mois), nombre max de RDV par patient, nouveaux patients acceptés oui/non, confirmation automatique ou validation manuelle.
- **Liste d'attente** : les patients demandent à être prévenus si un créneau plus tôt se libère.
- **Rappels** automatiques (SMS/e-mail) paramétrables, demande de confirmation au patient.
- **Remplaçant** : accès temporaire d'un confrère à l'agenda.
- Impression de la journée, export.

### 2.2 Patientèle
- Base patients du cabinet : identité, date de naissance, téléphone, e-mail, adresse, médecin traitant, notes administratives, **historique de RDV** (passés / à venir, honorés / non honorés), documents, étiquettes, fusion de doublons, blocage d'un patient (trop d'absences).
- Création de la fiche à la première réservation en ligne, rapprochement automatique avec le compte patient.

### 2.3 Secrétariat et rôles
- Utilisateurs d'un cabinet : praticien, secrétaire, administrateur ; droits fins (voir/modifier agenda, voir données patient, paramétrer, facturer).
- Télésecrétariat partenaire.
- Journal d'activité (qui a fait quoi).

### 2.4 Communication et documents
- Envoi de documents au patient (PDF) depuis la fiche ou le RDV ; demande de documents au patient avant le RDV.
- Messagerie patient ↔ cabinet (optionnelle, règles définies par le cabinet).
- Messagerie entre soignants (adressage), demandes d'avis.
- Modèles de documents, courriers, certificats.

### 2.5 Établissements
- Centres de santé, maisons de santé, cliniques, hôpitaux : plusieurs praticiens, plusieurs sites, ressources (salles, équipements), annuaire interne, pilotage (taux d'occupation, no-show, délais), gestion des accès.

### 2.6 Pilotage
- Statistiques : nombre de RDV, taux de RDV pris en ligne, taux de non-honorés, nouveaux patients, délai moyen de prise de RDV, remplissage.

## 3. Direction artistique mesurée (valeurs réelles)

| Élément | Valeur |
|---|---|
| Bleu principal (en-tête, liens, boutons) | `#107ACA` rgb(16,122,202) |
| Navy (titres, bouton Rechercher, bloc soignant) | `#00264C` rgb(0,38,76) |
| Texte principal | `#294056` rgb(41,64,86) |
| Texte sombre / presque noir | `#192634` rgb(25,38,52) |
| Fond bleu pâle (pages, bandeaux info) | `#E4EDF6` rgb(228,237,246) |
| Chips de créneaux | fond `#E5F9FF` rgb(229,249,255), texte `#192634`, rayon 8 px, hauteur 40 px |
| Jaune secondaire (bouton « Se connecter ») | ≈ `#F5CF66` |
| Bandeau profil praticien | `#294056` |
| Police titres | **Montserrat 700** |
| Police texte | **Roboto 400 / 500 / 700**, 14 px, interligne 24 px |
| En-tête | 64 px de haut |
| Barre de recherche | 60 px, rayon 32 px, ombre `rgba(25,38,52,.15) 0 0 20px` |
| Boutons | rayon 8 px, hauteur 40 px, 14 px, majuscules pour le CTA principal |
| Chips de filtre | blanc, rayon 16 px, hauteur 32 px |
| Cartes | blanc, rayon 8 px, bordure/ombre très légère |
| Icônes | linéaires, fines, couleur texte |

Voir `docs/02-design/direction-artistique.md` pour la transposition Twabibu.

## 4. Points forts à reproduire absolument
1. La **grille de créneaux visible dès la liste des résultats** : c'est ce qui fait réserver en 3 clics.
2. Le **récapitulatif latéral** du tunnel de réservation qui se remplit étape par étape.
3. La **fiche praticien riche et structurée** (SEO + confiance).
4. Les **règles de réservation côté soignant** (motifs, délais, nouveaux patients) : sans elles les soignants n'ouvrent pas leur agenda.
5. Les **rappels automatiques** : le vrai levier contre les absences.
6. La **cohérence visuelle** : une seule palette, deux polices, des cartes blanches, beaucoup d'air.
