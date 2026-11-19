# Journal de la phase 1 — premier lot : le parcours patient (12 novembre 2026)

Objectif du lot : le jalon M1 du plan, « un patient réserve un vrai créneau et reçoit un SMS ». Il est atteint en local, avec le fournisseur SMS factice.

## Ce qui fonctionne

| Parcours | Écran | API | Vérifié par |
|---|---|---|---|
| Chercher un soignant par spécialité et lieu (île, localité, autour de moi) | `/recherche` : cartes, grille de 5 jours, pagination, état vide | `GET /v1/search/practitioners` | test d’intégration, navigateur 1280 px |
| Voir un profil | `/{specialite}/{localite}/{slug}` : adresse, itinéraire OpenStreetMap, présentation, tarifs, horaires, langues, résumé, bouton fixe sur téléphone, JSON-LD | `GET /v1/practitioners/:slug` | test, navigateur 1280 et 375 px |
| Choisir un créneau | tunnel : motif, accordéon par jour, « voir plus de dates » | `GET /v1/practitioners/:slug/availabilities` | test, navigateur |
| Tenir le créneau 10 minutes | compte à rebours visible | `POST/DELETE /v1/booking/locks` (Redis) | test de concurrence : un 2e visiteur est refusé et ne voit plus le créneau |
| Se connecter ou s’inscrire par SMS | téléphone → code → identité si nouveau numéro | `POST /v1/auth/otp/request`, `/otp/verify`, `/signup/patient`, `/logout` | tests (y compris limite de 3 codes par 15 min), navigateur |
| Réserver pour soi ou un proche | « Pour qui ? », consignes à accepter, message au cabinet | `POST /v1/booking/appointments` | test : fiche cabinet créée, verrou consommé, chevauchement refusé par la base |
| Recevoir la confirmation | écran de confirmation, ajout au calendrier (.ics) | SMS via file BullMQ, table `Notification` | test : SMS ≤ 160 caractères, sans motif médical ; navigateur |
| Retrouver et annuler ses rendez-vous | `/mon-compte/rendez-vous` : à venir, passés, annulation avec confirmation dans la page | `GET /v1/me/appointments`, `POST …/cancel` | test : un autre patient ne peut pas annuler (404), le créneau redevient libre |

Tests automatisés : 47 au total (API 12, moteur de créneaux 16, utilitaires 10, contrats 4, site 3, tokens 2).

## Choix faits pendant ce lot
- **Sessions opaques** plutôt que JWT + jeton de rafraîchissement (ADR-014).
- **Le site appelle l’API par son propre domaine** (`/api/*` relayé par Next.js) : cookies `SameSite=Lax`, pas de CORS, les pages serveur relaient le cookie de session.
- En local, le code SMS est toujours `000000` et aucun SMS ne part ; la page de saisie du code l’indique. Les textes envoyés sont lisibles sur `GET /v1/dev/sms?phone=…` (désactivé en production).

## Dette et limites connues
- **Textes de l’interface** : les nouveaux écrans ont leurs textes directement dans les composants, contrairement à la règle de `CLAUDE.md`. À extraire vers `@twabibu/i18n` avant d’ajouter le shikomori (ticket I18N-01 à créer).
- **Pas encore faits** : déplacer un rendez-vous, rappels la veille (planificateur), filtres et carte des résultats, pages SEO par spécialité et ville, questions préalables des motifs, choix du lieu quand un soignant en a plusieurs, cache des créneaux, test de bout en bout automatisé dans le navigateur (Playwright).
- **Fournisseur SMS réel** non branché : l’API refuse de démarrer avec un autre fournisseur que `fake` tant que NOTIF-02 n’est pas fait.
- Le compte de test créé pendant la vérification manuelle (numéro +269 321 98 76) reste dans la base de développement.

## Suite proposée
Lot 2 de la phase 1 : espace soignant (agenda, motifs, plages, absences, prise de RDV par le cabinet), puis dossier médical et ordonnance (RECORD-01…03, RX-01…04) et pharmacies de garde (PHARM-01/02).

---

# Deuxième lot : l’espace soignant Twabibu Pro (12 novembre 2026)

## Ce qui fonctionne

