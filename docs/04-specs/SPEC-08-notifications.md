# SPEC-08 — Notifications (SMS, e-mail, WhatsApp, push)

## Objectif
Confirmer, rappeler, prévenir — automatiquement, au bon moment, par le canal que le patient utilise, sans jamais divulguer de donnée médicale.

## Canaux et priorité

> **Mise à jour du 13/11/2026 (ADR-016)** : l’**e-mail** devient le canal par défaut (codes de connexion, confirmation, changement, annulation) ; le **SMS** n’est utilisé que pour un patient inscrit par le cabinet sans adresse e-mail. Fournisseur : Brevo au démarrage, Amazon SES à grand volume.

1. **SMS** (MVP) : canal par défaut pour les patients ; expéditeur « Twabibu » (alphanumérique si l'opérateur l'accepte, sinon numéro court/long).
2. **E-mail** (MVP) : si renseigné ; contient le .ics et un lien vers le compte.
3. **WhatsApp Business** (V2) : modèles approuvés, moins coûteux ; bascule automatique si le numéro a WhatsApp et l'a accepté.
4. **Push** (apps) : en plus, jamais seul pour les rappels.
5. **Cabinet** : notifications dans l'app (cloche), e-mail récapitulatif quotidien (07:00), SMS optionnel pour les annulations tardives.

## Événements et modèles (patient)
| Événement | Quand | SMS (≤ 160 car., sans accents si GSM-7 requis) |
|---|---|---|
| `otp` | à la demande | « Twabibu : votre code est 482 193. Valable 5 min. Ne le partagez pas. » |
| `appointment.booked` | immédiat | « Twabibu : RDV confirme jeu. 13 nov. a 10:20 avec Dr Said, Moroni (Rue de la Corniche). Gerer : twabibu.km/r/AB12CD » |
| `appointment.pending` | immédiat (validation manuelle) | « Twabibu : demande de RDV envoyee au Dr Said pour le 13 nov. 10:20. Vous recevrez une confirmation. » |
| `appointment.validated` / `appointment.refused` | à l'action du cabinet | |
| `appointment.reminder` | J-1 à 17:00 heure locale (défaut ; J-2 et heure paramétrables) | « Twabibu : rappel RDV demain ven. 14 nov. 10:20, Dr Said, Moroni. Pour annuler : twabibu.km/r/AB12CD » ; variante avec « Repondez OUI pour confirmer » si `askConfirmation` |
| `appointment.rescheduled` | immédiat | « Twabibu : votre RDV avec Dr Said est deplace au lun. 17 nov. 09:00. » |
| `appointment.cancelled_by_practice` | immédiat | « Twabibu : le Dr Said a du annuler votre RDV du 13 nov. Reprendre RDV : twabibu.km/r/AB12CD » |
| `appointment.cancelled_by_patient` | immédiat | confirmation d'annulation |
| `waitlist.slot_available` | à la libération | « Twabibu : un creneau plus tot est disponible chez Dr Said : jeu. 13 nov. 08:40. Reserver : lien (valable 30 min) » |
| `document.shared` | à l'envoi | « Twabibu : Dr Said vous a envoye un document. Consultez-le dans votre compte. » (jamais le document) |
| `account.*` | sécurité | nouveau mot de passe, nouvelle connexion (e-mail) |

Liens courts `twabibu.km/r/{code}` → page publique sécurisée du RDV (annuler/déplacer après OTP si non connecté).

