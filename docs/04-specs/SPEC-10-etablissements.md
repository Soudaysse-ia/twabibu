# SPEC-10 — Établissements multi-praticiens

## Objectif
Servir les centres de santé, cliniques, hôpitaux et cabinets de groupe : plusieurs praticiens, plusieurs sites, une administration centrale, une page publique commune.

## Règles métier
1. Une `Organization` de type `HEALTH_CENTER | CLINIC | HOSPITAL | GROUP_PRACTICE` possède n `Practitioner`, n `Practice` (sites), n `Membership`. Un praticien peut aussi exister seul puis rejoindre une structure (transfert de rattachement validé par les deux parties et le back-office).
2. **Page publique** `/etablissement/{slug}` : logo, nom, type, description, sites (adresses, horaires), liste des praticiens par spécialité avec leur grille de créneaux, « Prendre rendez-vous » par praticien, services (spécialités disponibles), moyens de paiement, assurances. Résultat « établissement » dans la recherche (« 7 médecins généralistes »).
3. **Administration centrale** : l'admin de structure gère les lieux, les praticiens (créer un praticien sans compte utilisateur, puis l'inviter), l'équipe, les motifs partagés (modèles appliqués à plusieurs agendas), les paramètres de notification communs, l'abonnement (sièges = nombre de praticiens).
4. **Agendas partagés / ressources** (V2) : une ressource (salle, échographe) a son propre agenda ; un motif peut exiger une ressource ; le moteur vérifie la double disponibilité.
5. **Tableau de bord** (V1) : par site et par praticien : RDV sur la période, % en ligne, taux de non-honorés, délai moyen avant RDV, remplissage des plages, nouveaux patients ; export CSV.
6. **Vérification** : la structure est vérifiée (registre, autorisation d'ouverture) **et** chaque praticien l'est individuellement.
7. **Secrétariat central** : une secrétaire peut être rattachée à tous les agendas d'un site ou de la structure ; vue jour multi-colonnes (jusqu'à 8 agendas lisibles sur desktop, sélection sur mobile).

## Écrans
- Public : page établissement, carte « établissement » dans la recherche.
- Pro : `/pro/app/parametres/structure` (sites, praticiens, équipe), tableau de bord `/pro/app/statistiques` avec filtres site/praticien, sélecteur de site dans l'en-tête de l'agenda.

## Critères d'acceptation
- [ ] Une clinique avec 2 sites et 12 praticiens est administrée par un seul compte admin ; chaque praticien voit son agenda, la secrétaire du site A ne voit pas le site B (sauf droit explicite).
- [ ] La page établissement liste les praticiens vérifiés uniquement et se rend en SSR.
- [ ] Le tableau de bord reproduit les chiffres d'une requête SQL de contrôle (test).

## Tickets
ORG-01 types de structure, sites multiples, rattachement · ORG-02 page publique établissement + résultat recherche · ORG-03 administration centrale (praticiens sans compte, invitations) · ORG-04 secrétariat multi-agendas (vue jour multi-colonnes) · ORG-05 tableau de bord + export · ORG-06 ressources (V2) · ORG-07 tests.
