# Modèle de données

PostgreSQL 16 via Prisma. Identifiants `uuid v7` (triables), horodatages `timestamptz` en UTC, `createdAt` / `updatedAt` partout, suppression logique (`deletedAt`) sur les entités patients/soignants.

## 1. Schéma relationnel (vue d'ensemble)

```
User ──1:1── PatientProfile ──1:n── Relative
 │                │
 │                └──1:n── Appointment ──n:1── Motive ──n:1── Agenda ──n:1── Practitioner ──n:1── Organization
 │                              │                               │                  │
 │                              ├──n:1── Practice (lieu) ◄──────┘                  ├──1:n── PractitionerPractice
 │                              ├──1:n── AppointmentEvent (historique)             ├──1:n── VerificationDocument
 │                              └──0:1── WaitlistRequest                           └──n:n── Speciality / Language / Expertise
 │
 ├──1:n── Membership (rôle dans une Organization)
 ├──1:n── Session / RefreshToken / OtpCode
 └──1:n── NotificationPreference

Agenda ──1:n── AvailabilityRule, Absence, SlotLock (Redis), Appointment
PatientRecord (fiche cabinet) ──n:1── Organization, ──0:1── PatientProfile, ──1:n── ClinicalNote, Document, Tag
Notification ──n:1── User ; Document ──n:1── (PatientRecord | Appointment)
AuditLog, FeatureFlag, Subscription/Invoice, Locality/Island, Insurance
```

## 2. Entités et champs principaux

### Comptes et identités
- **User** : `id`, `phone` (E.164, unique, nullable pour pros sans tel), `phoneVerifiedAt`, `email` (unique, nullable), `emailVerifiedAt`, `passwordHash` (argon2id), `kind` (`PATIENT` | `PROFESSIONAL` | `PLATFORM_ADMIN`), `locale` (`fr`), `status` (`ACTIVE` | `SUSPENDED` | `DELETED`), `twoFactorSecret`, `lastLoginAt`.
- **PatientProfile** : `userId`, `civility`, `firstName`, `lastName`, `birthDate`, `sex`, `address` (ligne, localité, île), `insurance` (texte / ref), `notes` (patient-only), `preferredChannel`.
- **Relative** (proche) : `patientProfileId`, identité, `birthDate`, `relationship` (enfant, parent, conjoint, autre), `phone` optionnel.
- **Session / RefreshToken** : `userId`, `tokenHash`, `userAgent`, `ip`, `expiresAt`, `revokedAt`.
- **OtpCode** : `phone`, `codeHash`, `purpose` (`SIGNUP` | `LOGIN` | `PHONE_CHANGE` | `BOOKING_GUEST`), `attempts`, `expiresAt`.

### Structure professionnelle
- **Organization** (cabinet, centre, clinique) : `name`, `slug`, `type` (`SOLO_PRACTICE` | `GROUP_PRACTICE` | `HEALTH_CENTER` | `CLINIC` | `HOSPITAL` | `LAB` | `PHARMACY`), `logoUrl`, `description`, `phone`, `email`, `website`, `status` (`PENDING` | `ACTIVE` | `SUSPENDED`), `plan`.
- **Membership** : `userId`, `organizationId`, `role` (`OWNER` | `PRACTITIONER` | `SECRETARY` | `ADMIN`), `permissions` (JSON de surcharges), `practitionerId` nullable, `invitedAt`, `acceptedAt`.
- **Invitation** (PRO-05) : `organizationId`, `email` (minuscules), `role` (`SECRETARY` | `ADMIN`), `permissions` données à l’arrivée, `tokenHash` (SHA-256 du jeton du lien, jamais le jeton), `invitedById`, `expiresAt` (7 jours), `acceptedAt`, `revokedAt`. Une nouvelle invitation à la même adresse annule la précédente.
- **Practitioner** : `organizationId`, `userId` (nullable si géré par la structure), `slug` (unique), `civility`, `firstName`, `lastName`, `title` (« Dr »), `specialityId`, `secondarySpecialities[]`, `photoUrl`, `bio`, `acceptsNewPatients`, `verificationStatus` (`UNVERIFIED` | `PENDING` | `VERIFIED` | `REJECTED`), `verifiedAt`, `licenseNumber`, `languages[]`, `expertises[]`, `educations` (JSON), `experiences` (JSON), `paymentMethods[]`, `insurancesAccepted[]`, `priceList` (JSON motif → KMF ou table `Price`), `isPublished`, `searchVector` (tsvector).
- **Practice** (lieu de consultation) : `organizationId`, `name`, `addressLine`, `localityId`, `islandId`, `lat`, `lng`, `phone`, `accessInfo` (JSON : étage, ascenseur, parking…), `openingHours` (JSON lundi→dimanche), `photos[]`.
- **PractitionerPractice** : lien n:n praticien ↔ lieu.
- **VerificationDocument** : `practitionerId`, `type` (`DIPLOMA` | `LICENSE` | `ID_CARD` | `OTHER`), `fileKey`, `status`, `reviewedBy`, `reviewNote`.

