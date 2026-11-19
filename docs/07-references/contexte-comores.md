# Contexte Comores (données utiles au produit)

À vérifier et compléter avant le lancement ; les sources sont dans `sources.md`.

## Géographie et référentiels
- **Union des Comores** : 3 îles — **Ngazidja** (Grande Comore, capitale Moroni), **Ndzuani** (Anjouan, Mutsamudu), **Mwali** (Mohéli, Fomboni). Mayotte n'est pas incluse (territoire français, Doctolib y est présent).
- Localités de départ pour le référentiel `Locality` : Ngazidja — Moroni, Iconi, Mitsamiouli, Mbéni, Foumbouni, Dembéni, Koimbani, Ntsoudjini, Itsandra, Mitsoudjé, Ouellah, Nioumadzaha ; Ndzuani — Mutsamudu, Domoni, Ouani, Sima, Mramani, Moya, Bambao, Tsémbéhou, Mirontsi, Koni-Djodjo ; Mwali — Fomboni, Nioumachoua, Wanani, Djoiezi, Hoani, Miringoni. (≈ 60 au total avec coordonnées à saisir dans le seed.)
- **Fuseau** : Indian/Comoro, UTC+3, pas de changement d'heure.
- **Devise** : franc comorien (KMF), 1 € ≈ 492 KMF (parité fixe).
- **Langues** : shikomori (variantes par île), français (administration, santé), arabe ; swahili et malgache présents.
- **Téléphone** : indicatif +269, numéros à 7 chiffres ; mobiles Comores Telecom en 3xx xx xx, Yas/Telma en 4xx xx xx (à vérifier dans le plan de numérotation en vigueur).
- **Jours fériés** : 1er janvier, Fête de l'indépendance (6 juillet), Maoulid, Aïd el-Fitr, Aïd el-Kebir, Ashura, Nouvel an musulman, Noël (25 déc.) — dates mobiles à saisir chaque année dans `Holiday`.

## Télécoms et SMS
- Deux opérateurs : **Comores Telecom** (marque Huri) et **Yas** (ex-Telma Comores, groupe Axian). Couverture 3G/4G sur les zones habitées des trois îles.
- Pas d'API SMS publique documentée par les opérateurs ; connexions SMPP/HTTP négociées commercialement. Agrégateurs internationaux (Twilio, Infobip, Sinch, D7) acheminent vers +269 ; prix observés de ≈ 0,02 à 0,21 $ par SMS selon les sources, donc **tester la délivrabilité et le coût réel avec deux fournisseurs** avant de choisir.
- L'expéditeur alphanumérique « Twabibu » n'est pas garanti sur toutes les routes : prévoir un numéro de repli.

## Mobile money et paiements
- **MVola** (Axian/Yas, présent aux Comores depuis 2019) et **Huri Money** (Comores Telecom, 2021), plus Holo (BDC). Interopérabilité nationale en cours (Komor Switch / KomorPay, 2026) ; pas d'API marchande publique au 11/11/2026 → intégration à négocier directement (V2). Le groupe Axian a obtenu une licence de banque numérique aux Comores en 2026.
- Conséquence produit : abonnements soignants encaissés manuellement au lancement (espèces, virement, mobile money saisi en back-office).

## Santé
- Système pyramidal : **CHN El-Maarouf** (Moroni) au niveau national, centres hospitaliers régionaux (**CHRI Hombo** à Anjouan, hôpital de Fomboni à Mohéli), centres de santé de district, postes de santé ; secteur privé en croissance (cliniques et cabinets à Moroni et Mutsamudu) ; cadre : code de la santé publique de 1995.
- Ressources médicales limitées (quelques centaines de médecins pour le pays) → l'annuaire doit couvrir aussi sages-femmes, infirmiers, dentistes, kinés, laboratoires, pharmacies, opticiens.
- Assurance : assurance maladie généralisée (AMG) en déploiement, assurances privées et mutuelles d'entreprise → champ « assurances acceptées » libre + référentiel.
- Vérification des soignants : s'appuyer sur le ministère de la Santé / l'Ordre des médecins des Comores pour le numéro d'autorisation d'exercer ; en attendant un référentiel officiel, vérification documentaire + appel.

## Usages numériques
- Smartphone Android majoritaire, forfaits data limités → pages légères, SMS fiable, WhatsApp très utilisé (canal V2).
- Diaspora importante (France, Mayotte, Réunion) qui prend des rendez-vous pour la famille → autoriser les indicatifs étrangers à l'inscription et la réservation pour un proche.