| Besoin du cabinet | Écran | API | Vérifié par |
|---|---|---|---|
| Se connecter | `/pro/connexion` (téléphone + code SMS, pas d’inscription) | `/v1/auth/*`, `GET /v1/pro/me` | test, navigateur |
| Voir l’agenda | `/pro/app/agenda` : semaine ou jour, un ou plusieurs agendas en couleur, plages en ligne en fond, absences hachurées, jours fériés, ligne de l’heure | `GET /v1/pro/orgs/:org/agenda/events` | test, navigateur 1440 px et 375 px |
| Prendre un rendez-vous au téléphone ou sur place | clic sur un horaire libre → tiroir : recherche du patient ou création rapide, motif, date, heure, SMS | `POST …/appointments` | test : double réservation refusée, surbooking réservé aux praticiens et à la direction |
| Suivre la journée | tiroir du rendez-vous : arrivé, en consultation, terminé, non honoré ; note interne ; historique avec les SMS | `PATCH …/appointments/:id`, `GET …/history` | test : transitions interdites refusées, compteur d’absences du patient |
| Déplacer ou annuler | depuis le tiroir, SMS au patient | `PATCH` (startsAt), `POST …/cancel` | test : SMS « déplacé », SMS « annulé par le cabinet » |
| Régler la réservation en ligne | `/pro/app/reglages` : ouverture, validation manuelle, délai minimum, horizon, pas, limite par patient | `PATCH …/agendas/:id` | navigateur |
| Gérer les motifs | ajout, durée, tarif, en ligne, nouveaux patients, consignes, actif | `POST/PATCH …/motives` | test : la secrétaire est refusée |
| Définir les plages en ligne | éditeur par jour de la semaine | `PUT …/availability-rules` | test : une plage ajoutée apparaît dans les créneaux publics ; chevauchement refusé |
| Poser une absence | aperçu des rendez-vous touchés, puis « annuler et prévenir » ou « garder » | `POST …/absences/preview`, `POST …/absences` | test : rendez-vous annulé et SMS envoyé |
| Retrouver un patient | `/pro/app/patients` | `GET …/patients?q=` | test |

Droits (fichier `apps/api/src/pro/permissions.ts`, 5 tests unitaires) : la direction voit et règle tout ; un praticien règle son agenda et ne voit les autres que si on le lui permet ; la secrétaire voit les agendas qui lui sont confiés, sans réglages ni surbooking sauf autorisation ; une autre structure reçoit toujours 403, un rendez-vous hors de ses agendas 404.

Comptes de démonstration (code SMS `000000`) : praticienne Dr Amina Saïd `440 00 01` (et `440 00 02` à `06` pour les autres praticiens), secrétaire `440 00 10`, responsable `440 00 20`.

Tests automatisés : 63 au total (API 24, moteur de créneaux 17, utilitaires 10, site 5, contrats 4, tokens 2).

## Défauts trouvés et corrigés pendant la vérification
- Au démarrage, l’API pouvait recevoir une requête avant d’être connectée à Redis (apparu quand les tests ont tourné en parallèle). Elle attend désormais la connexion, 5 secondes au plus.
- Dans l’agenda, une réponse lente à une ancienne requête pouvait écraser l’affichage de la semaine choisie (grille vide). Seule la dernière requête met maintenant la grille à jour.

## Écarts et limites
- **Connexion des soignants par code SMS**, comme les patients, et non par e-mail + mot de passe + double authentification comme prévu dans SPEC-07 (ADR-015).
- **Pas encore faits** : inscription en ligne d’un nouveau cabinet et vérification des pièces, invitations d’équipe, glisser-déposer dans l’agenda, écran de validation des demandes en attente, absences récurrentes, impression de la journée, fiche patient détaillée, changement de structure pour un compte rattaché à plusieurs cabinets (le premier est utilisé).
- Un rendez-vous de démonstration a été ajouté pendant la vérification manuelle (Mariama Houmadi, mercredi 18 novembre 10:15, agenda du Dr Amina Saïd).

# Troisième lot : dossier médical, ordonnance numérique et passage à l’e-mail (13 novembre 2026)