### Référentiels (`directory`)
- **Speciality** : `slug`, `name`, `namePlural`, `group` (médecine, dentaire, paramédical…), `defaultMotives` (JSON modèles), `icon`.
- **Expertise** (actes/expertises) : `specialityId`, `name`.
- **Language** : `code`, `name` (fr, zdj [shikomori], ar, en, sw, mg…).
- **Island** : `code` (`NGAZIDJA`, `NDZUANI`, `MWALI`), `name`.
- **Locality** : `islandId`, `name`, `slug`, `lat`, `lng`, `kind` (ville, village, quartier).
- **Insurance** : `name`, `kind` (publique, privée).

### Agenda et disponibilités
- **Agenda** : `practitionerId`, `practiceId`, `name`, `color`, `timezone` (`Indian/Comoro`), `slotStepMinutes` (5/10/15), `bookingHorizonDays` (90), `minNoticeMinutes` (120), `maxActiveAppointmentsPerPatient` (2), `onlineBookingEnabled`, `requiresValidation` (bool), `isDefault`.
- **Motive** : `agendaId`, `name`, `durationMinutes`, `color`, `isOnline`, `newPatientsAllowed`, `instructions` (consignes), `questions` (JSON, ex. « déjà consulté ? »), `priceKmf`, `cancellationDeadlineHours` (24), `minNoticeMinutes` (surcharge), `sortOrder`, `isActive`.
- **AvailabilityRule** : `agendaId`, `weekday` (0–6), `startTime`, `endTime`, `motiveIds[]` (vide = tous), `validFrom`, `validUntil`, `recurrence` (`WEEKLY` | `BIWEEKLY`), `capacity` (1 par défaut).
- **Absence** : `agendaId`, `startsAt`, `endsAt`, `reason`, `allDay`, `recurrenceRule` (RRULE optionnel), `createdBy`.
- **SlotLock** (Redis, TTL 10 min) : clé `lock:{agendaId}:{startsAt}:{motiveId}`, valeur `sessionId`.
- **Holiday** : jours fériés comoriens (fixes + mobiles islamiques saisis chaque année).

### Rendez-vous
- **Appointment** : `agendaId`, `practitionerId`, `practiceId`, `motiveId`, `patientProfileId` (nullable si patient hors-ligne), `relativeId` (nullable), `patientRecordId`, `startsAt`, `endsAt`, `status` (`PENDING_VALIDATION` | `CONFIRMED` | `ARRIVED` | `IN_CONSULTATION` | `DONE` | `NO_SHOW` | `CANCELLED_BY_PATIENT` | `CANCELLED_BY_PRACTICE`), `source` (`ONLINE` | `PRACTICE` | `PHONE` | `WALK_IN`), `bookedByUserId`, `notes` (cabinet), `patientMessage`, `answers` (JSON questions), `instructionsAcceptedAt`, `cancelledAt`, `cancellationReason`, `rescheduledFromId`, `remindersSent` (JSON), `confirmedByPatientAt`.
- **AppointmentEvent** : `appointmentId`, `type` (`BOOKED`, `RESCHEDULED`, `CANCELLED`, `STATUS_CHANGED`, `REMINDER_SENT`…), `actorUserId`, `payload`.
- **WaitlistRequest** : `agendaId`, `patientProfileId`, `motiveId`, `before` (date limite), `status`, `notifiedAt`.

### Patientèle (vue cabinet)
- **PatientRecord** : `organizationId`, `patientProfileId` (nullable : patient sans compte), `relativeId` nullable, identité dupliquée (prénom, nom, naissance, téléphone, e-mail), `address`, `insurance`, `adminNotes`, `tags[]`, `isBlocked`, `blockReason`, `noShowCount`, `mergedIntoId`, `externalRef` (import).
- **ClinicalNote** : `patientRecordId`, `practitionerId`, `appointmentId` nullable, `content` (chiffré), `createdAt`. Visible uniquement par le praticien auteur (et les praticiens autorisés de la même structure si activé).
- **Document** : `organizationId`, `patientRecordId`, `appointmentId` nullable, `uploadedByUserId`, `direction` (`TO_PATIENT` | `FROM_PATIENT`), `type` (`PRESCRIPTION` | `REPORT` | `CERTIFICATE` | `RESULT` | `OTHER`), `fileKey`, `mimeType`, `size`, `sharedAt`, `viewedAt`.

