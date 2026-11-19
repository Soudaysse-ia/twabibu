# Direction artistique Twabibu

Objectif : **la même expérience visuelle que Doctolib** (clair, bleu, rassurant, aéré, cartes blanches), avec l'identité Twabibu. Les valeurs ci-dessous ont été mesurées sur doctolib.fr le 11/11/2026 puis transposées. Elles sont la source de vérité pour `design-tokens.json`, Tailwind et les apps mobiles.

## 1. Identité (logo officiel fourni le 11/11/2026)

- **Logo** : fichiers dans `assets/brand/` — `logo-twabibu-fond-bleu.svg` (version principale : stéthoscope blanc + wordmark « Twabibu » + signature, sur fond bleu `#1956B4`), `logo-twabibu-blanc.svg` (blanc sur fond transparent, pour l'en-tête et les fonds bleus), `logo-twabibu-bleu.svg` (bleu sur fond clair, pour les documents, e-mails, ordonnances), `logo-twabibu-original.svg` (fichier source). Le symbole seul (stéthoscope) sert d'icône d'application et de favicon : carré bleu `#1956B4` à coins arrondis, stéthoscope blanc.
- **Signature** : « **À vos côtés, dans chaque temps de soin.** » (en capitales fines sous le wordmark dans le logo ; en phrase normale dans les textes). Elle remplace le slogan de travail.
- **Wordmark** : sans-serif géométrique grasse, « Twabibu » avec T et w liés. Ne pas le recomposer en texte : toujours utiliser le SVG. Zone de protection = hauteur du « T » tout autour. Taille minimale : 96 px de large (web), 24 mm (print).
- **Nom** : Twabibu, majuscule initiale, jamais « TwaBibu ». Signification : « médecin » en shikomori.
- **Ton** : vouvoiement, phrases courtes, rassurant. Voir `composants-ui.md` (microcopie).
- **Pas de formes décoratives** : aucun cercle, blob ou motif en fond de page ou de bandeau (demande du 12/11/2026). Aplats unis ; les photos en contexte comorien portent l'image.
- **Thème clair uniquement** : pas de mode sombre, pas de grandes sections bleu nuit en bas de page ; le bas de page reste clair (fond `background` ou blanc), le `navy` est réservé aux titres et au bouton « Rechercher ».
- **Ce qu'on garde de Doctolib** : la structure (en-tête colorée, barre de recherche pilule, cartes blanches, grille de créneaux), pas ses couleurs exactes : le bleu de référence est désormais celui du logo.

## 2. Couleurs (dérivées du logo)

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#2A6BCB` | **Bleu Twabibu** (bleu du logo légèrement éclairci, demande du 12/11/2026). En-tête, liens, bouton principal, icônes actives |
| `primary-hover` | `#2360BA` | Survol |
| `primary-active` | `#1956B4` | Pression |
| `brand-logo` | `#1956B4` | Bleu d'origine du fichier logo (fond de la version « fond bleu » uniquement) |
| `primary-soft` | `#E6EEF9` | Fonds d'icônes, bandeaux info, chip sélectionnée |
| `slot` | `#E6F3FF` | Chips de créneaux (texte `ink`) |
| `navy` | `#0B2A5B` | Titres H1/H2, bouton « Rechercher », sections sombres (bleu nuit dérivé du logo) |
| `navy-700` | `#2B4162` | Texte courant, bandeau du profil praticien |
| `ink` | `#192634` | Texte très contrasté |
| `text-muted` | `#5D7186` | Textes secondaires |
| `surface` | `#FFFFFF` | Cartes, barre de recherche, modales |
| `background` | `#E8EEF7` | Fond des pages |
| `background-soft` | `#F3F6FB` | Sections alternées, lignes de tableau |
| `border` | `#D3DCEA` | Bordures |
| `accent` (jaune) | `#F5CF66` | Bouton secondaire fort (à utiliser avec parcimonie : le logo est monochrome) |
| `success` | `#1B9C5A` / `#E3F5EA` | RDV confirmé, profil vérifié, pharmacie ouverte |
| `warning` | `#D97706` / `#FEF3E2` | En attente, délai dépassé, stock faible |
| `danger` | `#D23B3B` / `#FBE9E9` | Annulation, erreurs, allergie, non honoré |
| `pharmacy` | `#0E8A6D` / `#E0F3EE` | Identité du module Pharmacies (croix verte), pharmacies de garde |
| `calendar-*` | 8 pastels | Couleurs de motifs dans l'agenda |

Règles : fond bleu pâle + cartes blanches ; une seule couleur forte (le bleu du logo) ; le vert `pharmacy` uniquement dans le module pharmacies ; contraste AA. Le blanc sur `#2A6BCB` donne un contraste d'environ 5,2:1 (conforme AA pour le texte courant).

## 3. Typographie

| Rôle | Police | Taille / graisse / interligne |
|---|---|---|
| Display (hero) | Montserrat 700 | 32/40 px desktop, 28/36 px mobile |
| H1 (page) | Montserrat 700 | 24/32 px |
| H2 (section, carte) | Montserrat 700 | 18/24 px ; 14/20 px pour les titres de carte avec icône (comme Doctolib) |
| H3 | Montserrat 700 | 16/24 px |
| Corps | Roboto 400 | 14/24 px (base), 16/24 px pour les paragraphes longs |
| Petit | Roboto 400 | 12/16 px |
| Label / bouton | Roboto 500 | 14/20 px, majuscules pour le CTA principal uniquement |
| Nombres (créneaux, stats) | Roboto 500, chiffres tabulaires | 14 px |

Chargement : Google Fonts (`Montserrat:700,800` et `Roboto:400,500,700`) avec `font-display: swap`, ou auto-hébergement via `next/font` (recommandé pour les Comores : moins de requêtes externes).

## 4. Espacements, rayons, ombres

- Grille de 4 px. Échelle : 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80.
- Gouttière de page : 16 px mobile, 24 px tablette, 32 px desktop. Largeur max du contenu : 1200 px (résultats et profil : colonne principale 760 px + colonne droite 360 px).
- Rayons : `sm` 4 px (champs), `md` 8 px (boutons, cartes, chips de créneau), `lg` 16 px (chips de filtre, cartes promotionnelles), `pill` 32 px (barre de recherche, boutons mobiles larges), `full` (avatars).
- Ombres : `card` `0 1px 2px rgba(25,38,52,.06)`, `float` `0 0 20px rgba(25,38,52,.15)` (barre de recherche, modale), `header` `0 2px 4px rgba(0,38,76,.08)`.
- Bordure des cartes : 1 px `border` (ou ombre `card`, pas les deux).

## 5. Iconographie et illustrations

- Icônes : **Lucide** (trait 1,75 px, 20 px par défaut, 16 px en inline, 24 px dans les cartes de bénéfices). Couleur = couleur du texte adjacent. Les icônes « métier » (calendrier, pin, euro → remplacé par `KMF`/billet, stéthoscope, bouclier) suivent cette bibliothèque.
- Illustrations de bénéfices : icône dans un disque bleu pâle, sans forme décorative derrière.
- Photos : ratio 4:3 dans le hero, rondes (72 px) pour les avatars soignants, 48 px dans les listes, 40 px dans l'agenda. Avatar par défaut : initiales sur fond `primary-soft`.

## 6. Mise en page des gabarits clés

### En-tête (64 px)
- Desktop : logo à gauche ; à droite « Vous êtes soignant ? » (bouton blanc), « Centre d'aide » (icône + texte blanc), « Se connecter » (icône + texte) ou avatar du patient connecté.
- Mobile : barre bleue 56 px, logo centré, flèche retour à gauche sur les pages internes, icône compte à droite ; menu « hamburger » uniquement sur l'accueil.
- Pages de résultats : la barre de recherche descend dans l'en-tête (desktop) ou dans une barre secondaire (mobile).

### Accueil
Hero bleu uni + photo → barre de recherche pilule → bloc pharmacies de garde → 3 bénéfices → chiffres clés → bloc confiance/données → bloc applications → bloc soignants (fond clair, bordure bleue) → bandeau aide → pied de page SEO clair.

### Résultats
Chips de filtres → compteur → liste de cartes praticien (colonne gauche 760 px) + carte géographique collante (colonne droite) → pagination. Mobile : liste seule, bouton « Afficher la carte ».

### Profil
Bandeau navy identité → colonne principale de cartes → colonne droite « En résumé » collante avec le bouton bleu. Mobile : bouton « Prendre rendez-vous » collant en bas d'écran.

### Tunnel de réservation
Fond `background`, carte d'étape à gauche (max 600 px), récapitulatif à droite (360 px). Mobile : récapitulatif replié en haut (« Votre rendez-vous en détail ▸ »), étape en pleine largeur, bouton d'action collant en bas.

### Espace Pro
Barre latérale gauche navy 240 px (Agenda, Patients, Documents, Statistiques, Paramètres), en-tête blanc 56 px avec sélecteur d'agenda, date, recherche patient, bouton « + Rendez-vous ». Agenda : grille horaire 15 min, colonnes par jour/praticien, RDV colorés par motif. Mobile Pro : vue jour, navigation par onglets bas.

### Compte patient
Navigation à gauche (desktop) / onglets (mobile) : Mes rendez-vous, Mes proches, Mes soignants, Mes documents, Mon compte.

## 7. Mouvement et états
- Transitions 150 ms (couleur), 200 ms (ombre, translation 2–4 px au survol des cartes), 250 ms pour les modales (fondu + léger zoom), aucune animation décorative longue.
- États obligatoires pour tout composant interactif : par défaut, survol, pression, focus visible (anneau 2 px `primary` décalé de 2 px), désactivé (opacité 50 %), chargement (squelette `background-soft` animé).
- Respect de `prefers-reduced-motion`.

## 8. Accessibilité
- Contraste AA, cibles tactiles 44 × 44 px minimum, navigation clavier complète, libellés de formulaires explicites, messages d'erreur sous les champs, `aria-live` pour les confirmations, focus géré dans les modales et le tunnel.
- Taille de texte minimale 14 px ; 16 px dans les champs sur mobile (évite le zoom iOS).

## 9. Ce qu'on ne copie pas
- Le logo, le script et les illustrations propriétaires de Doctolib.
- Le nom des produits (« Doctolib Pro ») : chez nous **« Twabibu Pro »**.
- Les photos du site Doctolib.
