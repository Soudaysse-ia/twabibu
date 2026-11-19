# SPEC-01 — Recherche et annuaire

## Objectif
Permettre à un patient de trouver un soignant ou un établissement en quelques secondes et de voir immédiatement ses prochains créneaux, sur ordinateur comme sur téléphone. Référence visuelle : `assets/references/doctolib-04-resultats-desktop.jpg`, `doctolib-05-filtres.jpg`, `doctolib-10-resultats-mobile.jpg`.

## Acteurs
Patient (connecté ou non), moteurs de recherche (SEO).

## Règles métier
1. **Champ « quoi »** : autocomplétion dès 2 caractères, groupes dans l'ordre : Spécialités (ex. « Pédiatre »), Motifs/expertises (« Vaccination »), Soignants (« Dr … »), Établissements. Recherche insensible aux accents et à la casse (`unaccent` + `pg_trgm`). Sélectionner un soignant ouvre directement son profil.
2. **Champ « où »** : îles, villes, localités (référentiel `Locality`) ; bouton « Autour de moi » (géolocalisation navigateur → `lat,lng`, rayon 15 km par défaut, élargi automatiquement à l'île si < 5 résultats). Valeur par défaut : dernière localité utilisée (localStorage) sinon vide = toutes les Comores.
3. **Résultats** : uniquement les praticiens `isPublished && verificationStatus = VERIFIED` et les établissements actifs. Un praticien exerçant sur plusieurs lieux apparaît une fois par lieu correspondant à la recherche.
4. **Tri par défaut** (« pertinence ») : correspondance spécialité exacte > distance (si géo) > prochaine disponibilité la plus proche > nom. Tri alternatifs : « Prochaine disponibilité », « Distance ».
5. **Grille de créneaux** : pour chaque carte, les 5 prochains jours à partir d'aujourd'hui (colonne par jour, 4 créneaux max par jour, « — » si aucun), flèches ‹ › pour avancer par 5 jours (jusqu'à l'horizon de l'agenda), lien « Voir plus de créneaux » ouvre le profil à l'étape créneau. Les créneaux affichés sont ceux du **motif par défaut en ligne** de l'agenda principal (ou du motif correspondant au terme recherché s'il existe). Cliquer un créneau démarre le tunnel avec ce créneau pré-sélectionné.
6. **Messages alternatifs** dans la grille : « Ce soignant réserve la prise de rendez-vous en ligne aux patients déjà suivis » (si `acceptsNewPatients = false` et patient non connu), « Prochaine disponibilité le … » si rien sous 5 jours, « Réservation en ligne indisponible — appeler le cabinet » si `onlineBookingEnabled = false`.
7. **Filtres** : Disponibilités (aujourd'hui / 3 / 7 / 14 jours), Langues parlées, Nouveaux patients acceptés, Moyens de paiement, Assurance acceptée, Type (soignant / établissement). Les filtres sont dans l'URL (`?dispo=3&langues=zdj,ar`) pour être partageables et indexables (sauf géo).
8. **Pagination** : 20 résultats par page, « Page précédente / suivante », `rel=prev/next`.
9. **Carte** : marqueurs numérotés synchronisés avec la liste (survol → mise en évidence), chargée à la demande sur mobile (« Afficher la carte »), toujours visible sur desktop en colonne droite collante.
10. **SEO** : URL canonique `/{specialite}/{localite}` (ex. `/pediatre/moroni`), titre « Pédiatre Moroni : prenez rendez-vous en ligne | Twabibu », description, H1 « Pédiatre à Moroni », texte d'introduction, JSON-LD `ItemList` de `Physician`, fil d'Ariane. Pages générées en ISR (revalidation 10 min) pour les combinaisons spécialité × localité ayant ≥ 1 résultat.
11. **Sans résultat** : état vide avec suggestions (élargir à l'île, spécialités proches), lien « Vous êtes soignant ? Inscrivez votre cabinet ».

## Écrans
- Barre de recherche (accueil, en-tête des résultats), modale « Filtres » (desktop) / tiroir plein écran (mobile), liste + carte, état vide, squelettes de chargement (3 cartes).

## API
`GET /v1/search/suggest`, `GET /v1/search/places`, `GET /v1/search/practitioners` (voir `api.md`). Réponse d'un résultat :
```json
{ "id": "…", "slug": "ilma-said", "displayName": "Dr Ilma Saïd", "speciality": {"id":"…","name":"Médecin généraliste"},
  "photoUrl": "…", "verified": true, "acceptsNewPatients": true, "onlineBooking": true,
  "practice": {"id":"…","addressLine":"Rue de la Corniche","locality":"Moroni","island":"Ngazidja","lat":-11.70,"lng":43.25,"distanceKm":1.2},
  "priceFrom": 5000, "insurances": ["AMG"], "languages": ["fr","zdj"],
  "nextSlots": {"motiveId":"…","days":[{"date":"2026-11-12","slots":["2026-11-12T07:40:00Z","…"]}, …]},
  "nextAvailabilityAt": "2026-11-12T07:40:00Z", "availabilityMessage": null }
```

## Données
`Practitioner.searchVector` maintenu par trigger ; vue matérialisée `practitioner_search` rafraîchie toutes les 5 min (ou à la publication) pour les listes ; cache Redis des `nextSlots` par (agenda, motif, jour) invalidé à chaque RDV/absence.

## Cas limites
- Terme inconnu → recherche plein texte libre sur nom/bio/expertises.
- Géolocalisation refusée → message discret, recherche sur toutes les îles.
- Praticien sans agenda en ligne → carte sans grille, bouton « Voir le profil ».
- Plus de 5 lieux pour un praticien → regroupés avec « + 3 autres lieux ».

## Critères d'acceptation
- [ ] Taper « ped » propose « Pédiatre » en < 300 ms (p95) ; « Moro » propose « Moroni (Ngazidja) ».
- [ ] La page `/pediatre/moroni` se rend côté serveur avec titres, méta, JSON-LD et au moins les 20 premiers résultats sans JavaScript.
- [ ] La grille affiche exactement les créneaux retournés par le moteur de disponibilités (test d'intégration avec un agenda fictif).
- [ ] Les filtres modifient l'URL et sont restaurés au rechargement.
- [ ] Sur mobile (375 px) : chips défilables, cartes lisibles, bouton « Prendre rendez-vous » de 48 px, carte accessible via bouton.
- [ ] Lighthouse mobile ≥ 85 performance, 100 accessibilité sur la page résultats avec 20 cartes.

## Tickets
SEARCH-01 référentiels et seed (spécialités, localités) · SEARCH-02 endpoint suggest · SEARCH-03 endpoint practitioners + tri + pagination · SEARCH-04 composant SearchBar + autocomplétions · SEARCH-05 page résultats SSR + cartes + grille · SEARCH-06 filtres (modale/tiroir, URL) · SEARCH-07 carte Leaflet synchronisée · SEARCH-08 pages SEO spécialité × localité + sitemap · SEARCH-09 états vides, erreurs, squelettes · SEARCH-10 tests e2e Playwright.
