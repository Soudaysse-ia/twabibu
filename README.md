# Twabibu

**La plateforme de santé des Comores** — le Doctolib de l'Union des Comores, sans téléconsultation, étendu au dossier médical, à l'ordonnance numérique et aux pharmacies (gardes, catalogue, commandes, livraison). Site web (ordinateur et téléphone) d'abord, puis applications Android et iOS.

*À vos côtés, dans chaque temps de soin.*

> *Twabibu* signifie « médecin » en shikomori.

## État du projet
Conception terminée le 11/11/2026. **Phase 0 (fondations) livrée le 12/11/2026** : monorepo, CI, schéma de données complet et migrations, API de base, moteur de créneaux testé, design system, page d'accueil responsive. Bilan et écarts : [docs/05-roadmap/journal-phase-0.md](docs/05-roadmap/journal-phase-0.md). **Phase 1, premier lot livré le 12/11/2026** : un patient peut chercher un soignant, voir ses créneaux, se connecter par code, réserver pour lui ou un proche et annuler ([journal](docs/05-roadmap/journal-phase-1.md)). En local, le code est `000000`. **Deuxième lot** : espace soignant Twabibu Pro (agenda jour/semaine, rendez-vous pris par le cabinet, statuts, motifs, plages en ligne, absences), sur `/pro/connexion` avec les comptes de démonstration `amina.said@demo.twabibu.km` (praticienne) et `secretariat@demo.twabibu.km` (secrétaire). **Troisième lot (13/11/2026)** : dossier médical (synthèse, allergies, antécédents, traitements, constantes, consultation chiffrée, consentement et journal des accès), ordonnance numérique signée avec alertes par règles, impression avec QR code et page publique de vérification. **Quatrième lot (13/11/2026)** : pharmacies — gardes par île sans compte, annuaire, fiche et catalogue, comparateur de prix par médicament, commande avec retrait ou livraison, envoi d’une ordonnance à une pharmacie avec réponse et dispensation, et l’espace Twabibu Pharma (`/pharma/connexion`, compte de démo `titulaire.port@demo.twabibu.km`). **Cinquième lot (13/11/2026)** : back-office (`apps/admin`, port 3200) avec double authentification — vérification des soignants et des pharmacies, suspension de structures, calendrier officiel des gardes, emplacements « Partenaire », support patients sans donnée médicale, journal des notifications et d’audit, options. **Sixième lot (16/11/2026)** : rappels de rendez-vous la veille (ou deux, trois jours avant) à l’heure choisie par le cabinet, jamais la nuit, avec bouton « Je confirme ma présence » et réglage du patient. **Septième lot (16/11/2026)** : référentiels dans le back-office (spécialités, localités, jours fériés, médicaments), visibles sur le site en moins d’une minute. **Huitième lot (17/11/2026)** : espace du praticien complété — accueil (journée, prochain patient, demandes à valider, patients récents), liste de ses patients, rendez-vous dans la fiche patient, dossiers médicaux fictifs de démonstration. **Connexion et création de compte par e-mail** au lieu du téléphone, le SMS ne restant qu’en secours (ADR-016, [comparatif des coûts](docs/07-references/comparatif-email-sms.md)).

## Lire dans cet ordre
1. [docs/00-PLAN-COMPLET.md](docs/00-PLAN-COMPLET.md) — synthèse du plan.
2. [CLAUDE.md](CLAUDE.md) — règles et méthode pour les modèles Claude (et les humains).
3. [docs/01-produit/](docs/01-produit/) — vision et périmètre, écosystème de soins (patient · médecin · pharmacie), analyse Doctolib, matrice fonctionnelle, personas, modèle économique.
4. [docs/02-design/](docs/02-design/) — direction artistique, `design-tokens.json`, composants, pages et écrans.
5. [docs/03-architecture/](docs/03-architecture/) — architecture technique, modèle de données, API, sécurité, infrastructure, ADR.
6. [docs/04-specs/](docs/04-specs/README.md) — SPEC-01 à SPEC-15.
7. [docs/05-roadmap/](docs/05-roadmap/) — roadmap, backlog par epics.
8. [docs/06-mobile/strategie-mobile.md](docs/06-mobile/strategie-mobile.md) — Android / iOS.
9. [docs/07-references/](docs/07-references/) — contexte Comores, captures Doctolib, sources.

## Périmètre en une phrase
Recherche de soignants, profils vérifiés, réservation en ligne avec confirmation par e-mail, compte patient avec proches, carnet de santé et documents, agenda professionnel complet avec secrétariat et rôles, **dossier médical complet** (antécédents, allergies, traitements, constantes, consultations), **ordonnance numérique** envoyée à la pharmacie, **pharmacies de garde, catalogue, commandes et livraison**, établissements multi-sites, back-office — **pas de vidéo, pas d'IA, pas de vente de médicaments par Twabibu**.

## Démarrer le développement
Prérequis : Node 24, pnpm 9, PostgreSQL 16, Redis 7.
```bash
cp .env.example .env        # puis remplacer <utilisateur> dans DATABASE_URL
createdb twabibu_prime_dev
pnpm install
pnpm db:deploy && pnpm db:seed
pnpm build
pnpm --filter @twabibu/api start   # http://localhost:4000/v1/docs
pnpm --filter @twabibu/web dev     # http://localhost:3100
```
Vérifications : `pnpm lint && pnpm typecheck && pnpm test`. Organisation du code : `apps/` (web, api), `packages/` (contracts, utils, tokens, i18n, availability, ui).

## Licence et marque
Projet privé. « Doctolib » est une marque de Doctolib SAS, utilisée ici uniquement comme référence d'analyse ; aucun élément propriétaire (logo, images, textes) n'est réutilisé dans Twabibu.
