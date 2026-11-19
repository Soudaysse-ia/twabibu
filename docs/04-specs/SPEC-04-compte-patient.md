# SPEC-04 — Authentification et compte patient

> **Mise à jour du 13/11/2026 (ADR-016)** : l’identifiant est l’**adresse e-mail**, vérifiée par un code à 6 chiffres envoyé par e-mail. Le téléphone n’est plus demandé à l’inscription (facultatif dans le compte). Partout où cette spec dit « téléphone » ou « code SMS » pour l’inscription et la connexion, lire « e-mail » et « code par e-mail ». Case « rappels par e-mail » pré-cochée. En dev, le code est `000000` avec `FakeEmailProvider`.

## Objectif
Un compte simple, basé sur le téléphone, qui regroupe les rendez-vous du patient et de ses proches.

## Inscription (`/inscription`)
1. Formulaire : civilité (M. / Mme / autre), prénom, nom, date de naissance (≥ 0 ans ; < 16 ans → proposer « créer le compte au nom d'un parent »), téléphone (+269 fixe, 7 chiffres commençant par 3 ou 4 ; autres indicatifs autorisés pour la diaspora via sélecteur), e-mail (optionnel), mot de passe (optionnel pour les patients ; si vide, connexion par code SMS uniquement), cases : CGU + politique de confidentialité (obligatoire), rappels par SMS (pré-cochée, désactivable), informations Twabibu (décochée).
2. `POST /auth/otp/request` → écran code à 6 chiffres (OtpField), renvoi possible après 60 s, 5 essais, expiration 5 min. En dev/staging le code est `000000` avec `FakeSmsProvider`.
3. Succès → session créée, retour au `returnTo` (tunnel) ou « Mes rendez-vous ».
4. Numéro déjà utilisé → proposer la connexion.

## Connexion (`/connexion`)
- Identifiant (téléphone ou e-mail) + mot de passe, ou « Recevoir un code par SMS ». Lien « Mot de passe oublié » (par SMS ou e-mail). Protection : limitation de débit, message neutre en cas d'échec.
- Cookie de session (web) ; « Rester connecté » prolonge le refresh à 30 j (sinon session navigateur).

## Compte (`/mon-compte/...`)
- **Mes rendez-vous** : onglets À venir / Passés ; carte par RDV : date en toutes lettres, heure, soignant (photo, nom, spécialité), lieu, pour qui (badge « Pour Amina (fille) »), statut (confirmé, en attente de validation, annulé, non honoré) ; actions : Déplacer, Annuler, Itinéraire, Ajouter au calendrier, Reprendre rendez-vous (passés). Annuler : modale de confirmation avec rappel du délai ; si délai dépassé → « Le délai d'annulation en ligne est dépassé. Appelez le cabinet : +269 … ».
- **Mes proches** : liste, ajout/édition (identité, naissance, lien, téléphone), suppression (si aucun RDV à venir).
- **Mes soignants** : praticiens avec au moins un RDV passé ou à venir, bouton « Prendre rendez-vous ».
- **Mes documents** (V1) : voir SPEC-09.
- **Mon profil** : identité (modification du nom → avertissement, journalisée), adresse (localité/île), assurance.
- **Sécurité** : changer le téléphone (OTP sur l'ancien et le nouveau), e-mail (lien de vérification), mot de passe, sessions actives (appareil, date, « Déconnecter »), supprimer mon compte (confirmation par OTP, explication des conséquences).
- **Notifications** : rappels SMS, e-mail, WhatsApp (V2), push (apps) ; heure de rappel préférée (V1).

## Règles
- Un compte = un numéro de téléphone vérifié. Les proches n'ont pas de compte ; un proche peut plus tard créer son propre compte avec son numéro (fusion manuelle via support en V1).
- Les RDV passés restent 3 ans puis sont anonymisés.
- Export des données : JSON + PDF, généré en tâche de fond, lien valable 24 h (V1).

## Critères d'acceptation
- [ ] Inscription complète en moins de 60 s sur mobile avec code SMS fake.
- [ ] Un numéro invalide (ex. 2 chiffres, indicatif absent) est refusé avec message clair.
- [ ] Rate limiting OTP vérifié par test (4e demande en 15 min → 429).
- [ ] Annulation refusée après le délai ; acceptée avant ; SMS « annulé » enregistré.
- [ ] Les proches apparaissent dans le tunnel « Pour qui ? ».

## Tickets
AUTH-01 OTP (service, provider fake, limites) · AUTH-02 inscription patient + consentements · AUTH-03 connexion mot de passe/OTP + sessions + refresh · AUTH-04 mot de passe oublié · ACCOUNT-01 mes rendez-vous (liste, détail, annuler) · ACCOUNT-02 proches · ACCOUNT-03 profil et sécurité · ACCOUNT-04 mes soignants · ACCOUNT-05 export/suppression · ACCOUNT-06 tests.