## Règles
1. Toute notification est **asynchrone** (BullMQ) avec 3 tentatives (1 min, 5 min, 30 min) et bascule de canal (SMS échoué → e-mail si disponible). Statut suivi via webhooks (DLR).
2. **Fenêtre d'envoi** : rappels et notifications non urgentes entre 07:00 et 21:00 heure des Comores ; les autres sont différées. Confirmations et OTP : immédiats.
3. **Dédoublonnage** : une seule notification par (événement, RDV, canal) ; déplacement multiple en 5 min → un seul SMS final.
4. **Préférences** : le patient peut désactiver les rappels (pas les confirmations) ; `STOP` par SMS désactive tout sauf OTP.
5. **Quota cabinet** : `smsQuotaMonthly` selon l'offre ; dépassement → alerte au cabinet et facturation du surplus (V1) ; jamais de blocage des OTP.
6. **Contenu** : date en français abrégé, heure 24 h, nom du soignant, localité, lien ; pas de motif, pas de donnée de santé. Longueur ≤ 160 caractères (GSM-7) sinon 2 segments acceptés mais surveillés.
7. **Journal** : chaque envoi crée une `Notification` (statut, coût, fournisseur, id externe) visible par le cabinet (pour un RDV) et par le back-office.
8. **Fournisseurs** : interface `SmsProvider { send(to, text, opts): Promise<{ providerId }> ; parseWebhook(req) }` ; implémentations `FakeSmsProvider`, `TwilioSmsProvider`, `InfobipSmsProvider`, plus tard `ComoresTelecomSmppProvider` / `YasHttpProvider`. Choix par variable d'environnement, bascule possible par opérateur du destinataire (préfixe 3xx → opérateur A, 4xx → opérateur B).
9. **E-mails** : modèles MJML/React Email aux couleurs Twabibu, texte brut inclus, liste de désinscription pour le non-essentiel.

## Planification des rappels
Job `reminder-scheduler` toutes les 15 min : sélectionne les RDV `CONFIRMED` dont `startsAt - offset` tombe dans la fenêtre et sans rappel envoyé → file `notifications`. Les offsets viennent de `OrganizationNotificationSettings` (défaut [24 h]). Un RDV créé moins de 24 h avant reçoit uniquement la confirmation.

## Critères d'acceptation
- [ ] Les 10 modèles SMS existent en français, ≤ 160 caractères, testés unitairement avec des données réelles (noms longs → troncature propre).
- [x] Un RDV confirmé à 10:00 pour le lendemain 10:20 reçoit un rappel à 17:00 le jour même (test avec horloge simulée).
- [ ] Un SMS échoué 3 fois passe en `FAILED` et déclenche l'e-mail de repli si disponible.
- [x] Aucune notification entre 21:00 et 07:00 sauf OTP/confirmation (test). *(Appliqué aux rappels, seuls envois différés à ce jour.)*
- [x] ~~Réponse « OUI » au rappel~~ Le bouton « Je confirme ma présence » de l’e-mail de rappel met `confirmedByPatientAt` (l’e-mail est le canal principal, ADR-016 ; la réponse par SMS attend un fournisseur SMS entrant).

## Règles ajoutées pendant la réalisation (16/11/2026)
- Le délai est un nombre de jours : 24 = la veille, 48 = deux jours avant, 72 = trois jours avant, envoyé à l’heure choisie par la structure (07:00 à 20:00, défaut 17:00, heure des Comores). Réglage par la direction (`OWNER`, `ADMIN`) dans Réglages › Rappels aux patients.
- Pas de rappel pour un RDV pris après l’heure du rappel ; pas de rappel à moins d’une heure du RDV ; un rappel en retard (serveur arrêté) part au plus tôt à 07:00. Si plusieurs délais sont dus en même temps, le patient reçoit un seul rappel.
- Un rappel n’est envoyé qu’une fois par RDV, délai et horaire (table `AppointmentReminder`, clé unique) : un RDV déplacé reçoit un nouveau rappel ; la confirmation de présence est remise à zéro au déplacement.
- Lien de confirmation : jeton signé (HMAC du secret serveur, lié à l’horaire), page `/rendez-vous/{id}/confirmer` ; la confirmation se fait par un bouton (POST), jamais à l’ouverture du lien (les antivirus de messagerie ouvrent les liens). Aucun motif sur cette page.
- Un patient avec compte peut couper les rappels (« Mes rendez-vous » › Rappels) ; c’est respecté aussi pour les RDV pris par le cabinet, via sa fiche patient.

## Tickets
NOTIF-01 module + file BullMQ + modèle `Notification` · NOTIF-02 providers SMS (fake, Twilio/Infobip) + webhooks · NOTIF-03 modèles SMS/e-mail + liens courts · NOTIF-04 abonnés aux événements (booked, cancelled, rescheduled…) · NOTIF-05 planificateur de rappels + fenêtre horaire · NOTIF-06 préférences + STOP + quotas · NOTIF-07 journal admin/cabinet + renvoi · NOTIF-08 tests.
