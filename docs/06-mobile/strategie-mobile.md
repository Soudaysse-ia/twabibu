# Stratégie mobile — Twabibu pour Android et iPhone

## 1. Décision
**Expo (React Native, SDK courant) + Expo Router**, dans `apps/mobile`, avec deux cibles dans la même base de code : **Twabibu** (patients) d'abord, **Twabibu Pro** (soignants, secrétaires) ensuite — deux apps distinctes sur les stores (deux `app.config.ts`, mêmes packages). Le site web reste la référence fonctionnelle ; l'app n'ajoute rien que le web n'ait pas, sauf les notifications push et l'ergonomie native.

Ce qui est partagé avec le web : `packages/contracts` (types, validation), `packages/api-client` (appels, auth, refresh), `packages/tokens` (couleurs, typographie, espacements), `packages/i18n` (textes), `packages/availability` (affichage cohérent des créneaux), `packages/utils` (dates, téléphone). Ce qui est réécrit : les composants d'interface (`packages/ui-native`) avec les mêmes noms et props que `packages/ui` quand c'est possible.

## 2. Préparer le web dès la phase 0 pour que les apps soient faciles
1. **Aucune logique métier dans Next.js** : tout passe par l'API (`/v1`), documentée OpenAPI. Les apps appellent exactement les mêmes routes.
2. **Auth compatible mobile** : l'API accepte un `Authorization: Bearer` en plus du cookie ; refresh token rotatif stocké dans `expo-secure-store`.
3. **Contrats et erreurs** dans `packages/contracts` : les messages utilisateur viennent de `packages/i18n`, jamais en dur dans les composants.
4. **Tokens de design** dans un JSON neutre (`design-tokens.json`) converti pour chaque plateforme.
5. **Liens profonds** : toutes les pages web ont une URL stable (`/{specialite}/{localite}/{slug}`, `/mon-compte/rendez-vous/{id}`, `/r/{code}`) ; les apps déclarent les mêmes chemins (Universal Links iOS / App Links Android, domaine `twabibu.km`) pour que les liens des SMS ouvrent l'app si elle est installée.
6. **Médias** : images servies par l'API/CDN en tailles multiples (profil 72/144/288 px).
7. **Push** : table `DeviceToken`, endpoint `POST /me/devices`, envoi via Expo Push Service depuis le module notifications (canal `PUSH`, jamais seul pour un rappel).
8. **Mode dégradé** : l'API renvoie des payloads compacts (pagination, champs `fields=`) pour la 3G.

## 3. Périmètre de l'app patient (phase 4)
Onglets : **Rechercher** (SearchBar, résultats, carte), **Mes rendez-vous**, **Pharmacies** (pharmacies de garde par île, ouvertes maintenant, commandes), **Carnet** (ordonnances, traitements, documents, proches), **Compte**. Tunnel de réservation identique au web (étapes natives), connexion OTP avec lecture automatique du SMS (Android), biométrie pour rouvrir l'app, ajout au calendrier natif, itinéraire via l'app de cartes, notifications push (confirmation, rappel, changement), mode hors-ligne : RDV à venir en cache.

## 4. Périmètre de l'app Pro (phase 4, bêta)
Agenda jour (liste + grille simplifiée), changement de statut (arrivé, terminé, non honoré), création rapide de RDV, recherche patient, appel/SMS au patient en un geste, absences rapides, notifications push (nouveau RDV en ligne, annulation), accès secrétaire avec les mêmes droits que le web.

## 5. Outils et publication
- EAS Build (profils `development`, `preview`, `production`), EAS Update pour les correctifs JS, EAS Submit.
- Comptes : Apple Developer (entité Twabibu), Google Play Console. Préparer : politique de confidentialité en ligne, captures d'écran (6,7" et 6,5" iOS, téléphone Android), textes des fiches en français, catégorie « Médecine », questionnaire données de santé (Apple : « données de santé » = oui, non partagées à des tiers).
- Tests : Detox ou Maestro pour les parcours P1/P2 ; TestFlight et Play « test interne » avec les cabinets pilotes.
- Suivi : Sentry React Native, crash-free ≥ 99,5 %.

## 6. Tickets MOBILE
| ID | Titre |
|---|---|
| ☐ MOBILE-01 | Projet Expo, Expo Router, `ui-native` (Button, TextField, PhoneField, OtpField, Card, SlotChip, Header, BottomTabs), tokens, polices |
| ☐ MOBILE-02 | Auth OTP, stockage sécurisé, refresh, biométrie, écran compte |
| ☐ MOBILE-03 | Recherche, résultats (AvailabilityGrid natif), filtres, carte (react-native-maps avec tuiles OSM) |
| ☐ MOBILE-04 | Profil soignant + tunnel de réservation complet |
| ☐ MOBILE-05 | Mes rendez-vous (annuler/déplacer), proches, documents (visionneuse PDF), calendrier natif |
| ☐ MOBILE-06 | Push : permissions, `DeviceToken`, réception, liens profonds, Universal/App Links |
| ☐ MOBILE-07 | App Pro (agenda jour, statuts, création RDV, patients, absences, push) |
| ☐ MOBILE-08 | EAS Build/Submit, fiches stores, bêta pilotes, publication |
| ☐ MOBILE-09 | App Twabibu Pharma (ordonnances reçues, commandes, gardes) |