## Ce qui fonctionne
- **Dossier médical** (`/pro/app/patients/[id]`) : synthèse, allergies, antécédents, vaccins, traitements en cours, constantes, consultations. Les textes cliniques sont chiffrés (AES-256-GCM, clé `ENCRYPTION_KEY`). Chaque lecture est inscrite au journal des accès. Les secrétaires et les autres structures reçoivent 403.
- **Consentement** : un patient avec compte autorise une structure à voir tout son dossier ; sans consentement, un cabinet ne voit que ses propres entrées. Le patient peut consulter qui a lu son dossier (API `/v1/me/record/...`).
- **Consultation** (`/pro/app/consultation/[appointmentId]`, depuis l’agenda) : dossier à gauche, note structurée, constantes et ordonnance à droite ; « Terminer » enregistre la consultation et marque le rendez-vous terminé.
- **Ordonnance** : recherche dans le référentiel de démonstration, posologies guidées, alertes par règles (allergie bloquante sauf justification, doublon de principe actif, déjà en traitement, stupéfiant). La signature calcule une empreinte, attribue un code de 10 caractères et une validité de 90 jours, et ajoute les médicaments aux traitements en cours.
- **Impression** (`/pro/ordonnance/[id]`, `/mon-compte/ordonnance/[id]`) : gabarit A4 avec en-tête du praticien, QR code et empreinte ; « Enregistrer en PDF » passe par le navigateur.
- **Vérification publique** (`/o/[code]`) : authenticité, prescripteur, dates et état, sans nom du patient ni médicaments.
- **E-mail au lieu du téléphone** (ADR-016) : inscription et connexion des patients et des soignants par adresse e-mail et code à 6 chiffres. Confirmations, changements et annulations par e-mail (HTML + texte). Le SMS ne part plus que vers un patient inscrit par le cabinet sans e-mail. Adaptateurs Brevo et Resend prêts ; Brevo recommandé au démarrage ([comparatif](../07-references/comparatif-email-sms.md)).

Comptes de démonstration (code `000000`) : `amina.said@demo.twabibu.km` (praticienne ; aussi `fatima.ali@`, `ibrahim.mohamed@`, `said.omar@`, `youssouf.ahmed@`, `zainaba.abdallah@`), `secretariat@demo.twabibu.km`, `direction@demo.twabibu.km`.

Tests automatisés : 74 au total (API 36, moteur de créneaux 17, utilitaires 10, site 5, contrats 4, tokens 2). Lint, typecheck et build passent. Vérifié dans le navigateur à 1280 px : consultation avec alerte d’allergie, signature, page imprimable avec QR ; page de vérification à 1280 px et 375 px.

## Défauts trouvés et corrigés pendant la vérification
- L’alerte d’allergie ne s’affichait pas tant que la posologie était vide (la vérification refusait la ligne). Les alertes partent désormais dès l’ajout du médicament ; la posologie reste exigée à la signature.

## Écarts et limites
- Pas encore faits : modèles de consultation et d’ordonnance, courbes des constantes, documents et résultats rattachés, suivi des maladies chroniques, export PDF/JSON du dossier, écran patient du consentement et de l’historique des accès, envoi de l’ordonnance à une pharmacie, renouvellements et dispensation, import du référentiel national des médicaments.
- Le PDF de l’ordonnance est produit par l’impression du navigateur, pas par le serveur.
- Mot de passe et double authentification des soignants toujours à faire (SEC-05).
- Avant la production : compte Brevo, domaine d’envoi vérifié (SPF, DKIM, DMARC) et `EMAIL_PROVIDER=brevo`.
- Données ajoutées pendant la vérification manuelle : allergie aux pénicillines, consultation et ordonnance signée (Paracétamol) pour Mariama Houmadi.

# Quatrième lot : pharmacies et Twabibu Pharma (13 novembre 2026)

## Ce qui fonctionne
- **Pharmacies de garde** (`/pharmacies-de-garde`) : par île, aujourd’hui, demain ou 7 jours, sans compte. État « de garde jusqu’à », appel, itinéraire (OpenStreetMap), source et date de mise à jour du calendrier. Les gardes déjà terminées sont masquées.
- **Annuaire** (`/pharmacies`) et **fiche pharmacie** (`/pharmacie/[slug]`) : horaires, prochaines gardes, zones et frais de livraison, catalogue avec recherche et catégories. Les produits sur ordonnance sont visibles mais pas commandables directement ; les produits contrôlés sont « au comptoir uniquement ».
- **Page médicament** (`/medicament/[slug]`) : pharmacies qui le proposent sur l’île, prix indicatif daté, disponibilité, rappel « aucun conseil médical ».
- **Commande** : panier, retrait ou livraison selon les zones de la pharmacie, identification par e-mail dans le panier, suivi (`/mon-compte/commandes/[id]`), annulation possible avant la préparation. Un e-mail à chaque étape, sans nom de produit.
- **Ordonnance envoyée à une pharmacie** (depuis « Mes ordonnances ») : la pharmacie répond ligne par ligne (disponible, équivalent si le prescripteur l’autorise, indisponible), prix et délai ; le patient commande les produits disponibles en un clic. À la remise, la dispensation est enregistrée et visible du médecin (« délivrée en partie » ou « délivrée »).
- **Twabibu Pharma** (`/pharma/connexion`, `/pharma/app`) : tableau de bord, file des ordonnances (rafraîchie toutes les 5 s), commandes en colonnes (onglets sur téléphone) avec livreur, catalogue éditable et import CSV, gardes, profil (services, paiements, zones de livraison).
- **Partenaire** : emplacements sponsorisés datés, toujours libellés « Partenaire », jamais sur un médicament sur ordonnance.
- Séparation stricte cabinets / pharmacies (ADR-017).

