# Modèle économique (adapté aux Comores)

Principe Doctolib conservé : **gratuit pour les patients, payant pour les soignants et établissements.** Les tarifs ci-dessous sont des hypothèses de lancement à valider avec les premiers cabinets (ordre de grandeur, en francs comoriens).

## Offres soignants (par praticien, par mois)

| Offre | Contenu | Tarif indicatif |
|---|---|---|
| **Découverte** (gratuit 3 mois puis 0 KMF) | Profil vérifié dans l'annuaire, horaires, tarifs, bouton « Appeler le cabinet » (pas de réservation en ligne) | 0 |
| **Agenda** | Agenda complet, réservation en ligne, rappels SMS (quota inclus), patientèle, 1 compte secrétaire | 15 000 – 25 000 KMF |
| **Cabinet** | Agenda + utilisateurs illimités, documents, liste d'attente, statistiques, WhatsApp | 35 000 – 50 000 KMF |
| **Établissement** | Multi-praticiens, multi-sites, tableau de bord, support dédié | sur devis (par praticien dégressif) |

Options : pack SMS supplémentaires, installation / formation sur site, import de patientèle. Le **dossier médical et l'ordonnance numérique** sont inclus dès l'offre « Agenda » : c'est ce qui rend l'outil indispensable, donc ce qui fidélise.

## Offres pharmacies (Twabibu Pharma)

| Offre | Contenu | Tarif indicatif / mois |
|---|---|---|
| **Annuaire** (gratuit) | Profil, horaires, gardes, bouton d'appel | 0 |
| **Pharma** | Réception d'ordonnances numériques, catalogue et prix, commandes (retrait/livraison), équipe, statistiques | 25 000 – 40 000 KMF |
| **Pharmacie partenaire** (espace sponsorisé) | Mise en avant dans sa localité, encart sur la page des gardes de l'île, bannière sur ses pages produits ; inventaire limité (3 par île) | 50 000 – 150 000 KMF selon l'île et la zone |
| Commission sur commandes livrées (optionnelle, V2) | | 2 – 5 % |

## Coûts variables à surveiller
- **Messages** : depuis ADR-016, codes et notifications partent par e-mail (Brevo gratuit jusqu’à 300 par jour, puis quelques dollars par mois ; Amazon SES à 0,10 $ les 1 000 à grand volume). Le SMS, à 10 à 50 KMF l’unité, ne sert plus qu’aux patients inscrits par le cabinet sans e-mail. Comparatif chiffré : `docs/07-references/comparatif-email-sms.md`. WhatsApp reste une piste en V2.
- **Hébergement** : 20 à 80 €/mois au démarrage (voir infrastructure).
- **Support et vérification** : temps humain, à industrialiser via le back-office.

## Encaissement des abonnements
- Phase 1 : facture + virement / espèces / mobile money manuel (MVola, Huri Money) saisi dans le back-office.
- Phase 2 : paiement mobile money intégré lorsque les API marchands sont disponibles (voir contexte Comores).

## Hypothèses de volume (année 1)
150 praticiens payants × 25 000 KMF ≈ 3,75 M KMF / mois (≈ 7 600 €) + 40 pharmacies × 30 000 KMF ≈ 1,2 M KMF + 9 espaces sponsorisés × 80 000 KMF ≈ 0,7 M KMF → ≈ 5,6 M KMF / mois (≈ 11 400 €). Objectif : couvrir hébergement, SMS et deux personnes (support, relation pharmacies) à partir du mois 9.
