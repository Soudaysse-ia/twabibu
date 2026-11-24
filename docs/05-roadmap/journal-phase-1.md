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

# Dixième lot : partage du dossier par le patient (19 novembre 2026)

Question du porteur du projet : « les cabinets et les médecins ont-ils accès aux fiches et aux antécédents de leurs patients pour suivre leur évolution ? ». Constat : oui dans un même cabinet, mais un cabinet ne voyait jamais ce qu’un autre avait noté, car le patient n’avait aucun écran pour donner son accord (l’API existait déjà, RECORD-07).

## Ce qui fonctionne
- **Page « Partage de mon dossier »** (`/mon-compte/dossier`, liens depuis « Mes rendez-vous » et « Mes ordonnances ») : une explication courte, la liste des cabinets où le patient a une fiche avec « Autoriser l’accès » ou « Retirer l’accès », et la liste « Qui a consulté mon dossier » (établissement, partie consultée, date et heure). Confirmation lue par les lecteurs d’écran (`aria-live`).
- **API** : un cabinet n’apparaît plus qu’une fois même si le patient y a plusieurs fiches.
- **Case à la réservation** (étape « Vérifiez et confirmez ») : « Autoriser [cabinet] à voir mon dossier médical complet (facultatif) », décochée par défaut, avec un lien vers « Partage de mon dossier ». Elle n’apparaît que pour un rendez-vous pris pour soi-même, et pas si le dossier est déjà partagé avec ce cabinet. Côté API, champ `shareRecord` de `POST /v1/booking/appointments` ; l’accord est enregistré avec l’origine `booking` (1 test d’intégration : sans effet pour un proche, accord créé pour soi). La liste des accords renvoie aussi l’adresse (`organizationSlug`) du cabinet.

Vérifié dans le navigateur avec un compte patient fictif créé pour l’occasion, rattaché à deux cabinets : page à 1280 px et 375 px, accès autorisé à la clinique, puis côté médecin le dossier passe à « partagé » (`shared: true`) ; la lecture du dossier par le Dr Amina Saïd apparaît dans le journal du patient. Lint, typecheck, build et tests passent.

## Écarts et limites
- Le dossier des proches (enfants, parents) ne se partage pas encore depuis cette page.
- Les textes de la page sont écrits dans le composant, comme sur les autres pages « Mon compte », et pas encore dans `packages/i18n`.

# Onzième lot : l’essentiel côté patient et la vitrine de la démo (19 novembre 2026)

Demande du porteur du projet : construire tout ce qui est essentiel à la démo, avec les fonctions principales d’un service de prise de rendez-vous, et les mettre en avant.

## Ce qui fonctionne
- **Déplacer un rendez-vous** (BOOK-08) : bouton « Déplacer le rendez-vous » dans « Mes rendez-vous », page `/mon-compte/rendez-vous/[id]/deplacer` avec les créneaux libres du même soignant et du même motif (par 2 semaines). Le créneau choisi est tenu 10 minutes, puis `POST /v1/booking/appointments/:id/reschedule` annule l’ancien (`CANCELLED_BY_PATIENT`), crée le nouveau relié par `rescheduledFromId` et envoie un seul message « déplacé ». Même délai que l’annulation en ligne. L’ancien n’est annulé qu’à la confirmation.
- **Mes soignants** (ACCOUNT-04) : `/mon-compte/soignants`, un bloc par soignant consulté ou réservé (prochain rendez-vous, dernière consultation, pour qui), avec « Prendre rendez-vous » et « Voir le profil ».
- **Vitrine de la démo** : page `/demo` (les trois espaces avec leurs comptes et un lien vers chaque fonction, trois parcours guidés, les règles de confidentialité déjà tenues) et bandeau « Version de démonstration » en haut du site. Les comptes de démo s’affichent aussi sur les pages de connexion. Tout cela n’apparaît qu’en développement ou avec `NEXT_PUBLIC_DEMO_MODE=true` au build ; sinon `/demo` répond 404.

Tests automatisés : 1 test d’intégration de déplacement (créneau tenu obligatoire, ancien annulé et relié, un seul message, créneau libéré, rendez-vous d’un autre introuvable). Vérifié dans le navigateur à 1280 px et 375 px : déplacement complet, « Mes soignants », page `/demo`, bandeau sur l’accueil.

## Défauts trouvés et corrigés pendant la réalisation
- Le rendez-vous d’un autre patient répondait « créneau expiré » au lieu de « introuvable » quand la session n’avait pas de créneau tenu : la propriété est maintenant vérifiée en premier.
- La carte « Mes rendez-vous » annonçait un délai de 24 h en dur, faux pour les motifs qui ont un autre délai.

## Écarts et limites
- On ne peut pas déplacer vers un créneau qui chevauche le rendez-vous actuel.
- Le back-office (`apps/admin`, port 3200) n’est pas relié depuis `/demo`.

# Douzième lot : filtres de recherche et carte (19 novembre 2026)

Tickets SEARCH-06 et SEARCH-07 (SPEC-01 §7 et §9).

## Ce qui fonctionne
- **Filtres** sur `/recherche` : boutons rapides « Aujourd’hui », « Sous 3 / 7 / 14 jours », « Nouveaux patients acceptés », et un panneau « Filtres » (tri par pertinence ou prochaine disponibilité, et par distance avec « Autour de moi » ; langues parlées ; moyens de paiement ; assurance acceptée). Tout est dans l’URL (`?dispo=3&langues=ar`) : partageable, restauré au rechargement, retour en page 1. « Effacer les filtres » remet tout à zéro. Sans résultat avec filtres, le message propose de retirer un filtre.
- **API** `GET /v1/search/practitioners` : paramètres `dispo`, `langues`, `paiement`, `assurance`, `nouveaux`, `tri` ; réponse avec `facets` (options proposées, calculées avant filtrage pour qu’un choix ne vide pas sa propre liste) et la position de chaque cabinet (`practice.lat`, `practice.lng`, ou celle de la localité). 1 test d’intégration.
- **Carte** (Leaflet 1.9.4, fonds OpenStreetMap) : points numérotés comme les cartes de la liste ; survoler une carte met son point en évidence, cliquer un point fait défiler jusqu’à la carte. Sur ordinateur, colonne de droite qui reste visible ; sur téléphone, bouton « Afficher la carte » (Leaflet n’est chargé qu’à ce moment). Plusieurs soignants à la même adresse (clinique) ont leurs points côte à côte au lieu d’empilés.