Comptes de démonstration (code `000000`) : `titulaire.port@demo.twabibu.km` (titulaire, pharmacie partenaire de Moroni), `preparateur.port@demo.twabibu.km` (préparateur), `titulaire.medina@demo.twabibu.km` (Mutsamudu). Six pharmacies fictives sur les trois îles, dont une non vérifiée (Iconi).

Tests automatisés : 83 au total (API 45 dont 10 pour les pharmacies, moteur de créneaux 17, utilitaires 10, site 5, contrats 4, tokens 2). Lint, typecheck et build passent. Vérifié dans le navigateur : gardes et page médicament à 375 px, fiche pharmacie à 1280 px, commande complète avec création de compte dans le panier, parcours ordonnance → réponse → commande, Twabibu Pharma sur téléphone.

## Défauts trouvés et corrigés pendant la vérification
- La garde de la nuit précédente apparaissait encore le matin : les gardes terminées sont masquées.
- Les titres des bandeaux bleus s’affichaient en bleu foncé : les styles de base sont passés dans `@layer base` pour que les classes utilitaires l’emportent.
- Le catalogue de Twabibu Pharma était illisible sur téléphone (tableau trop large) : lignes empilées.
- Chaque rafraîchissement de la file inscrivait une lecture dans l’historique du patient : une seule ligne par 12 h et par membre.

## Écarts et limites
- Pas encore faits : carte des pharmacies, saisie et import des gardes par le back-office, proposition de correction par la pharmacie, écran Équipe, statistiques, inventaire et facturation des espaces sponsorisés, photo d’ordonnance papier, paiement mobile, application mobile.
- Les textes de Twabibu Pharma (comme ceux de Twabibu Pro) sont dans les composants ; ceux du site public sont dans `packages/i18n`.
- Le contenu des commandes n’est pas chiffré en base (même niveau que les lignes d’ordonnance).
- Données ajoutées pendant la vérification manuelle : patiente fictive `patiente.pharmacie@test.twabibu.km`, une commande en livraison et une commande issue d’ordonnance en attente (pharmacie du Port).

# Cinquième lot : back-office Twabibu (13 novembre 2026)

## Ce qui fonctionne
- **Application séparée** `apps/admin` (port 3200), bandeau bleu nuit pour ne jamais la confondre avec le site. Connexion en deux étapes : code par e-mail, puis code d’une application d’authentification (QR code à scanner à la première connexion, redemandé toutes les 12 h). Navigation limitée aux zones ouvertes par le rôle (ADR-018).
- **Tableau de bord** : soignants et pharmacies à vérifier, rendez-vous du jour, sur 7 et 30 jours avec la part prise en ligne, nouveaux patients, commandes, e-mails et SMS envoyés, échecs, signalements.
- **File de vérification** : dossiers du plus ancien au plus récent, fiche avec pièces, checklist de 4 contrôles, « Valider et publier », « Demander des compléments » ou « Refuser » avec message ; e-mail au soignant ; historique avec l’auteur.
- **Structures** : recherche, fiche (soignants, équipe, historique), suspension et réactivation avec motif.
- **Pharmacies** : validation ou retrait de la vérification ; **calendrier officiel des gardes** par île (ajout, suppression, import CSV tout ou rien) ; **emplacements « Partenaire »** (3 par île et par type, dates, prix, arrêt immédiat).
- **Support patients** : recherche par e-mail ou nom, rendez-vous sans motif, messages envoyés sans contenu, commandes, « Déconnecter partout ».
- **Notifications** : journal filtrable, renvoi des échecs (jamais d’un code de connexion). **Journal d’audit** : filtres, export CSV. **Options** de fonctionnalités.
- Création d’un administrateur en production : `pnpm --filter @twabibu/api admin:create <e-mail> <RÔLE>`.