### Notifications
- **Notification** : `userId` (ou `phone`/`email` pour hors-compte), `channel` (`SMS` | `EMAIL` | `WHATSAPP` | `PUSH`), `template`, `payload`, `status` (`QUEUED` | `SENT` | `DELIVERED` | `FAILED`), `providerId`, `cost`, `sentAt`, `relatedAppointmentId`.
- **NotificationPreference** : `userId`, canaux activés, `reminderOptOut`.
- **DeviceToken** (push mobile) : `userId`, `platform`, `token`.
- **OrganizationNotificationSettings** : `reminderOffsetsHours` ([48, 24]), `askConfirmation`, `channels`, `smsQuotaMonthly`, `senderName` (« Twabibu »).

### Dossier médical (SPEC-13)
- **MedicalRecord** : `patientProfileId` | `relativeId` | `patientRecordId` (une seule personne), `bloodGroup`, `createdAt`. **RecordConsent** : `recordId`, `organizationId`, `scope` (`READ` | `READ_WRITE`), `grantedAt`, `revokedAt`, `grantedVia` (app, SMS, verbal+justification). **RecordAccessLog** : `recordId`, `actorUserId`, `organizationId`, `section`, `reason` (`CARE` | `EMERGENCY`), `at`.
- **Allergy** (`substance`, `drugId?`, `reaction`, `severity`, `source`), **MedicalHistoryItem** (`type` MEDICAL | SURGICAL | FAMILY | OBSTETRIC | LIFESTYLE, `label`, `date`, `details`), **Vaccination** (`vaccineId`, `date`, `lot`, `nextDueAt`), **CurrentTreatment** (`drugId`, `posology`, `startedAt`, `endsAt`, `prescriptionId?`, `status`).
- **Consultation** : `recordId`, `appointmentId?`, `practitionerId`, `organizationId`, `templateId`, `sections` (JSON chiffré : motif, interrogatoire, examen, diagnostic, conduite), `diagnoses` (codes CIM-10 + libellés), `closedAt`, `version`, `previousVersionId`. **Vital** (`type`, `value`, `unit`, `measuredAt`, `consultationId?`). **LabResult** (`documentId`, `analytes` JSON). **FollowUpPlan** (`condition`, `checks` JSON, `nextDueAt`, `status`).
- Tous les champs médicaux textuels sont chiffrés applicativement ; les champs structurés nécessaires aux alertes (DCI des allergies) sont stockés en clair hashé pour l'index.

### Ordonnance numérique (SPEC-14)
- **Drug** (référentiel) : `dci`, `brandNames[]`, `form`, `strength`, `unit`, `route`, `atcCode`, `prescriptionOnly`, `controlled`, `usualPosology` JSON, `contraindications` JSON, `lnme` (bool), `isActive`.
- **Prescription** : `recordId`, `practitionerId`, `organizationId`, `appointmentId?`, `type` (`MEDICATION` | `LAB` | `IMAGING` | `CARE`), `status` (`DRAFT` | `SIGNED` | `SENT_TO_PHARMACY` | `PARTIALLY_DISPENSED` | `DISPENSED` | `EXPIRED` | `CANCELLED`), `signedAt`, `contentHash`, `pdfKey`, `qrCode` (unique), `expiresAt`, `renewals`, `cancelledAt`, `replacedById`. **PrescriptionLine** (`drugId?`, `freeText?`, `strength`, `form`, `posology` JSON + `posologyText`, `quantity`, `durationDays`, `substitutable`, `notes`). **PrescriptionTemplate** (`practitionerId`, `name`, `lines`). **PrescriptionShare** (`prescriptionId`, `pharmacyId`, `sentAt`, `status`, `response` JSON). **Dispensation** (`prescriptionId`, `pharmacyId`, `lines` JSON, `dispensedAt`, `renewalIndex`).

### Pharmacies (SPEC-15)
- `Organization.type = PHARMACY` + **PharmacyProfile** (`services[]`, `deliveryZones` JSON, `deliveryFees` JSON, `paymentMethods[]`, `licenseNumber`, `pharmacistName`). **DutySchedule** (`pharmacyId`, `islandId`, `zone`, `startsAt`, `endsAt`, `source`, `updatedAt`). **PharmacyProduct** (`pharmacyId`, `drugId?`, `name`, `category`, `priceKmf`, `availability`, `updatedAt`, `prescriptionOnly`, `controlled`). **Order** (`pharmacyId`, `patientProfileId?`, `guestPhone?`, `prescriptionId?`, `prescriptionPhotoKey?`, `mode`, `address` JSON, `status`, `paymentMode`, `subtotal`, `deliveryFee`, `courier` JSON, timestamps), **OrderLine**, **OrderEvent**. **SponsoredPlacement** (`pharmacyId`, `slot` (`LOCALITY_TOP` | `DUTY_PAGE` | `DRUG_PAGE`), `zone`, `startsAt`, `endsAt`, `priceKmf`, `invoiceId`). **ProductReport**.