Vérifié dans le navigateur à 1280 px et 375 px : 6 résultats et 6 points, survol, filtre « Arabe » (2 résultats), « Sous 3 jours » ajouté à l’URL et conservé au rechargement, carte mobile à la demande, aucune erreur dans la page. Les fonds de carte n’ont pas pu être chargés dans l’environnement de vérification (accès réseau à OpenStreetMap bloqué) : seuls les points et les contrôles ont été vus.

## Écarts et limites
- Les filtres et le tri par disponibilité sont calculés en mémoire, praticien par praticien : suffisant pour la démo, à revoir (vue matérialisée DATA-02, cache AVAIL-05) quand il y aura des centaines de soignants.
- Le filtre « Type (soignant / établissement) » n’est pas fait : la recherche ne renvoie que des soignants.
- Les tuiles viennent du serveur public d’OpenStreetMap, dont la politique d’usage limite le trafic : en production, prendre un fournisseur de tuiles ou un serveur dédié.

# Treizième lot : « Mes proches », « Mon profil » et navigation du compte (19 novembre 2026)

Tickets ACCOUNT-02 et ACCOUNT-03 (SPEC-04 §Compte).

## Ce qui fonctionne
- **Navigation du compte** : une barre d’onglets commune à toutes les pages `/mon-compte/...` (rendez-vous, proches, soignants, ordonnances, commandes, partage du dossier, profil) remplace les liens éparpillés en haut de chaque page. Sur téléphone, elle défile et l’onglet actif est ramené à l’écran.
- **Mes proches** (`/mon-compte/proches`) : liste avec lien, âge, date de naissance et téléphone ; ajout, modification et retrait. Le retrait est refusé tant qu’un rendez-vous est à venir pour ce proche (message qui renvoie à « Mes rendez-vous ») ; les rendez-vous passés gardent le nom du proche (copié sur la fiche du cabinet). Téléphone facultatif, vérifié avec `packages/utils`.
- **Mon profil** (`/mon-compte/profil`) : civilité, nom, prénom, date de naissance, adresse, localité (par île), assurance ; l’adresse e-mail est affichée sans être modifiable. Un changement de nom ou de date de naissance affiche un avertissement et est inscrit au journal d’audit (avant / après, rien d’autre). Le réglage des rappels est déplacé ici ; le lien des e-mails de rappel pointe désormais vers `/mon-compte/profil#rappels`.
- **Appareils connectés** : liste des sessions actives (« Chrome sur Android », date de connexion, « Cet appareil »), « Déconnecter » un appareil ou tous les autres.
- **API** : `PATCH` et `DELETE /v1/me/relatives/:id`, `GET` et `PUT /v1/me/profile`, `GET /v1/me/sessions`, `DELETE /v1/me/sessions/:id`, `POST /v1/me/sessions/revoke-others`. Un proche ou une session d’un autre compte répond 404.

Tests automatisés : 2 tests d’intégration (proches : modification, téléphone invalide, 404 pour un autre compte, retrait bloqué puis permis après annulation, nom conservé dans l’historique ; profil : journal d’audit seulement si le nom change, localité inconnue refusée, sessions listées, 404 pour un autre compte, appareil déconnecté refusé ensuite). Vérifié dans le navigateur à 1280 px et 375 px : ajout, modification, téléphone invalide, retrait, enregistrement du profil, onglet actif visible, pas de défilement horizontal.

## Écarts et limites
- Pas encore de changement d’adresse e-mail (il faudra un code envoyé à la nouvelle adresse), ni d’ajout de téléphone au compte, ni de suppression de compte et d’export des données (ACCOUNT-05).
- Le partage du dossier d’un proche n’est pas encore proposé.

# Quatorzième lot : inscription des soignants et page « Vous êtes soignant ? » (19 novembre 2026)

Tickets PRO-01 et WEB-03 (SPEC-07 §Inscription).

## Ce qui fonctionne
- **Page `/pro`** (« Vous êtes soignant ? » dans l’en-tête) : ce que fait Twabibu Pro, les trois étapes (inscription, vérification, mise en ligne), les offres, les questions fréquentes (sans téléconsultation, qui voit le dossier) et deux appels à « Inscrire mon cabinet ».
- **Inscription `/pro/inscription`** en trois étapes : adresse e-mail professionnelle, code reçu par e-mail, puis le cabinet (soignant en cabinet ou établissement, spécialité, titre, prénom, nom, numéro d’autorisation d’exercer, téléphone du cabinet, nom du cabinet, île puis localité, adresse, conditions d’utilisation). Une adresse qui a déjà un compte est renvoyée vers la connexion. Si le code expire pendant la saisie, les informations restent.
- **API `POST /v1/auth/signup/practitioner`** : en une transaction, compte `PROFESSIONAL`, structure `PENDING`, praticien `PENDING` non publié (droit de prescrire selon la spécialité), lieu de consultation (position de la localité), membre `OWNER`, agenda par défaut et motifs de départ selon la spécialité ; e-mail de bienvenue ; ligne au journal d’audit ; session ouverte. Le jeton d’inscription ne sert qu’une fois.
- **Espace Pro** : bandeau sur toutes les pages tant que le dossier n’est pas validé, avec deux liens (« vérifiez vos motifs », « ouvrez vos plages en ligne ») vers les réglages ; bandeau différent si l’équipe demande un complément ou refuse.
- **Back-office** : le nouveau dossier arrive dans la file de vérification ; la validation publie le profil et passe la structure en « active ».
- La page de connexion Pro propose « Inscrire mon cabinet » ; la page `/demo` mentionne l’inscription.