Comptes de démonstration (codes `000000`) : `admin@demo.twabibu.km`, `verification@demo.twabibu.km`, `support@demo.twabibu.km`. Un soignant en attente : Dr Nadjma Youssouf (pédiatre, Mutsamudu).

Tests automatisés : 91 au total (API 53 dont 8 pour le back-office et le TOTP vérifié sur les vecteurs officiels de la RFC 6238). Lint, typecheck et build passent. Vérifié dans le navigateur : connexion avec QR code, tableau de bord, demande de compléments sur un dossier, gardes, partenaires, journal.

## Défauts trouvés et corrigés pendant la vérification
- L’import CSV des gardes prenait la première ligne pour un en-tête quand l’identifiant commençait par « pharmacie- » : l’en-tête est maintenant la ligne sans date. Même correction dans l’import du catalogue des pharmacies.
- La fiche d’un soignant de démonstration n’affichait pas son lieu d’exercice (lien manquant dans le jeu de données).
- Le journal attribuait au « système » les actions des comptes supprimés : il affiche désormais « compte supprimé ».
- Un test du dossier médical choisissait un médicament au hasard parmi les formes d’une même DCI : il cible désormais le dosage.

## Écarts et limites
- Pas encore faits : référentiels (spécialités, localités, jours fériés, médicaments), signalements, abonnements et factures, édition d’un profil pour le compte d’un soignant, fusion de doublons, anonymisation d’un compte patient, réinitialisation d’un second facteur perdu, visionneuse des pièces (le stockage objet n’est pas configuré en local).
- Le dossier du Dr Nadjma Youssouf est passé en « compléments demandés » pendant la vérification ; il reste dans la file.

# Sixième lot : rappels de rendez-vous (16 novembre 2026)

## Ce qui fonctionne
- **Rappel automatique** la veille à 17:00 (heure des Comores) par défaut, par e-mail ; par SMS seulement pour un patient du cabinet sans adresse e-mail. Sans motif de consultation.
- **Réglages du cabinet** (Réglages › Rappels aux patients, direction uniquement) : la veille, deux jours ou trois jours avant (cumulables), heure d’envoi de 07:00 à 20:00, demande de confirmation de présence.
- **Confirmation de présence** : bouton « Je confirme ma présence » dans l’e-mail, page publique sans compte, protégée par un jeton signé ; badge « Présence confirmée » et ligne d’historique dans l’agenda du cabinet.
- **Choix du patient** : « Mes rendez-vous » › Rappels de rendez-vous, interrupteur ; lien direct depuis chaque e-mail de rappel.
- **Fiabilité** : tâche toutes les 15 minutes ; jamais entre 21:00 et 07:00 ; un seul rappel même si deux tâches tournent en même temps ; un RDV déplacé reçoit un nouveau rappel et perd l’ancienne confirmation ; un RDV pris après l’heure du rappel n’en reçoit pas.

Tests automatisés : 100 au total (API 62, dont 4 règles de rappel avec horloge simulée, 3 tests d’intégration et 2 tests de modèles). Lint, typecheck et build passent. Vérifié dans le navigateur à 375 px : réglages du cabinet, page de confirmation (lien valide puis lien falsifié), interrupteur du patient ; à 1280 px : badge et historique dans l’agenda.

## Défauts trouvés et corrigés pendant la réalisation
- Le SMS de rappel dépassait 160 caractères avec un nom, une localité et un lien longs : la localité est retirée en premier, le lien n’est jamais coupé.
- Un patient ayant coupé ses rappels en aurait reçu pour les RDV pris par le cabinet (le compte n’est connu que par la fiche patient) : corrigé et testé.

## Écarts et limites
- Pas de confirmation par réponse « OUI » à un SMS (il faut un fournisseur SMS entrant) ; pas de STOP par SMS, ni de quotas de SMS par cabinet.
- Les rappels partent par la file BullMQ de l’API : si Redis est arrêté, ils attendent son retour (rattrapage jusqu’à une heure avant le RDV).
- Données modifiées pendant la vérification : la clinique de démonstration demande désormais la confirmation de présence ; le RDV de démonstration du mardi 17 novembre à 09:20 (Ahmed Mze) est confirmé.

