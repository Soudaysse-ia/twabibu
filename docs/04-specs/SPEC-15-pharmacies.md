# SPEC-15 — Pharmacies (Twabibu Pharma)

## Objectif
Intégrer les pharmacies dans l'écosystème : annuaire et pharmacies de garde, catalogue de médicaments, réception des ordonnances numériques, commande avec retrait ou livraison, et espaces sponsorisés qui financent la plateforme.

## Acteurs
Pharmacie (titulaire = `OWNER`, pharmaciens, préparateurs = `STAFF`), patient, médecin (visibilité de la dispensation), livreur (V2), back-office (gardes, référentiel, vérification), annonceur (la pharmacie elle-même).

## 1. Annuaire et pharmacies de garde
- Une pharmacie est une `Organization` de type `PHARMACY` avec un `Practice` (lieu), horaires, téléphone, services (livraison, zone de livraison, paiement carte / MVola / Huri Money, parapharmacie, matériel médical), photos, statut vérifié (autorisation d'ouverture, diplôme du titulaire).
- **Page publique** `/pharmacies/{ile}/{localite}` et `/pharmacie/{slug}` ; dans la recherche principale, « pharmacie » est une entrée au même titre qu'une spécialité ; carte.
- **Gardes** : `DutySchedule` (pharmacyId, startsAt, endsAt, island, zone, source) saisi par le back-office ou importé (CSV du syndicat/ministère) ; les pharmacies peuvent proposer une correction. Page publique **« Pharmacies de garde »** (`/pharmacies-de-garde`) : par île, aujourd'hui / cette semaine, avec « Ouverte maintenant », distance, appel, itinéraire. Accessible sans compte, en page d'accueil (bloc dédié) et dans l'app (onglet). Notification push/SMS optionnelle « pharmacie de garde près de chez vous » (V2).

## 2. Catalogue
- `PharmacyProduct` : lien au référentiel `Drug` (ou produit libre : parapharmacie, matériel), nom affiché, prix KMF, disponibilité (en stock / faible / rupture / sur commande), mise à jour manuelle, par import CSV/Excel, ou par API (V2, pour les logiciels de gestion de stock).
- Produits « sur ordonnance » : affichés avec prix et disponibilité mais commandables uniquement avec une ordonnance (numérique ou photo) ; produits libres : commandables directement.
- Page médicament publique `/medicament/{slug}` : DCI, formes, « disponible dans N pharmacies près de vous » avec prix (comparateur), sans conseil médical ; **bannière sponsorisée** possible.

## 3. Ordonnances reçues
- File « Ordonnances » dans Twabibu Pharma : ordonnances numériques envoyées par les patients (SPEC-14) et photos d'ordonnances papier. Pour chaque ligne : disponible / substitution proposée / indisponible, prix, total estimé → réponse au patient (« Prête dans 30 min », « 2 produits indisponibles »). Le patient confirme → commande.
- Dispensation : « Délivrée » (totalement / partiellement) → enregistrée sur l'ordonnance (visible médecin et patient), traitement mis à jour dans le dossier.
- Ordonnance papier : le pharmacien vérifie ; Twabibu n'authentifie que les ordonnances numériques (QR).

## 4. Commandes et livraison
- `Order` : pharmacyId, patient (compte ou invité par OTP), lignes (produit, quantité, prix), ordonnance liée, mode (`PICKUP` | `DELIVERY`), adresse/localité + indications + téléphone, paiement (`AT_PICKUP` | `CASH_ON_DELIVERY` | `MOBILE_MONEY` V2), statuts `PENDING → ACCEPTED → PREPARING → READY | OUT_FOR_DELIVERY → DELIVERED | CANCELLED`, horodatages, livreur (nom, téléphone).
- Notifications SMS/push à chaque changement de statut ; le patient peut annuler avant `PREPARING`.
- Livraison : par la pharmacie (ses livreurs) en V1 ; livreurs partenaires et suivi de position en V2 ; frais de livraison fixés par la pharmacie (par zone).
- Pas de vente par Twabibu : la transaction est entre la pharmacie et le patient ; Twabibu enregistre et notifie.

## 5. Espaces sponsorisés (monétisation)
- **Pharmacie partenaire** : badge + mise en avant (premier résultat dans sa localité, encart sur la page des gardes de son île, bannière sur les pages médicaments de ses produits). Vente au mois, inventaire limité par localité (ex. 3 emplacements par île), géré dans le back-office (`SponsoredPlacement` : pharmacyId, slot, zone, startsAt, endsAt, price), toujours libellé « Partenaire ».
- Abonnement Twabibu Pharma (profil + ordonnances + catalogue + commandes) et commission optionnelle sur les commandes livrées (feature flag).
- Jamais de publicité pour un médicament sur ordonnance auprès des patients ; uniquement mise en avant de pharmacies et de produits libres.

## 6. Écrans
- Public : pharmacies de garde (page + bloc accueil + onglet app), annuaire, profil pharmacie, page médicament/comparateur, tunnel de commande (panier → ordonnance → mode → coordonnées → confirmation), suivi de commande.
- Patient : `/mon-compte/commandes`, envoi d'ordonnance (depuis `/mon-compte/ordonnances`).
- Twabibu Pharma (`/pharma/app`) : tableau de bord (ordonnances reçues, commandes du jour, gardes à venir), Ordonnances, Commandes (kanban statuts), Catalogue (tableau éditable, import), Profil et horaires, Gardes, Équipe, Abonnement et espaces sponsorisés, Statistiques (vues, ordonnances reçues, commandes, panier moyen).
- Back-office : vérification des pharmacies, calendrier des gardes par île, inventaire des espaces sponsorisés, modération du catalogue (prix aberrants, produits interdits).

## 7. Règles
1. Pharmacie non vérifiée : visible dans l'annuaire (données publiques) mais pas de commandes ni d'ordonnances.
2. Prix affichés = prix saisis par la pharmacie, horodatés ; mention « prix indicatif, mis à jour le … ».
3. Produits contrôlés : jamais commandables en ligne ; retrait au comptoir uniquement.
4. Données de commande = données de santé (contenu de l'ordonnance) : mêmes règles de chiffrement/accès ; le livreur ne voit que l'adresse et le nombre de colis.
5. Gardes : source officielle ; en cas de conflit, le back-office tranche ; horodatage de dernière mise à jour affiché.

## 8. Données
`Organization(type=PHARMACY)`, `PharmacyProfile` (services, deliveryZones, fees), `DutySchedule`, `PharmacyProduct`, `Order`, `OrderLine`, `OrderEvent`, `SponsoredPlacement`, `ProductReport`.

## 9. API
`/v1/pharmacies?lat&lng&island&open=now`, `/v1/pharmacies/on-duty?island&date`, `/v1/pharmacies/{slug}`, `/v1/drugs/{slug}/availability`, `/v1/orders` (patient : create, list, cancel, track), `/v1/pharma/orgs/{orgId}/prescriptions` (inbox, respond, dispense), `/v1/pharma/orgs/{orgId}/orders` (list, status), `/v1/pharma/orgs/{orgId}/products` (CRUD, import), `/v1/pharma/orgs/{orgId}/duty`, `/v1/admin/duty-schedules`, `/v1/admin/placements`.

## 10. Critères d'acceptation
- [x] La page « Pharmacies de garde » affiche les bonnes pharmacies pour une date et une île données (test avec calendrier seed), en < 1 s, sans compte. *(≈ 10 ms côté API ; les gardes déjà terminées sont masquées.)*
- [x] Une ordonnance numérique envoyée à une pharmacie apparaît dans sa file en < 5 s ; sa réponse est visible par le patient ; la dispensation apparaît chez le médecin. *(File rafraîchie toutes les 5 s.)*
- [x] Une commande de produits libres avec livraison passe par tous les statuts avec un **e-mail** à chaque étape (ADR-016 : l’e-mail remplace le SMS).
- [x] Un produit contrôlé ne peut pas être ajouté au panier (test).
- [x] Un emplacement sponsorisé actif s'affiche avec le libellé « Partenaire » et disparaît à sa date de fin. *(Règle testée ; jamais sur un médicament sur ordonnance.)*

### Règles ajoutées pendant la réalisation (13/11/2026)
- Un produit lié au référentiel hérite de ses indicateurs « sur ordonnance » et « contrôlé » : la pharmacie ne peut pas les lever. Un médicament doit venir du référentiel ; seuls la parapharmacie et le matériel sont libres.
- Une substitution n’est proposée que si le prescripteur l’a autorisée sur la ligne.
- Une commande contenant un produit contrôlé est en retrait uniquement.
- La remise d’une commande sur ordonnance est validée par un pharmacien (pas un préparateur) et enregistre la dispensation (totale ou partielle).
- Lire une ordonnance reçue est une lecture du dossier : journalisée (une ligne par personne, membre et 12 h).
- Un titulaire de pharmacie n’a jamais accès aux routes Twabibu Pro (cabinets), et inversement.

## Tickets
PHARM-01 organisations pharmacie, profil, vérification, annuaire + carte · PHARM-02 gardes (modèle, import, back-office, page publique, bloc accueil) · PHARM-03 catalogue (modèle, édition, import CSV, page médicament, comparateur) · PHARM-04 réception d'ordonnances + réponse + dispensation · PHARM-05 commandes (tunnel patient, statuts, notifications, retrait/livraison) · PHARM-06 Twabibu Pharma (tableau de bord, kanban commandes, équipe) · PHARM-07 espaces sponsorisés (modèle, inventaire, affichage, facturation) · PHARM-08 statistiques pharmacie · PHARM-09 app mobile (onglet gardes, commandes) · PHARM-10 tests.