Tests automatisés : 1 test d’intégration de bout en bout (téléphone refusé, jeton à usage unique, espace Pro ouvert en responsable avec agenda et motifs, profil introuvable avant validation, présent dans la file, publié et structure active après validation). Vérifié dans le navigateur à 1280 px et 375 px : page `/pro`, inscription complète d’une pédiatre à Ndzuani (conditions non cochées, téléphone invalide, puis succès), bandeau d’attente, motifs dans les réglages, pas de défilement horizontal, aucune erreur dans la page.

## Écarts et limites
- Pas de dépôt des pièces justificatives (PRO-03, il faut un stockage de fichiers) : la vérification repose sur le numéro d’autorisation et l’appel de confirmation.
- Pas d’assistant de démarrage en 6 étapes (PRO-02) : les réglages existants servent à préparer l’agenda.
- Les tarifs ne sont pas affichés : le modèle économique les donne comme hypothèses à valider avec les premiers cabinets. Pas de formulaire « demande de démo ».
- Un établissement n’inscrit pour l’instant que son premier praticien ; les autres viendront par les invitations (PRO-05).

# Quinzième lot : parcours de bout en bout (19 novembre 2026)

Ticket QA-01 (parcours de `docs/01-produit/personas-et-parcours.md`), recommandé avant les cabinets pilotes.

## Ce qui fonctionne
- **Playwright** (`apps/web/e2e`, `pnpm --filter @twabibu/web e2e`) sur les données de démo, l’un après l’autre (les parcours partagent les agendas de démo) :
  - **P1** (ordinateur et téléphone) : recherche « généraliste » à Moroni, profil de Dr Amina Saïd, motif, premier créneau, inscription par e-mail et code, rendez-vous pour un nouveau proche, rendez-vous et proche retrouvés dans « Mon compte » ;
  - **P2** : réservation à quelques jours, déplacement vers un autre horaire, puis annulation ;
  - **P3 + P6** : inscription d’une pédiatre, bandeau d’attente, validation dans le back-office (code e-mail, second facteur, contrôles), profil public, bandeau disparu ;
  - **P7** : rendez-vous de Mariama Houmadi préparé par l’API Pro, synthèse avec l’allergie aux pénicillines, amoxicilline bloquée (alerte et justification exigée), paracétamol prescrit, ordonnance signée.
- Les limites de demande de code des comptes de démo sont remises à zéro avant chaque passage (`e2e/global-setup.ts`, base locale ou CI uniquement).
- **CI** : nouveau job « Parcours de bout en bout » (Postgres et Redis, migrations, seed, API, site et back-office démarrés, Chromium) ; captures et journaux joints en cas d’échec.

Vérifié : 5 tests verts en environ 15 s, deux passages de suite sur la même base.

## Écarts et limites
- Restent à écrire : P4 (journée du secrétariat dans l’agenda), P5 (absence et rendez-vous touchés), P8 (ordonnance envoyée à une pharmacie, réponse et délivrance).
- Les parcours ne vérifient pas encore les e-mails envoyés (lisibles par `GET /v1/dev/messages`).

# Seizième lot : sécurité web et coût de l’hébergement (20 novembre 2026)

Ticket SEC-03, puis revue du choix d’hébergement avant la mise en ligne.