### Plateforme
- **AuditLog** : `actorUserId`, `action`, `entityType`, `entityId`, `organizationId`, `ip`, `before/after` (JSON tronqué), `createdAt`. Table en append-only (droits DB restreints).
- **Subscription** : `organizationId`, `plan`, `status`, `startedAt`, `renewsAt`, `seats` ; **Invoice** : montant KMF, `paidAt`, `method` (`CASH` | `TRANSFER` | `MVOLA` | `HURI` | `CARD`), `pdfKey`.
- **Report** (signalement de profil), **FeatureFlag**, **HelpArticle**.

## 3. Index et contraintes importants
- `Appointment` : index `(agendaId, startsAt)`, contrainte d'exclusion (`EXCLUDE USING gist (agendaId WITH =, tstzrange(startsAt, endsAt) WITH &&) WHERE status NOT IN (cancelled…)`) pour interdire les chevauchements au niveau base (capacité 1). Pour `capacity > 1`, vérifier en service + verrou Redis.
- `User.phone` unique partiel (`WHERE phone IS NOT NULL`), idem e-mail.
- `Practitioner.searchVector` (GIN) sur nom + spécialité + expertises + localité, `pg_trgm` sur `lastName`.
- `Practice (lat, lng)` : index GiST si PostGIS, sinon calcul haversine sur un sous-ensemble filtré par île/localité.
- `PatientRecord` : index `(organizationId, phone)`, `(organizationId, lastName, firstName)` + trigram.

## 4. Prisma — extrait de départ (à compléter par les tickets)

```prisma
model User {
  id              String   @id @default(uuid(7))
  phone           String?  @unique
  phoneVerifiedAt DateTime?
  email           String?  @unique
  emailVerifiedAt DateTime?
  passwordHash    String?
  kind            UserKind
  status          UserStatus @default(ACTIVE)
  locale          String   @default("fr")
  twoFactorSecret String?
  lastLoginAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?
  patientProfile  PatientProfile?
  memberships     Membership[]
  sessions        Session[]
}

enum UserKind { PATIENT PROFESSIONAL PLATFORM_ADMIN }
enum UserStatus { ACTIVE SUSPENDED DELETED }

model Appointment {
  id                     String   @id @default(uuid(7))
  agendaId               String
  practitionerId         String
  practiceId             String
  motiveId               String
  patientProfileId       String?
  relativeId             String?
  patientRecordId        String
  startsAt               DateTime
  endsAt                 DateTime
  status                 AppointmentStatus @default(CONFIRMED)
  source                 AppointmentSource
  bookedByUserId         String?
  notes                  String?
  answers                Json?
  instructionsAcceptedAt DateTime?
  cancelledAt            DateTime?
  cancellationReason     String?
  rescheduledFromId      String?
  confirmedByPatientAt   DateTime?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
  agenda                 Agenda   @relation(fields: [agendaId], references: [id])
  motive                 Motive   @relation(fields: [motiveId], references: [id])
  events                 AppointmentEvent[]
  @@index([agendaId, startsAt])
  @@index([patientProfileId, startsAt])
}

enum AppointmentStatus { PENDING_VALIDATION CONFIRMED ARRIVED IN_CONSULTATION DONE NO_SHOW CANCELLED_BY_PATIENT CANCELLED_BY_PRACTICE }
enum AppointmentSource { ONLINE PRACTICE PHONE WALK_IN }
```

La contrainte d'exclusion anti-chevauchement est ajoutée par une migration SQL manuelle (Prisma ne la génère pas) : voir `infra/scripts/sql/001_appointment_no_overlap.sql` (ticket DATA-03).

## 5. Données de départ (seed)
- 3 îles, ~60 localités avec coordonnées (Moroni, Mitsamiouli, Foumbouni, Iconi, Mbéni, Mutsamudu, Domoni, Ouani, Sima, Fomboni, Nioumachoua, Wanani…).
- Référentiel médicaments : liste nationale des médicaments essentiels (LNME) + DCI/ATC (import CSV, ticket RX-01) ; vaccins du calendrier comorien ; sous-ensemble CIM-10 (chapitres courants).
- Pharmacies des trois îles (annuaire de départ) et calendrier des gardes du mois en cours.
- ~70 spécialités (reprendre la liste Doctolib adaptée : médecin généraliste, pédiatre, gynécologue, chirurgien-dentiste, sage-femme, infirmier, kinésithérapeute, ophtalmologue, dermatologue, cardiologue, ORL, psychologue, radiologue, laboratoire, pharmacie…) avec motifs par défaut.
- Langues : français, shikomori, arabe, anglais, swahili, malgache.
- Assurances : liste à valider (assurance maladie généralisée en cours, assurances privées).
- Jours fériés 2026–2027.
- Jeu de démonstration : 1 clinique, 6 praticiens, agendas et RDV fictifs (dev et staging uniquement).