# Septième lot : référentiels du back-office (16 novembre 2026)

## Ce qui fonctionne
- **Back-office › Référentiels** (rôles vérification et super administrateur), quatre onglets avec liste et formulaire :
  - **Spécialités** : nom, groupe, prescription, motifs proposés aux nouveaux soignants, désactivation.
  - **Localités** par île : nom, coordonnées (refusées hors des Comores, lien pour vérifier le point sur la carte), type, désactivation.
  - **Jours fériés** par année : ajout, confirmation ou déplacement d’une fête estimée, suppression avec confirmation. Le moteur de créneaux n’ouvre aucun créneau ces jours-là.
  - **Médicaments** : recherche, ajout, voie, noms commerciaux, code ATC, sur ordonnance / contrôlé / essentiel, retrait du référentiel.
- Les changements apparaissent sur le site en moins d’une minute (cache de 60 s au lieu d’une heure).
- Garde-fous : adresses (slugs) immuables ; pas de désactivation d’une spécialité ou d’une localité en usage ; un médicament retiré ne peut plus être prescrit ni vendu en ligne ; les indicateurs d’un médicament sont recopiés sur les produits des pharmacies ; chaque modification est au journal d’audit.
- **Le seed ne réécrit plus les référentiels** (ADR-019) : il crée seulement ce qui manque, et sème les jours fériés d’une année une seule fois.

Tests automatisés : 109 au total (API 71, dont 4 règles de référentiel et 5 tests d’intégration). Lint, typecheck et build passent. Vérifié dans le navigateur : onglets à 1280 px, ajout puis suppression d’un jour férié de test, onglet médicaments ; à 375 px, le formulaire vient à l’écran quand on touche une localité.

## Défauts trouvés et corrigés pendant la réalisation
- Le seed écrasait les référentiels à chaque exécution (production comprise) : une correction du back-office aurait été perdue au déploiement suivant.
- Un médicament désactivé restait prescriptible et ajoutable au catalogue d’une pharmacie.
- Une date impossible (31 février) provoquait une erreur interne au lieu d’un refus clair.

## Écarts et limites
- Pas encore faits : expertises, langues, assurances, articles du centre d’aide.
- Les libellés de repli de la recherche côté site viennent d’une liste statique : une spécialité ajoutée dans le back-office s’affiche par son adresse dans le titre de la page de résultats tant que la liste n’est pas mise à jour.

# Huitième lot : l’espace du praticien complété (17 novembre 2026)

Retour du porteur du projet : « le médecin ne voit rien, pas ses patients, pas de tableau de bord, pas les antécédents ». Constat : l’espace Pro ouvrait directement l’agenda, la page Patients restait vide sans recherche, et les patients de démonstration n’avaient presque aucun dossier.

## Ce qui fonctionne
- **Accueil** (`/pro/app`, premier élément du menu, page d’arrivée après connexion) : la journée du praticien avec le prochain patient mis en avant, les liens « Dossier » et « Consultation », les demandes à valider, les patients vus récemment, et quatre chiffres (aujourd’hui, 7 prochains jours, 30 derniers jours, absences). Aucune donnée médicale : le secrétariat l’utilise aussi et rien n’est inscrit au journal des accès.
- **Patients** : liste affichée d’emblée, « Mes patients » (récents d’abord) ou « Tout le cabinet » (alphabétique), recherche, dernière visite, nombre de visites, prochain rendez-vous, « Voir plus ».
- **Fiche patient** : bloc « Rendez-vous » (à venir, historique). Le secrétariat voit désormais les coordonnées et les rendez-vous au lieu d’un simple refus ; le dossier médical lui reste fermé.
- **Démonstration** : 9 patients fictifs, dont 8 avec un dossier (hypertension, diabète, asthme, goutte, AVC, suivi d’un enfant, allergies aux pénicillines, à l’ibuprofène et aux sulfamides), 12 consultations passées chiffrées comme dans l’API, constantes, vaccins, rendez-vous terminés et absences.

Tests automatisés : 112 au total (API 74, dont 3 nouveaux : aucune donnée médicale sur l’accueil, liste et recherche, vue secrétariat et isolement entre cabinets). Lint, typecheck et build passent. Vérifié dans le navigateur : accueil à 1280 px et 375 px, liste des patients, dossier d’Ahmed Mze (antécédents, traitements, constantes, consultations, rendez-vous), fiche vue par le secrétariat à 375 px.

