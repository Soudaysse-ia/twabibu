# API REST `/v1` (NestJS)

Conventions : JSON, `camelCase`, dates ISO 8601 UTC, pagination par curseur (`?cursor=&limit=`) ou page pour le SEO, erreurs `{ code, message, details? }` avec codes de `packages/contracts/errors.ts`. OpenAPI généré automatiquement sur `/v1/docs` (en local et sur la démo ; jamais en production). Toutes les routes sont versionnées. Authentification : `Authorization: Bearer <accessToken>` (mobile) ou cookie `tw_session` httpOnly (web, `SameSite=Lax`) ; toute écriture (POST, PUT, PATCH, DELETE) dont l’en-tête `Origin` n’est ni le site ni le back-office, ou marquée `Sec-Fetch-Site: cross-site`, est refusée en 403 `FORBIDDEN` (ADR-021).

Rôles (garde `@Roles()`): `public`, `patient`, `pro:practitioner`, `pro:secretary`, `pro:admin`, `platform:admin`. Les routes Pro sont scoppées par `organizationId` (en-tête `X-Organization-Id` ou dans l'URL) et vérifiées par `MembershipGuard`.

## Auth (`/v1/auth`)
| Méthode | Route | Description |
|---|---|---|
| POST | `/otp/request` | `{ phone, purpose }` → envoie un code SMS (limite 3/15 min par numéro) |
| POST | `/otp/verify` | `{ phone, code, purpose }` → `otpToken` (5 min) |
| POST | `/signup/patient` | `{ otpToken, civility, firstName, lastName, birthDate, email?, password, consents }` → session |
| POST | `/login` | `{ identifier (phone|email), password }` → session (+ `twoFactorRequired`) |
| POST | `/login/otp` | `{ otpToken }` → session (connexion sans mot de passe) |
| POST | `/2fa/verify` | `{ challengeId, code }` |
| POST | `/refresh` | rotation du refresh token |
| POST | `/logout` | révoque la session |
| POST | `/password/forgot`, `/password/reset` | par SMS ou e-mail |
| GET | `/me` | utilisateur courant + profils + memberships |

## Annuaire et recherche (`/v1/search`, `/v1/directory`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/search/suggest?q=` | autocomplétion : `{ specialities[], practitioners[], organizations[], motives[] }` |
| GET | `/search/places?q=` | îles, localités (+ `lat,lng`) |
| GET | `/search/practitioners?q=&specialityId=&localityId=&lat=&lng=&radiusKm=&availableWithinDays=&languages[]=&newPatients=&insurance=&sort=&page=` | résultats avec `nextSlots` (5 jours × 4 créneaux) par praticien, `total`, `map[]` |
| GET | `/directory/specialities`, `/directory/localities`, `/directory/languages`, `/directory/insurances` | référentiels (cache 1 h) |

## Profils publics (`/v1/practitioners`, `/v1/organizations`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/practitioners/{slug}` | profil public complet (SSR) |
| GET | `/search/sitemap` | plan du site (SEARCH-08) : pages « spécialité × localité » et « spécialité × île » ayant au moins un soignant public (avec leur nombre), adresses des profils publics ; même règle de visibilité que la recherche ; `Cache-Control: max-age=600` |
| GET | `/practitioners/{id}/practices` | lieux |
| GET | `/practitioners/{id}/motives?practiceId=` | motifs réservables en ligne |
| GET | `/practitioners/{id}/availabilities?practiceId=&motiveId=&from=&to=` | créneaux par jour (max 14 jours par appel) |
| GET | `/practitioners/{id}/next-availability?motiveId=` | première disponibilité |
| GET | `/organizations/{slug}` | page établissement |
| POST | `/practitioners/{slug}/reports` | signaler un profil public : `{ reason: WRONG_INFO \| CLOSED \| NOT_A_PRACTITIONER \| BEHAVIOUR \| OTHER, details?, website? (piège) }` → 202 ; 5 / min par adresse |

## Réservation (`/v1/booking`) — patient
| Méthode | Route | Description |
|---|---|---|
| POST | `/booking/locks` | `{ agendaId, motiveId, startsAt }` → `{ lockId, expiresAt }` (10 min) |
| DELETE | `/booking/locks/{lockId}` | libère |
| POST | `/booking/appointments` | `{ lockId, forRelativeId?, answers, instructionsAccepted, patientMessage? }` → RDV `CONFIRMED` ou `PENDING_VALIDATION` |
| GET | `/booking/appointments/{id}/ics` | fichier calendrier |

## Compte patient (`/v1/me`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/me/appointments?scope=upcoming|past` | |
| GET | `/me/appointments/{id}` | détail |
| POST | `/me/appointments/{id}/cancel` | vérifie le délai d'annulation |
| POST | `/me/appointments/{id}/reschedule` | `{ lockId }` |
| POST | `/me/appointments/{id}/confirm` | réponse à la demande de confirmation |
| GET/POST/PATCH/DELETE | `/me/relatives` | proches |
| GET | `/me/practitioners` | soignants déjà consultés |
| GET | `/me/documents`, POST `/me/documents` (upload), GET `/me/documents/{id}/download` | |
| PATCH | `/me/profile`, `/me/contact`, `/me/password`, `/me/notifications` | |
| GET | `/me/sessions`, DELETE `/me/sessions/{id}` | |
| POST | `/me/export`, DELETE `/me` | données personnelles |
| POST | `/me/waitlist` | demande de créneau plus tôt |

## Twabibu Pro (`/v1/pro/orgs/{orgId}`)
| Méthode | Route | Description |
|---|---|---|
| POST | `/pro/signup` | création du compte pro + organisation + praticien (statut `PENDING`) |
| GET/PATCH | `/organization` | paramètres de la structure |
| GET/POST/PATCH/DELETE | `/practices` | lieux, horaires, accès |
| GET/PATCH | `/practitioners/{id}/profile` | profil public, photos, expertises, tarifs |
| POST | `/practitioners/{id}/verification/documents`, GET `/verification` | dossier de vérification |
| GET/POST/PATCH/DELETE | `/agendas` | agendas et règles de réservation |
| GET/POST/PATCH/DELETE | `/agendas/{id}/motives` | motifs |
| GET/PUT | `/agendas/{id}/availability-rules` | plages récurrentes (remplacement atomique) |
| GET/POST/PATCH/DELETE | `/agendas/{id}/absences` | + `GET /absences/preview?startsAt&endsAt` → RDV impactés |
| GET | `/agenda/events?agendaIds[]=&from=&to=` | RDV + absences + plages pour la grille |
| POST | `/appointments` | création par le cabinet (`source: PRACTICE`), `{ agendaId, motiveId, startsAt, patientRecordId | newPatient, force? }` |
| PATCH | `/appointments/{id}` | notes, motif, déplacement (`startsAt`), statut |
| POST | `/appointments/{id}/cancel` | avec notification |
| POST | `/appointments/{id}/validate` | si validation manuelle |
| GET | `/appointments/{id}/history` | événements |
| GET | `/patients?q=` | recherche patientèle (nom, téléphone) |
| GET/POST/PATCH | `/patients`, `/patients/{id}` | fiche |
| POST | `/patients/{id}/block`, `/unblock`, `/merge` | |
| POST | `/patients/import` | CSV |
| GET/POST | `/patients/{id}/notes` | notes cliniques (praticien) |
| GET/POST | `/patients/{id}/documents`, `/appointments/{id}/documents` | envoi au patient |
| GET | `/waitlist` | liste d'attente |
| GET | `/stats?from=&to=` | KPI |
| GET, PATCH, DELETE | `/members`, `/members/{id}` | équipe (titulaire et administrateurs) : liste avec invitations en attente et agendas ; PATCH = droits d’une secrétaire `{ agendaIds?, manageSettings? }` ; DELETE retire le membre et ferme toutes ses sessions (jamais le titulaire ni soi-même) |
| POST | `/members/invite` | `{ email, role: SECRETARY \| ADMIN, agendaIds?, manageSettings? }` → e-mail avec un lien de 7 jours ; seul le titulaire invite un administrateur |
| GET, PUT | `/profiles`, `/profiles/{practitionerId}` | profils publics modifiables par ce membre (le sien ; tous pour le titulaire et les administrateurs ; 403 pour une secrétaire) avec les choix proposés (langues, moyens de paiement, assurances) ; PUT `{ bio, acceptsNewPatients, expertises, languages, paymentMethods, insurances, educations[{ year, diploma, school }] }`, nom, spécialité et n° d’autorisation ignorés |
| DELETE | `/invitations/{id}` | annule une invitation en attente |
| GET | `/audit?from=&to=` | journal |
| GET/PATCH | `/notification-settings` | rappels |
| GET | `/subscription`, `/invoices` | |

## Dossier médical (`/v1/pro/orgs/{orgId}/patients/{id}/record`) — praticiens uniquement
| Méthode | Route | Description |
|---|---|---|
| GET | `/record` | synthèse (allergies, traitements, antécédents, dernières constantes, alertes) ; 403 sans consentement sauf entrées propres |
| GET/POST/PATCH | `/record/allergies`, `/record/history`, `/record/vaccinations`, `/record/treatments` | listes structurées |
| GET/POST/PATCH | `/record/consultations`, `POST /record/consultations/{id}/close` | consultation (versionnée) |
| GET/POST | `/record/vitals?type=&from=&to=` | constantes + séries pour les courbes |
| GET/POST | `/record/results` | résultats de laboratoire |
| GET/POST/PATCH | `/record/follow-ups` | suivi des chroniques |
| POST | `/record/consent-requests` | demande d'accès (SMS/app) ; `POST /record/emergency-access` avec justification |
| GET | `/record/export` | PDF/JSON |
| Patient | `GET /v1/me/record`, `GET/POST/DELETE /v1/me/record/consents`, `GET /v1/me/record/access-log`, `POST /v1/me/record/self-declared` | carnet |

## Invitations (`/v1/pro/invitations`) — lien reçu par e-mail, 30 req / min / IP
| Méthode | Route | Description |
|---|---|---|
| GET | `/{token}` | cabinet, rôle, adresse invitée, état (`PENDING`, `EXPIRED`, `ACCEPTED`, `REVOKED`) |
| POST | `/{token}/accept` | `{ signupToken? }` : connecté avec l’adresse invitée, ou jeton d’inscription du code e-mail (crée le compte professionnel et ouvre la session) ; erreurs `INVITATION_INVALID` (404), `INVITATION_EXPIRED` (410), `INVITATION_EMAIL_MISMATCH` (403) |

## Ordonnances (`/v1/pro/orgs/{orgId}/prescriptions`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/v1/directory/drugs?q=` | recherche médicaments (DCI, nom commercial) |
| POST/PATCH/DELETE | `/prescriptions` (brouillon) | lignes, posologie, alertes retournées dans la réponse |
| POST | `/prescriptions/{id}/sign` | mot de passe/2FA → `SIGNED`, PDF, QR |
| GET | `/prescriptions/{id}/pdf`, `/prescriptions/{id}/dispensations` | |
| POST | `/prescriptions/{id}/cancel`, `/prescriptions/{id}/renew-from` | |
| CRUD | `/prescription-templates` | |
| Patient | `GET /v1/me/prescriptions`, `GET /{id}/pdf`, `POST /{id}/send {pharmacyId}` | |
| Public | `GET /v1/o/{code}` | vérification QR (statut, prescripteur, date) |

## Pharmacies (`/v1/pharmacies`, `/v1/pharma/orgs/{orgId}`)
| Méthode | Route | Description |
|---|---|---|
| GET | `/v1/pharmacies?island=&localityId=&lat=&lng=&open=now&service=delivery` | annuaire |
| GET | `/v1/pharmacies/on-duty?island=&date=` | pharmacies de garde (cache 5 min, public) |
| GET | `/v1/pharmacies/{slug}`, `/v1/pharmacies/{id}/products?q=` | profil, catalogue |
| GET | `/v1/drugs/{slug}`, `/v1/drugs/{slug}/availability?lat&lng` | page médicament, comparateur |
| POST/GET | `/v1/orders`, `/v1/orders/{id}`, `POST /v1/orders/{id}/cancel` | commandes patient (OTP si invité) |
| GET/POST | `/pharma/orgs/{orgId}/prescriptions` (inbox), `POST /{id}/respond`, `POST /{id}/dispense` | ordonnances reçues |
| GET/PATCH | `/pharma/orgs/{orgId}/orders`, `PATCH /{id}/status` | commandes |
| CRUD | `/pharma/orgs/{orgId}/products`, `POST /products/import` | catalogue |
| GET/POST | `/pharma/orgs/{orgId}/duty`, `/duty/corrections` | gardes |
| GET | `/pharma/orgs/{orgId}/stats`, `/placements` | |
| Admin | `CRUD /v1/admin/duty-schedules`, `/v1/admin/placements`, `/v1/admin/drugs`, `GET /v1/admin/product-reports` | |

## Back-office (`/v1/admin`) — `platform:admin`
| Méthode | Route | Description |
|---|---|---|
| GET | `/verifications?status=` ; POST `/verifications/{practitionerId}/approve|request-changes|reject` | |
| GET/PATCH | `/organizations`, `/practitioners`, `/users` | recherche, suspension, actions support |
| CRUD | `/directory/*` | référentiels |
| GET | `/reports`, PATCH `/reports/{id}` | signalements |
| CRUD | `/plans`, `/subscriptions`, `/invoices` | |
| GET | `/notifications?phone=&status=`, POST `/notifications/{id}/resend` | |
| GET | `/stats` | plateforme |
| GET/PATCH | `/feature-flags` | |

## Contact (`/v1/contact`)
| Méthode | Route | Description |
|---|---|---|
| POST | `/contact` | `{ name, email, topic (PATIENT, PRACTITIONER, PHARMACY, OTHER), message, website? }` → 202 ; e-mail au support (`SUPPORT_EMAIL`) par le journal des notifications ; `website` est un champ piège (rempli = ignoré sans erreur) |

## Back-office : signalements (`/v1/admin/reports`) — rôles VERIFIER, SUPPORT, SUPERADMIN
| Méthode | Route | Description |
|---|---|---|
| GET | `/reports?scope=open\|closed` | signalements de profils avec soignant, motif, précisions, auteur (s’il était connecté), nombre de signalements ouverts sur le profil |
| POST | `/reports/{id}/decision` | `{ action: DISMISS \| CONTACT \| UNPUBLISH }` : clore ; écrire au soignant (motif seulement, jamais l’auteur ni les précisions), reste à suivre ; retirer le profil du site et clore tous ses signalements ouverts. Journal d’audit |

## Webhooks et divers
- `POST /v1/webhooks/sms/{provider}` : accusés de réception, réponses « OUI » (confirmation) et « STOP ».
- `POST /v1/webhooks/whatsapp` (V2).
- `GET /health`, `GET /ready`, `GET /metrics` (interne).

## Limites de débit (par IP / par compte)
- OTP : 3 demandes / 15 min / numéro, 10 / h / IP.
- Routes publiques en lecture (`apps/api/src/common/rate-limit.ts`, fenêtre d’une minute par adresse, 429 `RATE_LIMITED` avec `Retry-After`) : résultats de recherche 60 req / min ; autocomplétion 120 ; profils, créneaux, annuaire, pharmacies et médicaments 120 ; vérification d’une ordonnance par son code 30. Si Redis ne répond pas, la requête passe (données publiques). Le rendu côté serveur du site transmet l’adresse du visiteur (`X-Forwarded-For` écrit par Caddy).
- Verrous de créneau : 10 / min / session.
- Formulaire de contact : 5 messages / h / IP et 3 / h / adresse e-mail (`apps/api/src/contact/contact-rules.ts`).
- Login : 5 échecs → délai progressif, 20 → blocage 1 h.
