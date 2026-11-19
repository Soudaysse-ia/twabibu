# Comparatif des coûts : code et notifications par e-mail ou par SMS (13 novembre 2026)

Décision associée : ADR-016. Prix relevés le 13/11/2026 sur les pages officielles ou, à défaut, sur des comparatifs récents ; à revérifier avant signature.

## Hypothèses de volume
Par rendez-vous : 3 messages (confirmation, rappel, éventuel changement). Plus 1 code de connexion par patient et par mois en moyenne.

| Phase | Rendez-vous / mois | Messages / mois |
|---|---|---|
| Pilote (10 à 20 cabinets) | 2 000 | ≈ 7 000 |
| Lancement (150 praticiens) | 5 000 | ≈ 18 000 |
| Croissance | 30 000 | ≈ 100 000 |

## Prix unitaires
| Service | Gratuit | Payant | Remarques |
|---|---|---|---|
| **Brevo** (France, UE) | 300 e-mails / jour, sans limite de durée | Starter à partir de 9 $ / mois, sans plafond quotidien | Société française, données en UE ; logo Brevo dans le pied des e-mails sur Starter. |
| **Resend** (États-Unis) | 3 000 / mois, plafonné à 100 / jour | Pro 20 $ / mois pour 50 000, puis 0,90 $ les 1 000 | API la plus simple ; le plafond de 100 / jour bloque dès le pilote. |
| **Amazon SES** | aucun durable | 0,10 $ les 1 000 e-mails | Le moins cher à grand volume ; configuration plus lourde (compte AWS, sortie du « bac à sable », DKIM). |
| **SMS vers +269** (Twilio, Infobip, agrégateurs) | — | ≈ 0,03 à 0,20 $ par SMS | Prix variable selon la route et l’opérateur ; délivrabilité à tester. |

## Coût mensuel estimé
| Phase | Brevo | Resend | Amazon SES | SMS (≈ 0,10 $) |
|---|---|---|---|---|
| Pilote, 7 000 | 0 $ (≤ 300 / jour) | 20 $ (le gratuit plafonne à 100 / jour) | ≈ 0,70 $ | ≈ 700 $ |
| Lancement, 18 000 | ≈ 9 à 25 $ selon la tranche | 20 $ | ≈ 1,80 $ | ≈ 1 800 $ |
| Croissance, 100 000 | quelques dizaines de $ | ≈ 65 à 90 $ | ≈ 10 $ | ≈ 10 000 $ |

L’e-mail coûte de 100 à 1 000 fois moins cher que le SMS, quel que soit le fournisseur.

## Recommandation
1. **Pilote et lancement : Brevo.** Gratuit jusqu’à 300 e-mails par jour, puis quelques dollars par mois. Société européenne, ce qui simplifie la conformité pour des messages liés à la santé (même s’ils ne contiennent aucune donnée médicale).
2. **Au-delà d’environ 50 000 e-mails par mois : Amazon SES**, le moins cher. Il suffira d’ajouter un adaptateur `SesEmailProvider` à côté des deux existants.
3. **Resend** reste disponible (adaptateur écrit) si l’on préfère son interface ; il est plus cher que Brevo au démarrage à cause du plafond de 100 par jour.
4. **SMS** : réservé aux patients inscrits par le cabinet sans adresse e-mail. Chaque SMS coûte environ autant que 1 000 e-mails.

## Point d’attention
Une partie des patients comoriens n’utilise pas l’e-mail au quotidien. Le parcours en ligne exige désormais une adresse ; le secrétariat peut toujours inscrire un patient avec son seul téléphone (rappels par SMS). À suivre pendant le pilote : part des patients bloqués faute d’e-mail.

## Sources
- Resend, tarifs : https://resend.com/pricing et https://resend.com/docs/knowledge-base/what-is-resend-pricing
- Brevo, offres : https://help.brevo.com/hc/en-us/articles/208589409
- Amazon SES, tarifs : https://aws.amazon.com/ses/pricing/
- SMS vers les Comores : https://www.sent.dm/en/resources/sms-pricing/comoros-sms-pricing, https://smsbat.com/pricing/sms/comoros/, https://www.smsbox.net/en/pricing-sending-sms-km
