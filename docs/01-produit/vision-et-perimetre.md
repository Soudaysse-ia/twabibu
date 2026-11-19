# Vision et périmètre — Twabibu

> **Twabibu** (du shikomori *twabibu* = « médecin », de l'arabe *ṭabīb*) est la plateforme de prise de rendez-vous médical des Comores. Elle reproduit l'expérience Doctolib France — recherche d'un soignant, réservation en ligne, agenda professionnel, dossier patient, secrétariat — adaptée au contexte comorien.

## 1. La promesse

| Pour qui | Promesse |
|---|---|
| **Patients** | Trouver un soignant à Ngazidja, Ndzuani ou Mwali, voir ses créneaux, réserver en 2 minutes sans téléphoner, recevoir des rappels SMS/WhatsApp, gérer les rendez-vous de ses proches. |
| **Soignants** (médecins, dentistes, sages-femmes, infirmiers, kinés, etc.) | Un agenda moderne qui se remplit tout seul, moins d'appels, moins de rendez-vous non honorés, une patientèle organisée, un secrétariat qui travaille dans le même outil. |
| **Établissements** (cliniques, centres de santé, hôpitaux, cabinets de groupe) | Plusieurs praticiens, plusieurs agendas, plusieurs sites, des droits différenciés, une vue d'ensemble de l'activité. |
| **Pharmacies** | Être trouvées (annuaire, pharmacies de garde), publier leur catalogue et leurs prix, recevoir les ordonnances numériques, vendre avec retrait ou livraison, louer des espaces sponsorisés. |
| **Médecins (suivi)** | Un dossier médical complet qui arrive avant le patient : antécédents, allergies, traitements, constantes, résultats, ordonnances ; une consultation écrite en deux minutes ; la dispensation confirmée par la pharmacie. |

Signature officielle (logo) : **« À vos côtés, dans chaque temps de soin. »**

## 2. Ce que Twabibu fait (périmètre V1)

Tout ce que fait Doctolib aujourd'hui pour un cabinet classique, **sauf la téléconsultation**.

1. **Annuaire et recherche** de soignants par nom, spécialité, motif, établissement, ville/île, avec carte et filtres.
2. **Profil public du soignant** : présentation, adresses, horaires, tarifs, moyens de paiement, langues parlées, formations, photos, accessibilité, FAQ.
3. **Tunnel de réservation** en ligne : motif → créneau → identification → pour qui (moi / un proche) → confirmation.
4. **Compte patient** : mes rendez-vous (à venir / passés), annuler / déplacer, mes proches, mes soignants, mes documents, mon identité, mes coordonnées, sécurité.
5. **Rappels et confirmations** par SMS, WhatsApp (phase 2) et e-mail.
6. **Espace Pro — agenda** : vues jour / semaine / mois, multi-agendas, motifs et durées, plages réservables en ligne, absences, blocages, règles de réservation, prise de RDV par le cabinet.
7. **Espace Pro — patientèle** : fiche patient, recherche, historique, notes, documents, statut (honoré / non honoré), patients bloqués.
8. **Secrétariat et rôles** : accès différenciés (praticien, secrétaire, administrateur de structure), agendas partagés, journal d'activité.
9. **Documents** : envoi d'ordonnances, comptes rendus, certificats au patient (PDF), réception de documents du patient.
10. **Établissements** : structure multi-praticiens, multi-sites, ressources partagées, pilotage.
11. **Back-office Twabibu** : vérification et activation des soignants, modération, support, abonnements, statistiques plateforme.
12. **Dossier médical complet** : antécédents, allergies, traitements, vaccinations, consultations structurées, constantes et courbes, résultats, suivi des chroniques, carnet du patient, partage avec consentement (SPEC-13).
13. **Ordonnance numérique** : référentiel médicaments, alertes allergies, PDF signé avec QR, envoi à la pharmacie, suivi de dispensation (SPEC-14).
14. **Pharmacies (Twabibu Pharma)** : annuaire, **pharmacies de garde**, catalogue et prix, réception d'ordonnances, commandes avec retrait ou livraison, espaces sponsorisés (SPEC-15).
15. **Web responsive** (ordinateur + téléphone) puis **applications Android et iOS**.

L'articulation patient → médecin → pharmacie est décrite dans `ecosysteme-soins.md`.

## 3. Hors périmètre (pour l'instant)

- **Téléconsultation / consultation vidéo / consultation à distance** — exclu explicitement.
- Intelligence artificielle (assistant de consultation, assistant téléphonique) — exclu, comme dans le dossier de référence.
- Facturation à l'assurance, comptabilité du cabinet, base d'interactions médicamenteuses complète — V2+ (le dossier médical et l'ordonnance numérique sont, eux, dans le périmètre : SPEC-13 et SPEC-14).
- Vente de médicaments par Twabibu — jamais : la transaction reste entre la pharmacie et le patient ; Twabibu met en relation, notifie et vérifie les ordonnances numériques.
- Paiement en ligne de la consultation par le patient — V2 (mobile money MVola / Huri Money), jamais obligatoire pour réserver.
- Carte Vitale / Sécurité sociale / RPPS : pas d'équivalent aux Comores. Remplacé par un **processus de vérification manuel** (diplôme, autorisation d'exercer, CNI) géré par le back-office Twabibu.

## 4. Ce qui change par rapport à la France

| Sujet | Doctolib France | Twabibu Comores |
|---|---|---|
| Identifiant patient | E-mail + mot de passe | **Numéro de téléphone (+269) + code SMS**, e-mail optionnel |
| Géographie | Villes, codes postaux, Google Maps | **3 îles → villes/localités**, carte OpenStreetMap (Leaflet), géolocalisation « autour de moi » |
| Conventionnement / secteur | Secteur 1, 2, 3 | Pas de secteur : **tarif de consultation affiché** en KMF, mutuelles/assurances prises en charge (ex. AMG, assurances privées) |
| Canal de rappel | SMS + e-mail + push | **SMS d'abord, WhatsApp en phase 2**, e-mail si renseigné, push dans les apps |
| Langues | Français | **Français (V1)**, shikomori et arabe prévus (i18n dès le départ) |
| Fuseau horaire | Europe/Paris | **Indian/Comoro (UTC+3)** |
| Devise | EUR | **KMF (franc comorien)** |
| Vérification des soignants | RPPS / Ordres | **Dossier de vérification Twabibu** (pièces justificatives) |
| Hébergement | HDS France | Hébergement chiffré, sauvegardes, **données de santé traitées avec le même niveau d'exigence** (voir sécurité) |
| Connectivité | Haut débit | **Mobile-first, pages légères**, mode dégradé pour 3G, PWA |

## 5. Objectifs mesurables (12 premiers mois)

| Indicateur | Cible |
|---|---|
| Soignants actifs (agenda ouvert à la réservation) | 150 sur les 3 îles |
| Pharmacies actives (catalogue + ordonnances) | 40 (la majorité des officines des 3 îles) |
| Ordonnances numériques émises / mois | 3 000 |
| Médecins utilisant le dossier médical à chaque consultation | 80 % des médecins équipés |
| Rendez-vous réservés en ligne / mois | 5 000 |
| Taux de rendez-vous non honorés chez les soignants équipés | −25 % |
| Temps médian pour réserver (arrivée → confirmation) | < 2 minutes |
| Score Lighthouse mobile (performance) | ≥ 85 |
| Disponibilité de la plateforme | 99,5 % |

## 6. Principes directeurs

1. **Même direction artistique que Doctolib, identité Twabibu** : clair, rassurant, sobre, cartes blanches sur fond bleu pâle, typographie Montserrat/Roboto, **bleu Twabibu `#2A6BCB`** et logo officiel (stéthoscope) partout.
2. **Mobile d'abord** : la majorité des patients comoriens arriveront par téléphone.
3. **Simple à construire par des modèles Claude** : architecture modulaire, specs par fonctionnalité, conventions écrites, tickets autonomes (voir `CLAUDE.md` et `docs/05-roadmap/backlog-epics.md`).
4. **Données de santé = données sensibles** : chiffrement, journalisation, droits minimaux, pas de donnée médicale dans les SMS.
5. **Le soignant garde le contrôle** : règles de réservation, motifs, délais, nouveaux patients, blocage des absents.
6. **Un écosystème, pas un annuaire** : le rendez-vous mène au dossier, le dossier à l'ordonnance, l'ordonnance à la pharmacie, et l'information revient au médecin. Chaque brique doit rendre la suivante plus utile.
