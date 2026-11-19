# SPEC-02 — Profil public du soignant

## Objectif
Donner confiance et toutes les informations pratiques avant de réserver, et servir de page SEO principale. Référence : `assets/references/doctolib-06-profil-praticien.jpg`.

## Acteurs
Patient, moteurs de recherche, soignant (édition depuis Twabibu Pro, SPEC-07).

## Règles métier
1. URL `/{specialite}/{localite}/{slug}` ; le slug est unique, stable, généré `prenom-nom` (+ suffixe numérique si collision). Une redirection 301 est conservée si le slug change.
2. Profil visible seulement si `VERIFIED` et `isPublished`. Sinon : 404 pour le public, aperçu « Profil non publié » pour le soignant connecté.
3. **Bandeau navy** : photo (ou initiales), « Dr Prénom Nom », spécialité principale, badge « Profil vérifié Twabibu » (icône bouclier). Sur mobile : bouton « Prendre rendez-vous » collant en bas.
4. **Carte « En résumé »** (collante à droite) : accepte / n'accepte pas les nouveaux patients, adresse principale, tarif « à partir de X KMF », « Réservation en ligne » ou « Sur rendez-vous par téléphone : +269 … », bouton principal **« PRENDRE RENDEZ-VOUS »** (ou « APPELER LE CABINET » si pas de réservation en ligne).
5. **Sections** (cartes blanches, dans cet ordre, masquées si vides) : Adresses (chaque lieu : nom, adresse, localité, île, bouton « Itinéraire » → lien OSM/Google Maps externe, mini-carte, informations d'accès : étage, ascenseur, parking, accès PMR) · Présentation (texte, 2 000 caractères max, sauts de ligne) · Photos du cabinet (galerie 3 + « +N ») · Expertises et actes (tags, « +N ») · Tarifs (tableau motif → KMF, mention « Tarifs indicatifs, communiqués par le soignant », moyens de paiement : espèces, carte, MVola, Huri Money, chèque ; assurances acceptées) · Horaires d'ouverture par lieu (lundi → dimanche, « Fermé ») · Langues parlées · Formations (année, diplôme, établissement) · Expérience · Informations légales (n° d'autorisation d'exercer, Ordre si applicable) · FAQ générée (adresse ? horaires ? paiement ? nouveaux patients ? langues ?) avec JSON-LD `FAQPage` · « Signaler un problème avec ce profil ».
6. **Vignette de disponibilités** sous le bandeau sur desktop : les 5 prochains jours (même composant que la recherche), pour réserver sans passer par le bouton.
7. **SEO** : titre « Dr Ilma Saïd, Médecin généraliste à Moroni : prenez RDV en ligne — Twabibu », description générée, JSON-LD `Physician` (nom, spécialité, adresse, téléphone, horaires, image), fil d'Ariane, `og:image` (photo ou carte générique Twabibu).
8. Les données du profil sont saisies et validées dans Twabibu Pro (SPEC-07). Toute modification de nom, spécialité ou pièces légales repasse en vérification légère (back-office).

## API
`GET /v1/practitioners/{slug}` (profil complet, cache 60 s), `GET /v1/practitioners/{id}/availabilities`, `POST /v1/practitioners/{id}/reports`.

## Cas limites
- Praticien suspendu : page « Ce profil n'est plus disponible » (410).
- Praticien rattaché à un établissement : lien « Voir l'établissement » dans le bandeau.
- Pas de photo : initiales sur fond bleu pâle.
- Plusieurs lieux avec horaires différents : onglets par lieu dans « Horaires ».

## Critères d'acceptation
- [ ] Rendu SSR complet, Lighthouse SEO 100, JSON-LD valide (test Rich Results).
- [ ] Le bouton « Prendre rendez-vous » mène à l'étape lieu (si > 1 lieu) ou motif.
- [ ] Mobile : bouton collant visible en permanence, sections repliables au-delà de 6 lignes (« Voir plus »).
- [ ] Un profil non vérifié n'est jamais servi au public (test).

## Tickets
PROFILE-01 endpoint profil · PROFILE-02 page + bandeau + résumé · PROFILE-03 sections · PROFILE-04 galerie + itinéraire + mini-carte · PROFILE-05 SEO (métadonnées, JSON-LD, FAQ) · PROFILE-06 signalement · PROFILE-07 tests.