## Fait
- **CSRF** (`apps/api/src/common/csrf.ts`, ADR-021) : l’API refuse en 403 toute écriture envoyée par un autre site (en-tête `Origin` différent du site et du back-office, ou `Sec-Fetch-Site: cross-site` / `same-site`). Nouvelle variable `ADMIN_URL` (`.env.example`, `infra/env/*.env.example`).
- **CSP** sur le site et le back-office (`next.config.ts`), en plus des en-têtes existants (`nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) et de HSTS posé par Caddy.
- **Dépendances** : `pnpm audit --prod --audit-level high` en CI ; `effect` et `deepmerge-ts` (dépendances indirectes du CLI Prisma) forcées en version corrigée.
- **Hébergement** (`infrastructure-et-deploiement.md` §8, procédure Hetzner) : architecture inchangée, budget revu à la baisse (≈ 4 à 6 €/mois pour la démo seule, ≈ 15 à 20 €/mois avec la production), CX plutôt que CPX après les hausses Hetzner de 2026, OVHcloud VPS-1 / VPS-2 en repli si Hetzner n’a pas de serveur disponible.

Vérifié : 95 tests de l’API (dont 5 sur la décision CSRF et 1 de bout en bout), parcours Playwright P1, P2, P3 + P6, P7 sur ordinateur et téléphone avec la CSP active, aucune violation de CSP sur l’accueil, la recherche avec carte, un profil, la réservation, les pharmacies, l’espace Pro, la documentation de l’API et la connexion au back-office ; écriture refusée à travers le proxy du site avec une origine étrangère.

## Écarts et limites
- La CSP garde `'unsafe-inline'` pour les scripts (amorçage de Next) : elle bloque les scripts externes et l’envoi de données vers un autre domaine, pas un script injecté dans la page ; l’échappement de React reste la protection principale contre l’injection.
- Prix d’hébergement relevés sur des sources publiques, à confirmer à la commande.


# Dix-septième lot : centre d’aide, pages légales et contact (20 novembre 2026)

Ticket WEB-02, nécessaire avant toute ouverture au public. Les pages « À propos », « Centre d’aide », CGU, « Protection des données personnelles » et « Mentions légales » affichaient « Bientôt disponible ».

## Fait
- **Centre d’aide** (`/aide`, `/aide/[article]`) : 14 articles rangés pour les patients, les soignants et les pharmacies, chacun avec un bouton vers la page concernée, les autres articles de la rubrique et un encart « Vous ne trouvez pas votre réponse ? ». Chaque libellé cité (« Déplacer le rendez-vous », « Partage de mon dossier »…) a été vérifié dans l’interface.
- **Pages légales** (`/cgu`, `/confidentialite`, `/mentions-legales`) et **« À propos »** : rédigées à partir de ce que fait vraiment le produit (données collectées, qui y accède, durées de `securite-et-donnees-sante.md`, cookies `tw_session` et `tw_bsid`, sous-traitants). Bandeau « Document provisoire » tant que LEGAL-01 n’est pas fait ; l’identité de l’éditeur est marquée « à compléter » à un seul endroit.
- **Contact** (`/contact`) : nom, e-mail, profil, message (sans donnée médicale, rappelé sous le champ), champ piège contre les robots, erreurs par champ, confirmation annoncée et focalisée. `POST /v1/contact` envoie un e-mail au support (`SUPPORT_EMAIL`) par le journal des notifications ; rien n’est renvoyé à l’expéditeur (le formulaire ne peut pas servir à écrire à un tiers) ; 5 messages par heure et par adresse IP, 3 par adresse e-mail.
- Textes dans `packages/i18n/src/content/` sous forme de blocs structurés (paragraphe, liste, étapes, encadré), rendus sans HTML : rien ne peut y injecter de balise. Lien « Nous contacter » dans le pied de page.

Vérifié : 100 tests de l’API (dont 5 sur le contact : envoi échappé au support, refus des champs invalides et d’un en-tête glissé dans le nom, robot ignoré, limites), 3 tests de contenu (identifiants uniques, liens internes, pas de sortie du statut provisoire tant qu’il reste « à compléter »), parcours Playwright aide → contact sur ordinateur et téléphone, pages légales depuis le pied de page ; captures à 375 px et 1280 px sans débordement ni erreur de console.

## Écarts et limites
- Textes juridiques à faire valider (LEGAL-01) : identité de l’éditeur, durée de conservation des notes des soignants, droit applicable.
- Les articles sont dans le code : leur gestion dans le back-office (SPEC-11 §5) reste à faire avec ADMIN-06.
- Le message de contact est visible par le support dans le journal des notifications ; l’avertissement sous le champ demande de n’y mettre aucune information médicale, sans pouvoir l’empêcher.

# Dix-huitième lot : limites de débit des routes publiques, documentation de l’API fermée en production (21 novembre 2026)

Point 3 de la revue de code et ticket API-02 (partie limitation de débit), avant la mise en ligne.

## Fait
- **Limites de débit** (`apps/api/src/common/rate-limit.ts`) : `@RateLimit(...)` + `RateLimitGuard`, compteur Redis par adresse et par minute, 429 `RATE_LIMITED` avec `Retry-After`. Résultats de recherche 60 / min, autocomplétion 120, profils, créneaux, annuaire, pharmacies et médicaments 120, vérification d’ordonnance par code 30. Si Redis tombe, les lectures publiques passent (le site reste utilisable) et un avertissement est journalisé.
- **Adresse du visiteur dans le rendu côté serveur** (`apps/web/lib/api-server.ts`) : le site transmet `X-Forwarded-For` (écrit par Caddy, qui remplace ce qu’envoie le client) ; sans cela, toutes les pages rendues par le serveur auraient compté pour une seule adresse, celle du site, et la limite aurait bloqué tout le monde.
- **Documentation interactive** `/v1/docs` servie seulement hors production (local et démo).
- Parcours de bout en bout : les compteurs sont remis à zéro avant chaque passage (`e2e/global-setup.ts`).

Vérifié : 104 tests de l’API (fenêtres de comptage, 31e vérification refusée avec `Retry-After`, autre visiteur non touché, `/v1/docs` en 404 avec `APP_ENV=production`), 8 parcours Playwright sur ordinateur et téléphone sans atteindre les limites, compteur créé à l’adresse du visiteur lors d’une recherche rendue par le serveur.

## Écarts et limites
- Pas encore de limite par compte sur les routes authentifiées (espace patient, Pro, Pharma), ni de cache des résultats de recherche.
- Plusieurs personnes derrière la même adresse (cybercafé, réseau mobile partagé) partagent le compteur : les seuils sont larges pour cette raison ; à ajuster avec les journaux de production.

# Dix-neuvième lot : démo en ligne en une commande (21 novembre 2026)

But : réduire la mise en ligne de la démo à « créer un serveur et attendre ». Il ne fallait plus de domaine, de Cloudflare ni de réglage GitHub pour une première démo.

## Fait
- **`infra/scripts/demo-quickstart.sh`** : sur un Ubuntu 24.04 neuf, en root (ou par le champ « Cloud config » de Hetzner), installe le système (`server-setup.sh`), copie les fichiers de déploiement, crée `.env` une seule fois (adresse `<ip>.sslip.io` ou `DEMO_DOMAIN`, secrets tirés sur le serveur, e-mails et SMS factices, back-office fermé), puis lance `deploy.sh staging` (images publiques, migrations, données de démo). Relancé, il garde `.env` et met à jour.
- **Adresse du site lue au démarrage** (`apps/web/lib/env.ts`) : `APP_URL` du serveur l’emporte sur l’adresse figée à la construction de l’image ; la même image sert la démo sur n’importe quelle adresse (liens canoniques, QR code des ordonnances).
- **`server-setup.sh`** : ne coupe plus la connexion SSH par mot de passe si root n’a pas de clé (sinon le propriétaire se serait enfermé dehors) ; attend le verrou des paquets d’un serveur neuf au lieu d’échouer.
- Procédure : `runbooks/demo-en-ligne.md`.

Vérifié dans ce conteneur avec Docker : images construites à partir du code de la branche (les images publiées ne sont pas téléchargeables d’ici), registre local, nom `twabibu.localhost` ; 6 services en bonne santé, toutes les pages et `/api/ready` en 200 à travers Caddy en HTTPS, back-office refusé (403), documentation de l’API visible sur la démo, adresse canonique lue au démarrage ; parcours Playwright P1, P2, aide et contact verts (6 tests) ; deuxième passage sans toucher aux secrets.

## Écarts et limites
- Non vérifiable ici : `server-setup.sh` sur un vrai serveur et le certificat Let’s Encrypt pour `sslip.io` (service tiers, convient à une démo, pas à la production).
- Le déploiement automatique depuis GitHub reste à brancher (secrets et `DEPLOY_ENABLED`).

# Vingtième lot : équipe du cabinet et invitations (21 novembre 2026)

Ticket PRO-05. Le centre d’aide annonçait l’invitation en ligne « bientôt » ; jusque-là, ajouter une secrétaire passait par le support.

## Fait
- **Modèle** `Invitation` (migration `20261121090000_team_invitations`, sans écart avec le schéma) : adresse, rôle, permissions de départ, hachage du jeton, expiration à 7 jours, acceptation ou annulation.
- **API** (`apps/api/src/pro/team.*`) : liste de l’équipe et des invitations, invitation par e-mail (secrétaire avec agendas autorisés et droit aux réglages ; administrateur par le titulaire seulement), annulation, modification des droits d’une secrétaire, retrait d’un membre qui ferme toutes ses sessions ; page publique du lien et acceptation, avec un compte existant ou en créant le compte professionnel après le code e-mail, dans la même transaction que l’adhésion. Règles pures dans `team-rules.ts`. Trois codes d’erreur : `INVITATION_INVALID`, `INVITATION_EXPIRED`, `INVITATION_EMAIL_MISMATCH`. Lien limité à 30 requêtes par minute et par adresse.
- **Site** : page « Équipe » (lien « Gérer l’équipe » dans les réglages, titulaire et administrateurs), page du lien `/pro/invitation/[jeton]` (cabinet, rôle, adresse invitée, code e-mail, arrivée dans Twabibu Pro). Agendas nommés avec le praticien (« Dr Amina Saïd · Consultations »). Article d’aide « Ce que voit chaque membre de l’équipe » mis à jour.

Vérifié : 113 tests de l’API, dont 4 règles et 5 tests d’intégration (droits, accès refusé depuis un autre cabinet, agenda hors cabinet refusé, lien à usage unique, invitation expirée sans création de compte, annulation, compte existant, retrait qui coupe la session) ; 9 parcours Playwright, dont le nouveau « invitation d’une secrétaire, arrivée depuis le lien, retrait » ; captures à 375 px et 1280 px.

## Écarts et limites
- ~~Un compte membre de plusieurs cabinets n’en voit qu’un dans Twabibu Pro~~ : corrigé dans le lot suivant.
- Pas encore de journal d’activité de l’équipe à l’écran (PRO-08) ; les actions sont dans le journal d’audit.

# Vingt et unième lot : choix du cabinet dans Twabibu Pro (21 novembre 2026)

Suite de PRO-05 : un compte peut maintenant appartenir à plusieurs cabinets (titulaire du sien, invité comme administrateur dans un autre). L’espace Pro n’affichait que le premier.

## Fait
- **Sélecteur « Cabinet »** dans l’en-tête de Twabibu Pro, seulement pour les comptes membres de plusieurs cabinets. Le choix est gardé dans le cookie `tw_pro_org` (`apps/web/lib/pro-practice.ts`), qui ne donne aucun droit : l’API vérifie l’appartenance sur chaque route `/v1/pro/orgs/:orgId`. Cabinet quitté ou cookie absent : le premier cabinet.
- Après une invitation acceptée, l’espace Pro s’ouvre sur le cabinet rejoint ; la page imprimable d’une ordonnance suit le même choix.

Vérifié : 2 tests unitaires du choix, nouveau parcours Playwright (un soignant inscrit avec son cabinet rejoint celui de la démo comme administrateur, arrive dans le cabinet rejoint, revient au sien, le choix tient d’une page à l’autre), 10 parcours au total ; capture à 375 px et 1280 px sans débordement.

# Vingt-deuxième lot : pages pour les moteurs de recherche (22 novembre 2026)

Ticket SEARCH-08 (SPEC-01 §10), pour le trafic venu de Google au lancement : « pédiatre Moroni », « médecin Anjouan ».

## Fait
- **API** `GET /v1/search/sitemap` : pages « spécialité × localité » et « spécialité × île » ayant au moins un soignant vérifié et publié, avec leur nombre ; adresses des profils publics. Même règle de visibilité que la recherche, limite de débit des lectures publiques, cache 10 minutes.
- **Pages** `/{spécialité}/{lieu}` (« Médecin généraliste à Moroni ») :
  - titre, description, adresse canonique ;
  - fil d’Ariane, introduction, résultats avec carte et créneaux, lien vers la recherche filtrée ;
  - liens vers les autres spécialités du lieu et les autres lieux de la spécialité ;
  - JSON-LD `ItemList` de `Physician` et `BreadcrumbList` ;
  - une combinaison sans résultat ou une page au-delà de la dernière répond 404 ;
  - données partagées entre visiteurs et rafraîchies toutes les 10 minutes, l’adresse du visiteur restant transmise pour les limites de débit.
- **`sitemap.xml`** : pages publiques, articles d’aide, pages « spécialité × lieu », profils (date de mise à jour).
- **`robots.txt`** lu à chaque requête : fermé tant que `ALLOW_INDEXING=true` n’est pas dans le `.env` du serveur (à faire au lancement seulement, ajouté à la liste de vérification de la procédure de mise en production) ; ouvert, il exclut les espaces privés, la recherche filtrée et la page de démo, et annonce le plan du site.

Vérifié : 114 tests de l’API, dont un qui compare chaque page du plan du site au nombre de résultats de la recherche et vérifie l’absence des soignants non vérifiés ; 13 parcours Playwright, dont 3 nouveaux (page « Médecin généraliste à Moroni », passage vers « Pédiatre à Moroni », 404, plan du site, `robots.txt` fermé) ; `robots.txt` ouvert contrôlé avec `ALLOW_INDEXING=true` ; données structurées lues et valides ; captures à 375 px et 1280 px.

## Écarts et limites
- Pas encore de texte rédigé propre à chaque spécialité (conseils, questions fréquentes) : l’introduction est la même pour toutes.
- Les créneaux affichés sur ces pages peuvent dater de 10 minutes ; la réservation revérifie toujours le créneau (verrou SPEC-12).
# Vingt-troisième lot : délivrance visible et parcours P8 (22 novembre 2026)

QA-01 P8 (ordonnance → pharmacie) et la partie « dispensation » de RX-05. En écrivant le parcours, un manque est apparu : la délivrance était enregistrée à la remise en pharmacie, mais aucun écran ne la montrait, ni au patient ni au prescripteur, contrairement à SPEC-14.

## Fait
- **API** : chaque ordonnance porte ses délivrances (date, pharmacie, médicaments et quantités remis, substitution) dans la liste du patient, le document de l’ordonnance et la fiche du dossier vue par le praticien ; construites à un seul endroit (`apps/api/src/medical/dispensation-view.ts`).
- **Site** : encadré « Délivrée le … par … » sous l’ordonnance dans « Mes ordonnances » et dans la fiche patient Pro, où le statut de l’ordonnance s’affiche aussi désormais.
- **Parcours P8** (`apps/web/e2e/prescription-pharmacy.e2e.ts`) : nouvelle patiente, rendez-vous avec Dr Amina Saïd, consultation et ordonnance signée, envoi à la Pharmacie du Port, réponse ligne par ligne, commande en retrait, préparation et remise, délivrance visible de la patiente et de la praticienne.
- Test de la liste « mes patients » rendu indépendant de l’ordre des pages (les parcours ajoutent des patients à la praticienne de démo).

Vérifié : 113 tests de l’API (le test pharmacie vérifie la même délivrance dans les trois vues), 11 parcours Playwright, captures à 375 px et 1280 px côté patient et côté praticien.

## Écarts et limites
- Renouvellements d’ordonnance (plusieurs délivrances successives) : à faire avec le reste de RX-05.
- Restent les parcours P4 (journée du secrétariat) et P5 (absence et rendez-vous touchés).

# Vingt-quatrième lot : rappel au cabinet des demandes sans réponse (23 novembre 2026)

Fin d’AGENDA-07 (SPEC-05 §Règles 6) : en validation manuelle, une demande restée sans réponse laissait le patient sans nouvelles.

## Fait
- **Règle** `validationReminderDecision` (`apps/api/src/notifications/reminder-rules.ts`) : rappel quand la demande attend depuis 24 h, seulement entre 07:00 et 21:00, plus rien une fois l’heure du rendez-vous passée.
- **Envoi** (`RemindersService.runValidationReminders`, appelé par la tâche `reminder-scheduler` toutes les 15 min) : un e-mail au praticien de l’agenda, au titulaire et aux administrateurs, jamais à la secrétaire ni au patient ; lien direct vers la demande (`/pro/app/agenda?rdv=…`), aucune donnée patient. Une seule fois : le journal des notifications garde la trace, un verrou Redis empêche deux exécutions simultanées d’envoyer deux fois. Pas de changement du schéma `Appointment`.
- Article d’aide « Valider les demandes de rendez-vous » complété.

Vérifié : 116 tests de l’API, dont 1 règle (horloge simulée : avant 24 h, nuit, après l’heure du rendez-vous) et 1 test d’intégration (destinataires, deux exécutions simultanées, une seule fois, rien pour une demande déjà acceptée, pas de nom du patient dans l’e-mail).

# Vingt-cinquième lot : parcours P4 et P5, « non honoré » seulement après l’heure (23 novembre 2026)

Fin de QA-01 : les huit parcours de `personas-et-parcours.md` tournent en navigateur.

## Fait
- **P4 — journée du secrétariat** (`apps/web/e2e/practice-day.e2e.ts`) : la secrétaire affiche l’agenda de Dr Amina Saïd, retrouve Ahmed Mze par les derniers chiffres de son téléphone, crée le rendez-vous (confirmation envoyée), note son arrivée, puis marque « Non honoré » le patient de la veille.
- **P5 — absence imprévue** : la praticienne déclare une absence l’après-midi, voit les 2 rendez-vous touchés, enregistre en les annulant ; rendez-vous annulés par le cabinet, patients prévenus. Les deux parcours libèrent d’abord leurs créneaux et remettent l’agenda de démo en état à la fin.
- **Écart corrigé** en écrivant P4 : « Non honoré » pouvait être posé sur un rendez-vous à venir, alors que SPEC-05 dit « après l’heure » et que chaque non-honoré compte pour proposer le blocage du patient. L’API le refuse désormais avant l’heure (`canMarkNoShow`, `CONFLICT`) et le tiroir ne propose plus le bouton avant.

Vérifié : 115 tests de l’API (règle et cas réel : refus avant l’heure, accepté après), 16 parcours Playwright dont les 2 nouveaux, passés deux fois de suite sur la même base.

## Écarts et limites
- ~~P5 « Proposer un autre créneau »~~ : fait dans le lot suivant.

# Vingt-sixième lot : proposer un autre créneau quand le cabinet annule (23 novembre 2026)

Le dernier point de P5 : un patient dont le rendez-vous est annulé par le cabinet (absence, fermeture) devait chercher lui-même un nouvel horaire.

## Fait
- **E-mail d’annulation par le cabinet** (`appointmentCancelledByPractice`) : jusqu’à 3 prochains horaires libres en ligne, dans les 14 jours, avec le même soignant et le même motif ; chaque horaire ouvre la réservation avec ce créneau déjà choisi (`…/reserver?motif=…&creneau=…`), le bouton mène à toutes les disponibilités. Objet : « Votre rendez-vous est annulé : choisissez un autre horaire ».
- Rien n’est proposé si le soignant ou le motif n’est pas réservable en ligne ; un échec du calcul n’empêche jamais l’envoi de l’annulation. Le SMS garde un lien court vers la fiche du soignant (160 caractères).
- Calcul dans `AppointmentMessagesService` avec le moteur de disponibilités (`AvailabilityService`), donc sans créneau pendant l’absence qui vient d’être posée.

Vérifié : 116 tests de l’API (modèle d’e-mail : horaires, liens échappés, texte ; cas réel : absence qui annule deux rendez-vous, un à 3 horaires proposés, aucun dans l’absence, lien vers la réservation du même motif) ; parcours P5 complété : le lien de l’e-mail ouvre la réservation sur l’horaire choisi, tenu pour le patient ; 16 parcours Playwright ; capture de l’e-mail à 375 px.

# Vingt-septième lot : signaler un profil, file du back-office (23 novembre 2026)

PROFILE-06 et ADMIN-07 : un visiteur qui trouve une information fausse (cabinet fermé, mauvais numéro) ou un faux soignant n’avait aucun moyen de le dire.

## Fait
- **Site** : lien « Signaler un problème avec ce profil » sur chaque fiche, page `/{spécialité}/{lieu}/{soignant}/signaler` : motif (5 choix), précisions facultatives (1 000 caractères, rappel « aucune information médicale », « le soignant ne saura pas qui a fait le signalement »), champ piège, confirmation annoncée.
- **API** `POST /v1/practitioners/{slug}/reports` : profils publics seulement, 5 par minute et par adresse, auteur gardé seulement s’il est connecté ; modèle `Report` déjà présent, sans migration.
- **Back-office** « Signalements » (vérification, support, super-admin) : file « À traiter / Traités », nombre de signalements ouverts sur le même profil, lien vers le profil public ; « Ignorer », « Écrire au soignant » (e-mail avec le motif seulement), « Retirer le profil du site » (confirmation, clôt les autres signalements du profil). Chaque décision va au journal d’audit.

Vérifié : 119 tests de l’API (règles ; validation, piège, limite de débit, auteur ; droits par rôle ; e-mail au soignant sans l’auteur ni les précisions ; dépublication, profil plus signalable, décision impossible sur un signalement clos, journal d’audit) ; parcours Playwright « un visiteur signale, l’équipe ignore » ; captures du formulaire à 375 px et de la file à 1280 px.

# Vingt-huitième lot : le praticien écrit son profil public (24 novembre 2026)

PRO-07, sans les photos. Jusqu’ici, la présentation, les langues ou les moyens de paiement d’un soignant ne pouvaient venir que du jeu de démonstration : un praticien inscrit en ligne avait une page publique vide qu’il ne pouvait pas compléter.

## Fait
- **API** : `GET /v1/pro/orgs/{orgId}/profiles` et `PUT …/profiles/{practitionerId}`. Droits (`canEditProfile`) : le praticien pour lui-même, titulaire et administrateurs pour tous les praticiens du cabinet, jamais la secrétaire ; un praticien d’un autre cabinet est introuvable. Langues et assurances vérifiées contre les référentiels ; texte nettoyé (espaces, doublons d’expertise, présentation vide) dans `apps/api/src/pro/profile-rules.ts` ; nom, spécialité et numéro d’autorisation jamais écrits. Un enregistrement qui ne change rien n’écrit rien ; sinon une ligne de journal avec les noms des champs modifiés.
- **Twabibu Pro** : page « Profil public » (lien « Modifier le profil public » dans les réglages, sauf pour le secrétariat) : informations vérifiées en lecture seule avec un lien vers le contact, présentation avec compteur, expertises en étiquettes, cases pour les langues, paiements et assurances, diplômes en lignes, lien vers les tarifs des motifs et vers la page publique si elle est en ligne. Textes dans `packages/i18n` (`fr.profileEdit`).
- **Page publique** : nouvelle rubrique « Formations » ; les expertises s’affichent même sans présentation.
- **Paiement** : un soignant qui s’inscrit affiche « Espèces » par défaut (au cabinet, les patients paient presque toujours en liquide) ; il ajoute MVola ou Huri Money s’il les accepte. Twabibu n’encaisse rien, la page le dit ; le paiement en ligne reste pour plus tard (PAY, phase 5).

Vérifié : 120 tests de l’API, dont 6 nouveaux (`apps/api/src/profile.test.ts` : règles, droits de chaque rôle, autre cabinet, choix inconnus, diplôme futur, enregistrement visible aussitôt sur le profil public, journal) ; 15 parcours Playwright, dont un nouveau (`apps/web/e2e/pro-profile.e2e.ts` : la praticienne ajoute une expertise et un diplôme, les voit sur sa page, puis les retire) ; captures à 375 px et 1280 px.

## Écarts et limites
- Pas de photo du soignant ni du cabinet : il faut d’abord le stockage chiffré des fichiers (même besoin que le dépôt des pièces justificatives, PRO-03).
- Pas de rubrique « Expérience » (le champ existe en base, rien ne l’affiche encore).
- Les champs de saisie de Twabibu Pro hors de cette page restent en 14 px sur mobile ; ceux de cette page passent à 16 px comme le demande la charte.

# Vingt-neuvième lot : la fiche du cabinet (24 novembre 2026)

PRO-06, pour la première version : un soignant inscrit en ligne ne pouvait corriger ni son adresse, ni son téléphone, ni ses horaires, et son repère restait au centre de sa ville.

## Fait
- **API** : `GET /v1/pro/orgs/{orgId}/practices` et `PUT …/practices/{practiceId}`. Toute l’équipe lit, le titulaire et l’administration modifient ; le lieu d’un autre cabinet est introuvable. Téléphone normalisé (+269), localité vérifiée, position bornée aux trois îles (sans repère : centre de la localité), horaires contrôlés et triés (`apps/api/src/pro/practice-rules.ts`), accès vide écarté. Un enregistrement qui ne change rien n’écrit rien au journal ; sinon `practice.update` avec les noms des champs.
- **Twabibu Pro** : page « Cabinet et horaires » (lien dans les réglages pour toute l’équipe, en lecture seule pour le secrétariat et les praticiens). Carte OpenStreetMap avec un repère à faire glisser ou à poser en touchant la carte, bouton « Je suis au cabinet : utiliser ma position », retour au centre de la localité ; horaires en listes au quart d’heure, écrits en 24 h même sur un téléphone réglé en anglais (un champ « heure » du navigateur y affichait « 02:30 PM », tronqué) ; « Copier le lundi du mardi au vendredi ».
- **Page publique** : l’accès montre aussi l’ascenseur, le stationnement et les précisions pour venir.

Vérifié : 125 tests de l’API, dont 5 nouveaux (`apps/api/src/practice.test.ts` : règles des horaires et de l’accès, droits de chaque rôle, autre cabinet, téléphone, chevauchement, repère hors des Comores, localité inconnue, enregistrement visible sur le profil public, repère placé à la main gardé, journal sans doublon) ; 16 parcours Playwright, dont un nouveau (`apps/web/e2e/pro-practice.e2e.ts` : la direction précise l’accès, la page publique le montre, la secrétaire voit la fiche sans pouvoir la modifier) ; captures à 375 px et 1280 px.

## Écarts et limites
- Pas d’ajout ni de suppression de lieu : un deuxième lieu demande aussi un agenda et le rattachement des praticiens, à faire avec les établissements (SPEC-10).
- Pas de logo ni de photos du cabinet (stockage de fichiers à mettre en place).

# Trentième lot : « Votre cabinet est prêt à X % » (24 novembre 2026)

PRO-02, pour la première version : un soignant inscrit en ligne arrivait sur un accueil vide sans savoir quoi régler avant que les patients puissent réserver.

## Fait
- **API** : `GET /v1/pro/orgs/{orgId}/setup` calcule six étapes (vérification, adresse et repère, horaires d’ouverture, motifs et tarifs, plages en ligne, présentation) à partir des réglages, sans aucune donnée de patient. Règles pures dans `apps/api/src/pro/setup-rules.ts` : l’adresse et les horaires ne comptent que pour qui gère le cabinet ; pour la direction sans agenda, une étape des praticiens n’est faite que si elle l’est pour tous ; un repère resté au centre de la localité (là où l’inscription le pose) n’est pas « placé » ; un motif réservable en ligne sans tarif laisse l’étape « motifs » à faire.
- **Twabibu Pro** : carte en tête de l’accueil, barre d’avancement accessible (`progressbar`), étapes cochées, « En cours » pour la vérification, lien « Compléter » vers chaque réglage. Absente pour le secrétariat, elle disparaît à 100 % ; les comptes de démonstration sont à 100 %.

Vérifié : 138 tests de l’API, dont 4 nouveaux (`apps/api/src/setup.test.ts` : règles, compte juste après l’inscription à 0 % et en attente de vérification, collègue sans étapes du cabinet, secrétaire sans carte, 100 % une fois tout réglé) ; 19 parcours Playwright, P3 complété (0 % à l’arrivée, lien vers les horaires, 17 % après avoir ouvert le lundi) ; captures à 375 px et 1280 px.

## Écarts et limites
- Pas d’assistant pas à pas en plein écran : la carte renvoie vers les pages de réglages existantes.
- Pas d’étape « pièces justificatives » tant que leur dépôt (PRO-03) n’existe pas.

# Trente et unième lot : vrais SMS, Twilio ou Infobip (24 novembre 2026)

NOTIF-02, partie SMS. Les SMS ne servent qu’aux patients inscrits par le cabinet sans adresse e-mail (ADR-016), mais jusqu’ici aucun ne pouvait partir : seul le fournisseur factice existait, et l’API refusait de démarrer avec un autre réglage.

## Fait
- **Fournisseurs** `TwilioSmsProvider` et `InfobipSmsProvider` (`apps/api/src/notifications/sms-provider.ts`), choisis par `SMS_PROVIDER`. Délai maximal de 10 s par envoi (la file BullMQ refait jusqu’à 3 tentatives) ; un message refusé par Infobip à l’intérieur d’une réponse 200 compte comme un échec ; toute suite de chiffres est masquée dans les erreurs gardées au journal et en base, car le fournisseur peut y citer le numéro.
- **Réglages** `SMS_API_KEY`, `SMS_ACCOUNT_SID` (Twilio), `SMS_BASE_URL` (Infobip), `SMS_FROM`, vérifiés au démarrage : réglage manquant, identifiant Twilio mal formé ou adresse Infobip hors de `*.api.infobip.com` arrêtent l’API avec un message clair. La valeur `local`, jamais implémentée, est retirée.
- **Boîte de messages de développement** (`/v1/dev/messages`) fermée dès qu’un vrai fournisseur d’e-mail ou de SMS est réglé : elle montrerait le texte de vrais messages.
- **Procédure** : paragraphe « SMS » dans `runbooks/mise-en-production-hetzner.md`, exemples `.env.example` et `infra/env/production.env.example`.

Vérifié : 11 tests (réglages de chaque fournisseur, choix du fournisseur, requête Twilio et Infobip exacte, refus dans une réponse 200, erreurs sans numéro), réseau remplacé par une doublure : aucun SMS réel envoyé. Tests de l’API complets.

## Écarts et limites
- Aucun compte fournisseur n’est encore ouvert : à choisir (Twilio ou Infobip), à tester sur les deux opérateurs comoriens, et à vérifier si l’expéditeur « Twabibu » est accepté.
- Pas d’accusés de réception (webhooks) ni de bascule SMS → e-mail.

# Trente-troisième lot : la journée sur papier (24 novembre 2026)

AGENDA-09, impression. Beaucoup de cabinets travaillent avec une liste papier à l’accueil, et la connexion peut tomber dans la journée : la liste imprimée le matin reste lisible.

## Fait
- **Bouton « Imprimer la journée »** dans l’agenda : il ouvre `/pro/agenda/imprimer` pour le jour affiché et les agendas cochés (tous si aucun).
- **Feuille** : nom du cabinet, date, puis un tableau par agenda (heure de début et de fin, patient en NOM Prénom avec date de naissance pour distinguer les homonymes, téléphone, motif, statut, case « Arrivé » à cocher au stylo), absences du jour, mention « Document confidentiel… à détruire en fin de journée », date d’impression. Aucune note interne, aucun message du patient, rien de médical. Les agendas montrés sont ceux que l’API autorise, comme à l’écran (une secrétaire limitée à certains agendas ne voit que ceux-là).
- **Mise en page papier** : l’en-tête du tableau se répète sur chaque page, une ligne n’est jamais coupée, un titre d’agenda ne reste pas seul en bas de page ; page blanche à l’impression (aussi pour les ordonnances).

Vérifié : parcours P4 complété (la secrétaire imprime la journée où elle vient de prendre le rendez-vous : la ligne « MZE Ahmed », 12:35, statut « Arrivé » et la mention de confidentialité sont présents) ; rendu PDF A4 contrôlé sur une journée de 15 rendez-vous répartis sur 6 agendas (2 pages) ; captures à 375 px et 1280 px ; tests et parcours complets.

## Écarts et limites
- Pas d’export (tableur, agenda du téléphone) ni de choix des colonnes.

