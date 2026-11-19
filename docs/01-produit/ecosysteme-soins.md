# L'écosystème Twabibu : patient · médecin · pharmacie

Ce que Doctolib ne fait pas (ou pas en France) et qui fait de Twabibu **l'outil dont le médecin comorien ne peut plus se passer** : relier la consultation, l'ordonnance et la pharmacie dans une seule boucle, autour d'un dossier médical qui suit le patient.

## 1. La boucle de soin

```
 Patient                     Médecin (Twabibu Pro)                 Pharmacie (Twabibu Pharma)
 ───────                     ─────────────────────                 ──────────────────────────
 réserve un RDV      ──►     consulte, lit le dossier médical
                             (antécédents, allergies, traitements,
                              constantes, résultats)
                             rédige l'ordonnance numérique  ──►    reçoit l'ordonnance (QR / app)
 choisit sa pharmacie ◄──    (alerte allergie / interaction)       vérifie stock et prix
 (de garde, proche,                                                prépare, délivre ou livre
  moins chère)       ◄─────────────────────────────────────────    confirme la dispensation
 suit la livraison                                                 (le médecin voit que le
 ses traitements sont                                               traitement a été délivré)
 inscrits dans son carnet
```

Chaque flèche est un événement journalisé ; chaque acteur garde la main (le patient choisit sa pharmacie, le médecin valide, la pharmacie dispense).

## 2. Pourquoi le médecin ne pourra plus s'en passer
1. **Le dossier médical est là avant lui** : à l'ouverture d'un rendez-vous, antécédents, allergies, traitements en cours, dernières constantes et derniers documents apparaissent sur un seul écran (SPEC-13).
2. **La consultation s'écrit en 2 minutes** : note structurée (motif, examen, diagnostic, conduite à tenir), modèles par spécialité, constantes saisies en ligne, courbes automatiques.
3. **L'ordonnance se rédige plus vite qu'à la main** : recherche de médicament dans le référentiel (DCI, forme, dosage), posologies pré-remplies, renouvellement en un clic, alertes allergies, impression ou envoi numérique (SPEC-14).
4. **Il sait ce qui s'est passé après** : dispensation confirmée par la pharmacie, patient qui n'a pas retiré son traitement, résultats de laboratoire rattachés au dossier.
5. **Ses patients reviennent** : rappels, reprise de RDV en un clic, suivi des chroniques (diabète, hypertension) avec alertes de contrôle.
6. **Son cabinet tourne sans lui** : secrétaire, agenda, rappels, facturation simple (reçus), statistiques.

## 3. Le module Pharmacies (Twabibu Pharma)
- **Annuaire et pharmacies de garde** : chaque pharmacie a un profil (adresse, horaires, téléphone, services : livraison, carte, mobile money). Le calendrier des **gardes** par île est saisi par le syndicat/l'autorité ou par Twabibu ; la page « Pharmacies de garde ce soir » est publique, gratuite, et devient un point d'entrée fort de l'app.
- **Catalogue** : chaque pharmacie publie ses produits (lié au référentiel médicaments : DCI, nom commercial, forme, dosage, conditionnement ; prix en KMF ; disponibilité). Produits sur ordonnance vs. libre.
- **Commande** : le patient envoie son ordonnance numérique (ou une photo pour une ordonnance papier) à une pharmacie, ou commande des produits libres ; la pharmacie accepte, prépare, propose retrait ou livraison ; paiement à la livraison / au comptoir, mobile money en V2.
- **Livraison** : par la pharmacie elle-même ou un livreur partenaire (V2), suivi des statuts.
- **Monétisation** : abonnement pharmacie (profil + catalogue + ordonnances), **espace sponsorisé** (« Pharmacie partenaire » mise en avant dans les résultats et sur la page des gardes, bannière sur la fiche médicament), commission optionnelle sur les commandes livrées.
- Détail : SPEC-15.

## 4. Garde-fous
- Les médicaments sur ordonnance ne sont délivrés que contre une ordonnance valide (numérique Twabibu ou papier vérifiée par le pharmacien). Twabibu ne vend rien : la pharmacie reste responsable de la dispensation.
- Validité juridique de l'ordonnance numérique aux Comores à confirmer (ticket LEGAL-02) ; en attendant, l'ordonnance numérique est **aussi** imprimable/PDF signé avec QR code de vérification.
- Le dossier médical appartient au patient : il voit tout, décide quels praticiens y accèdent (consentement par cabinet), peut l'exporter.
- Pas d'IA, pas de conseil médical automatique : alertes basées sur des règles (allergie déclarée, doublon de DCI).

## 5. Référentiels nécessaires
- **Médicaments** : liste nationale des médicaments essentiels (LNME Comores) + référentiel international (DCI/ATC) importé en base, enrichi par les pharmacies (noms commerciaux disponibles localement). Tickets REF-01/02.
- **Pharmacies** et **calendrier des gardes** par île. **Laboratoires** (V2 : résultats numériques).