## Défauts trouvés et corrigés
- Les fichiers de test de l’API tournaient en parallèle sur la même base et les mêmes comptes de démonstration : la limite de 3 codes par adresse faisait échouer des tests au hasard. Ils tournent maintenant l’un après l’autre (environ 6 secondes).
- Changer la recherche après « Voir plus » aurait mélangé deux pages de résultats.

## Écarts et limites
- ~~Un rendez-vous du jour déjà passé mais non clôturé reste compté « à venir »~~ Corrigé le 19/11/2026 : un rendez-vous terminé à l’horaire mais jamais clôturé n’est plus compté « à venir » ; il porte l’étiquette « À clôturer » et le chiffre du jour l’indique (« 1 à clôturer »). Un patient arrivé ou en consultation reste « en cours » même après l’heure prévue (`apps/api/src/pro/day-summary.ts`, 4 tests).
- L’accueil ne montre pas les alertes médicales (allergies) des patients du jour : elles restent dans le dossier et dans l’écran de consultation, pour ne pas mettre de données de santé sous les yeux du secrétariat.

# Neuvième lot : validation des demandes en ligne (19 novembre 2026)

Ticket AGENDA-07 (SPEC-05 §Règles 6). Avant ce lot, un cabinet en validation manuelle pouvait passer une demande en « confirmé », mais le patient n’en était pas prévenu, et un refus passait pour une annulation ordinaire.

## Ce qui fonctionne
- **Tiroir du rendez-vous** : une demande en attente affiche un encadré « Demande en ligne à valider » avec « Accepter la demande » et « Refuser ». Le refus demande un motif interne facultatif (jamais envoyé) et propose de prévenir le patient. Les boutons de statut et « Annuler le rendez-vous » sont masqués tant que la demande n’a pas de réponse.
- **Messages au patient** (e-mail, SMS de secours) : « Votre demande est acceptée » avec les détails du rendez-vous, ou « Votre demande n’a pas été acceptée » avec un lien vers la page du soignant pour choisir un autre créneau. Les deux SMS tiennent en 160 caractères GSM-7.
- **Historique** : un refus est inscrit « Demande refusée » (`REFUSED`), distinct d’une annulation.
- **Accueil** : chaque demande de « Demandes à valider » ouvre l’agenda sur ce rendez-vous (`/pro/app/agenda?rdv=<id>`).
- **Vue mois de l’agenda** (bouton « Mois ») : pour chaque jour, le nombre de rendez-vous, les demandes à valider, une barre de remplissage des plages en ligne (minutes réservées ÷ minutes ouvertes), le jour férié et les absences ; un clic ouvre la vue jour. Un seul appel à l’API (31 jours au plus). Logique dans `apps/web/lib/agenda-month.ts` (3 tests).
- **Glisser-déposer dans l’agenda** (vues jour et semaine) : un rendez-vous confirmé et à venir se déplace à la souris ou au stylet, d’un jour à l’autre en vue semaine, par pas de 5 minutes ; le bloc affiche le nouvel horaire pendant le geste. Au lâcher, un panneau montre l’ancien et le nouvel horaire et propose de prévenir le patient (coché par défaut). Un créneau occupé ou une absence affiche un message et rien n’est déplacé. Au doigt, le déplacement reste dans le tiroir du rendez-vous (le geste gênerait le défilement). Logique dans `apps/web/lib/agenda-drag.ts` (4 tests).
- **Démonstration** : le Dr Amina Saïd a désormais un rendez-vous ce matin non clôturé et deux demandes en ligne à valider (nouvelle base uniquement : `pnpm db:seed` ne recrée pas les rendez-vous d’une base existante).
- **Bouton « danger »** dans `packages/ui` : les boutons « Confirmer le refus » et « Confirmer l’annulation » (tiroir Pro et compte patient) s’affichaient en bleu, le rouge ajouté par-dessus étant écrasé par la couleur du bouton.

Tests automatisés : tous passent (1 test d’intégration ajouté : acceptation, refus, messages, historique ; 2 modèles SMS ajoutés au test de longueur). Lint, typecheck et build passent. Vérifié dans le navigateur : accueil et tiroir à 1280 px, tiroir et formulaire de refus à 375 px, e-mail « demande acceptée » envoyé (fournisseur factice).

## Écarts et limites
- Pas de rappel au cabinet quand une demande attend depuis 24 h (prévu par la spec).
- Accepter une demande dont l’heure est passée reste possible.
