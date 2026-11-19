-- CreateEnum
CREATE TYPE "UserKind" AS ENUM ('PATIENT', 'PROFESSIONAL', 'PHARMACY_STAFF', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('SIGNUP', 'LOGIN', 'PHONE_CHANGE', 'BOOKING_GUEST');

-- CreateEnum
CREATE TYPE "IslandCode" AS ENUM ('NGAZIDJA', 'NDZUANI', 'MWALI');

-- CreateEnum
CREATE TYPE "SpecialityGroup" AS ENUM ('MEDICAL', 'DENTAL', 'MIDWIFERY', 'PARAMEDICAL', 'PHARMACY', 'LAB', 'WELLBEING');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('SOLO_PRACTICE', 'GROUP_PRACTICE', 'HEALTH_CENTER', 'CLINIC', 'HOSPITAL', 'LAB', 'PHARMACY');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'PRACTITIONER', 'SECRETARY', 'PHARMACIST', 'PHARMACY_STAFF');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'CHANGES_REQUESTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "VerificationDocumentType" AS ENUM ('DIPLOMA', 'LICENSE', 'ID_CARD', 'OPENING_AUTHORIZATION', 'OTHER');

-- CreateEnum
CREATE TYPE "Recurrence" AS ENUM ('WEEKLY', 'BIWEEKLY');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING_VALIDATION', 'CONFIRMED', 'ARRIVED', 'IN_CONSULTATION', 'DONE', 'NO_SHOW', 'CANCELLED_BY_PATIENT', 'CANCELLED_BY_PRACTICE');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('ONLINE', 'PRACTICE', 'PHONE', 'WALK_IN');

-- CreateEnum
CREATE TYPE "DocumentDirection" AS ENUM ('TO_PATIENT', 'FROM_PATIENT');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PRESCRIPTION', 'REPORT', 'CERTIFICATE', 'RESULT', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'EMAIL', 'WHATSAPP', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConsentScope" AS ENUM ('READ', 'READ_WRITE');

-- CreateEnum
CREATE TYPE "RecordAccessReason" AS ENUM ('CARE', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "AllergySeverity" AS ENUM ('MILD', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('PATIENT_DECLARED', 'PRACTITIONER');

-- CreateEnum
CREATE TYPE "MedicalHistoryType" AS ENUM ('MEDICAL', 'SURGICAL', 'FAMILY', 'OBSTETRIC', 'LIFESTYLE');

-- CreateEnum
CREATE TYPE "TreatmentStatus" AS ENUM ('ACTIVE', 'STOPPED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VitalType" AS ENUM ('WEIGHT_KG', 'HEIGHT_CM', 'SYSTOLIC_MMHG', 'DIASTOLIC_MMHG', 'HEART_RATE_BPM', 'TEMPERATURE_C', 'SPO2_PERCENT', 'GLYCEMIA_G_L', 'HEAD_CIRCUMFERENCE_CM');

-- CreateEnum
CREATE TYPE "PrescriptionType" AS ENUM ('MEDICATION', 'LAB', 'IMAGING', 'CARE');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('DRAFT', 'SIGNED', 'SENT_TO_PHARMACY', 'PARTIALLY_DISPENSED', 'DISPENSED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShareStatus" AS ENUM ('SENT', 'ANSWERED', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ProductAvailability" AS ENUM ('IN_STOCK', 'LOW', 'OUT_OF_STOCK', 'ON_ORDER');

-- CreateEnum
CREATE TYPE "OrderMode" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "OrderPaymentMode" AS ENUM ('AT_PICKUP', 'CASH_ON_DELIVERY', 'MOBILE_MONEY');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlacementSlot" AS ENUM ('LOCALITY_TOP', 'DUTY_PAGE', 'DRUG_PAGE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'MVOLA', 'HURI', 'CARD');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "phone" TEXT,
    "phoneVerifiedAt" TIMESTAMPTZ(3),
    "email" TEXT,
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "passwordHash" TEXT,
    "kind" "UserKind" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "twoFactorSecret" TEXT,
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "civility" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "sex" TEXT,
    "addressLine" TEXT,
    "localityId" UUID,
    "insurance" TEXT,
    "preferredChannel" "NotificationChannel" NOT NULL DEFAULT 'SMS',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PatientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relative" (
    "id" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "sex" TEXT,
    "relationship" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Relative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" UUID NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" UUID NOT NULL,
    "sms" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "push" BOOLEAN NOT NULL DEFAULT true,
    "reminderOptOut" BOOLEAN NOT NULL DEFAULT false,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Island" (
    "id" UUID NOT NULL,
    "code" "IslandCode" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Island_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Locality" (
    "id" UUID NOT NULL,
    "islandId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'town',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Locality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Speciality" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "group" "SpecialityGroup" NOT NULL,
    "canPrescribe" BOOLEAN NOT NULL DEFAULT false,
    "defaultMotives" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Speciality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expertise" (
    "id" UUID NOT NULL,
    "specialityId" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Expertise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Insurance" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'private',

    CONSTRAINT "Insurance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "isEstimated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PENDING',
    "logoUrl" TEXT,
    "description" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'discovery',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "practitionerId" UUID,
    "invitedAt" TIMESTAMPTZ(3),
    "acceptedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Practitioner" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "specialityId" UUID NOT NULL,
    "photoUrl" TEXT,
    "bio" TEXT,
    "acceptsNewPatients" BOOLEAN NOT NULL DEFAULT true,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMPTZ(3),
    "licenseNumber" TEXT,
    "canPrescribe" BOOLEAN NOT NULL DEFAULT false,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expertises" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "educations" JSONB NOT NULL DEFAULT '[]',
    "experiences" JSONB NOT NULL DEFAULT '[]',
    "paymentMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "insurancesAccepted" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Practitioner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Practice" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "localityId" UUID NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "phone" TEXT,
    "accessInfo" JSONB NOT NULL DEFAULT '{}',
    "openingHours" JSONB NOT NULL DEFAULT '{}',
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Practice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PractitionerPractice" (
    "practitionerId" UUID NOT NULL,
    "practiceId" UUID NOT NULL,

    CONSTRAINT "PractitionerPractice_pkey" PRIMARY KEY ("practitionerId","practiceId")
);

-- CreateTable
CREATE TABLE "VerificationDocument" (
    "id" UUID NOT NULL,
    "practitionerId" UUID,
    "organizationId" UUID,
    "type" "VerificationDocumentType" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" UUID,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agenda" (
    "id" UUID NOT NULL,
    "practitionerId" UUID NOT NULL,
    "practiceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "timezone" TEXT NOT NULL DEFAULT 'Indian/Comoro',
    "slotStepMinutes" INTEGER NOT NULL DEFAULT 15,
    "bookingHorizonDays" INTEGER NOT NULL DEFAULT 90,
    "minNoticeMinutes" INTEGER NOT NULL DEFAULT 120,
    "maxActiveAppointmentsPerPatient" INTEGER NOT NULL DEFAULT 2,
    "onlineBookingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "requiresValidation" BOOLEAN NOT NULL DEFAULT false,
    "blockHolidays" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Motive" (
    "id" UUID NOT NULL,
    "agendaId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "newPatientsAllowed" BOOLEAN NOT NULL DEFAULT true,
    "instructions" TEXT,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "priceKmf" INTEGER,
    "cancellationDeadlineHours" INTEGER NOT NULL DEFAULT 24,
    "minNoticeMinutes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Motive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" UUID NOT NULL,
    "agendaId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "motiveIds" UUID[] DEFAULT ARRAY[]::UUID[],
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "validFrom" DATE,
    "validUntil" DATE,
    "recurrence" "Recurrence" NOT NULL DEFAULT 'WEEKLY',
    "anchorDate" DATE,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" UUID NOT NULL,
    "agendaId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceRule" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Absence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" UUID NOT NULL,
    "agendaId" UUID NOT NULL,
    "motiveId" UUID NOT NULL,
    "patientRecordId" UUID NOT NULL,
    "patientProfileId" UUID,
    "relativeId" UUID,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" "AppointmentSource" NOT NULL,
    "allowOverlap" BOOLEAN NOT NULL DEFAULT false,
    "bookedByUserId" UUID,
    "notes" TEXT,
    "patientMessage" TEXT,
    "answers" JSONB,
    "instructionsAcceptedAt" TIMESTAMPTZ(3),
    "confirmedByPatientAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "cancellationReason" TEXT,
    "rescheduledFromId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentEvent" (
    "id" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "actorUserId" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistRequest" (
    "id" UUID NOT NULL,
    "agendaId" UUID NOT NULL,
    "patientProfileId" UUID NOT NULL,
    "motiveId" UUID NOT NULL,
    "before" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientRecord" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "patientProfileId" UUID,
    "relativeId" UUID,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" DATE,
    "sex" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "addressLine" TEXT,
    "localityId" UUID,
    "insurance" TEXT,
    "adminNotes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockReason" TEXT,
    "noShowCount" INTEGER NOT NULL DEFAULT 0,
    "mergedIntoId" UUID,
    "externalRef" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PatientRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" UUID NOT NULL,
    "patientRecordId" UUID NOT NULL,
    "practitionerId" UUID NOT NULL,
    "appointmentId" UUID,
    "contentEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "patientRecordId" UUID,
    "patientProfileId" UUID,
    "appointmentId" UUID,
    "uploadedByUserId" UUID NOT NULL,
    "direction" "DocumentDirection" NOT NULL,
    "type" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sharedAt" TIMESTAMPTZ(3),
    "viewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalRecord" (
    "id" UUID NOT NULL,
    "patientProfileId" UUID,
    "relativeId" UUID,
    "patientRecordId" UUID,
    "bloodGroup" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MedicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordConsent" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "scope" "ConsentScope" NOT NULL DEFAULT 'READ_WRITE',
    "grantedVia" TEXT NOT NULL,
    "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "RecordConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordAccessLog" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "section" TEXT NOT NULL,
    "reason" "RecordAccessReason" NOT NULL DEFAULT 'CARE',
    "justification" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allergy" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "substance" TEXT NOT NULL,
    "drugDci" TEXT,
    "reaction" TEXT,
    "severity" "AllergySeverity" NOT NULL DEFAULT 'MODERATE',
    "source" "DataSource" NOT NULL,
    "authorId" UUID,
    "notedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Allergy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalHistoryItem" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "type" "MedicalHistoryType" NOT NULL,
    "label" TEXT NOT NULL,
    "occurredOn" DATE,
    "detailsEncrypted" TEXT,
    "source" "DataSource" NOT NULL,
    "authorId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicalHistoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vaccination" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "vaccine" TEXT NOT NULL,
    "givenOn" DATE NOT NULL,
    "lot" TEXT,
    "nextDueOn" DATE,
    "authorId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vaccination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrentTreatment" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "drugId" UUID,
    "label" TEXT NOT NULL,
    "posology" TEXT NOT NULL,
    "startedOn" DATE NOT NULL,
    "endsOn" DATE,
    "prescriptionId" UUID,
    "status" "TreatmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrentTreatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "appointmentId" UUID,
    "practitionerId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'general',
    "sectionsEncrypted" TEXT NOT NULL,
    "diagnoses" JSONB NOT NULL DEFAULT '[]',
    "closedAt" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "previousVersionId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vital" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "consultationId" UUID,
    "type" "VitalType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMPTZ(3) NOT NULL,
    "source" "DataSource" NOT NULL DEFAULT 'PRACTITIONER',

    CONSTRAINT "Vital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "documentId" UUID,
    "label" TEXT NOT NULL,
    "analytes" JSONB NOT NULL DEFAULT '[]',
    "resultedOn" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpPlan" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "condition" TEXT NOT NULL,
    "checks" JSONB NOT NULL DEFAULT '[]',
    "nextDueOn" DATE,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "authorId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drug" (
    "id" UUID NOT NULL,
    "dci" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brandNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "form" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "route" TEXT NOT NULL DEFAULT 'oral',
    "atcCode" TEXT,
    "prescriptionOnly" BOOLEAN NOT NULL DEFAULT true,
    "controlled" BOOLEAN NOT NULL DEFAULT false,
    "usualPosology" JSONB NOT NULL DEFAULT '{}',
    "essential" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Drug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "practitionerId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "appointmentId" UUID,
    "type" "PrescriptionType" NOT NULL DEFAULT 'MEDICATION',
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "signedAt" TIMESTAMPTZ(3),
    "contentHash" TEXT,
    "pdfKey" TEXT,
    "qrCode" TEXT,
    "expiresAt" TIMESTAMPTZ(3),
    "renewals" INTEGER NOT NULL DEFAULT 0,
    "cancelledAt" TIMESTAMPTZ(3),
    "replacedById" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionLine" (
    "id" UUID NOT NULL,
    "prescriptionId" UUID NOT NULL,
    "drugId" UUID,
    "freeText" TEXT,
    "strength" TEXT,
    "form" TEXT,
    "posology" JSONB NOT NULL DEFAULT '{}',
    "posologyText" TEXT NOT NULL,
    "quantity" INTEGER,
    "durationDays" INTEGER,
    "substitutable" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PrescriptionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionTemplate" (
    "id" UUID NOT NULL,
    "practitionerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrescriptionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionShare" (
    "id" UUID NOT NULL,
    "prescriptionId" UUID NOT NULL,
    "pharmacyId" UUID NOT NULL,
    "status" "ShareStatus" NOT NULL DEFAULT 'SENT',
    "response" JSONB,
    "sentAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMPTZ(3),

    CONSTRAINT "PrescriptionShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispensation" (
    "id" UUID NOT NULL,
    "prescriptionId" UUID NOT NULL,
    "pharmacyId" UUID NOT NULL,
    "dispensedById" UUID NOT NULL,
    "lines" JSONB NOT NULL,
    "renewalIndex" INTEGER NOT NULL DEFAULT 0,
    "dispensedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispensation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyProfile" (
    "organizationId" UUID NOT NULL,
    "pharmacistName" TEXT,
    "licenseNumber" TEXT,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "paymentMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "deliveryZones" JSONB NOT NULL DEFAULT '[]',
    "verifiedAt" TIMESTAMPTZ(3),

    CONSTRAINT "PharmacyProfile_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "DutySchedule" (
    "id" UUID NOT NULL,
    "pharmacyId" UUID NOT NULL,
    "island" "IslandCode" NOT NULL,
    "zone" TEXT,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "source" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DutySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyProduct" (
    "id" UUID NOT NULL,
    "pharmacyId" UUID NOT NULL,
    "drugId" UUID,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'medication',
    "priceKmf" INTEGER NOT NULL,
    "availability" "ProductAvailability" NOT NULL DEFAULT 'IN_STOCK',
    "prescriptionOnly" BOOLEAN NOT NULL DEFAULT false,
    "controlled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PharmacyProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "pharmacyId" UUID NOT NULL,
    "patientProfileId" UUID,
    "guestPhone" TEXT,
    "prescriptionId" UUID,
    "prescriptionPhotoKey" TEXT,
    "mode" "OrderMode" NOT NULL,
    "address" JSONB,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMode" "OrderPaymentMode" NOT NULL,
    "subtotalKmf" INTEGER NOT NULL DEFAULT 0,
    "deliveryFeeKmf" INTEGER NOT NULL DEFAULT 0,
    "courier" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceKmf" INTEGER NOT NULL,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "actorUserId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsoredPlacement" (
    "id" UUID NOT NULL,
    "pharmacyId" UUID NOT NULL,
    "slot" "PlacementSlot" NOT NULL,
    "island" "IslandCode" NOT NULL,
    "zone" TEXT,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "priceKmf" INTEGER NOT NULL,
    "invoiceId" UUID,

    CONSTRAINT "SponsoredPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "recipient" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "template" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT,
    "providerId" TEXT,
    "costKmf" DOUBLE PRECISION,
    "error" TEXT,
    "relatedAppointmentId" UUID,
    "relatedOrderId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationNotificationSettings" (
    "organizationId" UUID NOT NULL,
    "reminderOffsetsHours" INTEGER[] DEFAULT ARRAY[24]::INTEGER[],
    "askConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "channels" "NotificationChannel"[] DEFAULT ARRAY['SMS', 'EMAIL']::"NotificationChannel"[],
    "smsQuotaMonthly" INTEGER NOT NULL DEFAULT 500,
    "senderName" TEXT NOT NULL DEFAULT 'Twabibu',

    CONSTRAINT "OrganizationNotificationSettings_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "organizationId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "ip" TEXT,
    "changes" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "plan" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "seats" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renewsAt" TIMESTAMPTZ(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID,
    "number" TEXT NOT NULL,
    "amountKmf" INTEGER NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMPTZ(3),
    "method" "PaymentMethod",
    "reference" TEXT,
    "pdfKey" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "reporterId" UUID,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "organizationIds" UUID[] DEFAULT ARRAY[]::UUID[],
    "description" TEXT,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_userId_key" ON "PatientProfile"("userId");

-- CreateIndex
CREATE INDEX "Relative_patientProfileId_idx" ON "Relative"("patientProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "OtpCode_phone_purpose_createdAt_idx" ON "OtpCode"("phone", "purpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Island_code_key" ON "Island"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Island_slug_key" ON "Island"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Locality_slug_key" ON "Locality"("slug");

-- CreateIndex
CREATE INDEX "Locality_islandId_idx" ON "Locality"("islandId");

-- CreateIndex
CREATE UNIQUE INDEX "Speciality_slug_key" ON "Speciality"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Expertise_specialityId_name_key" ON "Expertise"("specialityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Insurance_name_key" ON "Insurance"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_practitionerId_key" ON "Membership"("practitionerId");

-- CreateIndex
CREATE INDEX "Membership_organizationId_idx" ON "Membership"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "Membership"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Practitioner_slug_key" ON "Practitioner"("slug");

-- CreateIndex
CREATE INDEX "Practitioner_specialityId_idx" ON "Practitioner"("specialityId");

-- CreateIndex
CREATE INDEX "Practitioner_organizationId_idx" ON "Practitioner"("organizationId");

-- CreateIndex
CREATE INDEX "Practitioner_lastName_idx" ON "Practitioner"("lastName");

-- CreateIndex
CREATE INDEX "Practice_localityId_idx" ON "Practice"("localityId");

-- CreateIndex
CREATE INDEX "Practice_organizationId_idx" ON "Practice"("organizationId");

-- CreateIndex
CREATE INDEX "VerificationDocument_practitionerId_idx" ON "VerificationDocument"("practitionerId");

-- CreateIndex
CREATE INDEX "Agenda_practitionerId_idx" ON "Agenda"("practitionerId");

-- CreateIndex
CREATE INDEX "Motive_agendaId_idx" ON "Motive"("agendaId");

-- CreateIndex
CREATE INDEX "AvailabilityRule_agendaId_weekday_idx" ON "AvailabilityRule"("agendaId", "weekday");

-- CreateIndex
CREATE INDEX "Absence_agendaId_startsAt_idx" ON "Absence"("agendaId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_rescheduledFromId_key" ON "Appointment"("rescheduledFromId");

-- CreateIndex
CREATE INDEX "Appointment_agendaId_startsAt_idx" ON "Appointment"("agendaId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_patientProfileId_startsAt_idx" ON "Appointment"("patientProfileId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_patientRecordId_startsAt_idx" ON "Appointment"("patientRecordId", "startsAt");

-- CreateIndex
CREATE INDEX "AppointmentEvent_appointmentId_idx" ON "AppointmentEvent"("appointmentId");

-- CreateIndex
CREATE INDEX "WaitlistRequest_agendaId_status_idx" ON "WaitlistRequest"("agendaId", "status");

-- CreateIndex
CREATE INDEX "PatientRecord_organizationId_phone_idx" ON "PatientRecord"("organizationId", "phone");

-- CreateIndex
CREATE INDEX "PatientRecord_organizationId_lastName_firstName_idx" ON "PatientRecord"("organizationId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "PatientRecord_patientProfileId_idx" ON "PatientRecord"("patientProfileId");

-- CreateIndex
CREATE INDEX "ClinicalNote_patientRecordId_idx" ON "ClinicalNote"("patientRecordId");

-- CreateIndex
CREATE INDEX "Document_patientRecordId_idx" ON "Document"("patientRecordId");

-- CreateIndex
CREATE INDEX "Document_patientProfileId_idx" ON "Document"("patientProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalRecord_patientProfileId_key" ON "MedicalRecord"("patientProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalRecord_relativeId_key" ON "MedicalRecord"("relativeId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalRecord_patientRecordId_key" ON "MedicalRecord"("patientRecordId");

-- CreateIndex
CREATE INDEX "RecordConsent_recordId_organizationId_idx" ON "RecordConsent"("recordId", "organizationId");

-- CreateIndex
CREATE INDEX "RecordAccessLog_recordId_createdAt_idx" ON "RecordAccessLog"("recordId", "createdAt");

-- CreateIndex
CREATE INDEX "Allergy_recordId_idx" ON "Allergy"("recordId");

-- CreateIndex
CREATE INDEX "MedicalHistoryItem_recordId_type_idx" ON "MedicalHistoryItem"("recordId", "type");

-- CreateIndex
CREATE INDEX "Vaccination_recordId_idx" ON "Vaccination"("recordId");

-- CreateIndex
CREATE INDEX "CurrentTreatment_recordId_status_idx" ON "CurrentTreatment"("recordId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_previousVersionId_key" ON "Consultation"("previousVersionId");

-- CreateIndex
CREATE INDEX "Consultation_recordId_createdAt_idx" ON "Consultation"("recordId", "createdAt");

-- CreateIndex
CREATE INDEX "Consultation_organizationId_idx" ON "Consultation"("organizationId");

-- CreateIndex
CREATE INDEX "Vital_recordId_type_measuredAt_idx" ON "Vital"("recordId", "type", "measuredAt");

-- CreateIndex
CREATE INDEX "LabResult_recordId_idx" ON "LabResult"("recordId");

-- CreateIndex
CREATE INDEX "FollowUpPlan_recordId_idx" ON "FollowUpPlan"("recordId");

-- CreateIndex
CREATE INDEX "FollowUpPlan_nextDueOn_idx" ON "FollowUpPlan"("nextDueOn");

-- CreateIndex
CREATE UNIQUE INDEX "Drug_slug_key" ON "Drug"("slug");

-- CreateIndex
CREATE INDEX "Drug_dci_idx" ON "Drug"("dci");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_qrCode_key" ON "Prescription"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_replacedById_key" ON "Prescription"("replacedById");

-- CreateIndex
CREATE INDEX "Prescription_recordId_createdAt_idx" ON "Prescription"("recordId", "createdAt");

-- CreateIndex
CREATE INDEX "Prescription_practitionerId_idx" ON "Prescription"("practitionerId");

-- CreateIndex
CREATE INDEX "PrescriptionLine_prescriptionId_idx" ON "PrescriptionLine"("prescriptionId");

-- CreateIndex
CREATE INDEX "PrescriptionTemplate_practitionerId_idx" ON "PrescriptionTemplate"("practitionerId");

-- CreateIndex
CREATE INDEX "PrescriptionShare_pharmacyId_status_idx" ON "PrescriptionShare"("pharmacyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PrescriptionShare_prescriptionId_pharmacyId_key" ON "PrescriptionShare"("prescriptionId", "pharmacyId");

-- CreateIndex
CREATE INDEX "Dispensation_prescriptionId_idx" ON "Dispensation"("prescriptionId");

-- CreateIndex
CREATE INDEX "Dispensation_pharmacyId_idx" ON "Dispensation"("pharmacyId");

-- CreateIndex
CREATE INDEX "DutySchedule_island_startsAt_endsAt_idx" ON "DutySchedule"("island", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "PharmacyProduct_pharmacyId_idx" ON "PharmacyProduct"("pharmacyId");

-- CreateIndex
CREATE INDEX "PharmacyProduct_drugId_idx" ON "PharmacyProduct"("drugId");

-- CreateIndex
CREATE INDEX "Order_pharmacyId_status_idx" ON "Order"("pharmacyId", "status");

-- CreateIndex
CREATE INDEX "Order_patientProfileId_idx" ON "Order"("patientProfileId");

-- CreateIndex
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_idx" ON "OrderEvent"("orderId");

-- CreateIndex
CREATE INDEX "SponsoredPlacement_slot_island_startsAt_endsAt_idx" ON "SponsoredPlacement"("slot", "island", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_relatedAppointmentId_idx" ON "Notification"("relatedAppointmentId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Subscription_organizationId_idx" ON "Subscription"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relative" ADD CONSTRAINT "Relative_patientProfileId_fkey" FOREIGN KEY ("patientProfileId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Locality" ADD CONSTRAINT "Locality_islandId_fkey" FOREIGN KEY ("islandId") REFERENCES "Island"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expertise" ADD CONSTRAINT "Expertise_specialityId_fkey" FOREIGN KEY ("specialityId") REFERENCES "Speciality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "Practitioner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Practitioner" ADD CONSTRAINT "Practitioner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Practitioner" ADD CONSTRAINT "Practitioner_specialityId_fkey" FOREIGN KEY ("specialityId") REFERENCES "Speciality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Practice" ADD CONSTRAINT "Practice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Practice" ADD CONSTRAINT "Practice_localityId_fkey" FOREIGN KEY ("localityId") REFERENCES "Locality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerPractice" ADD CONSTRAINT "PractitionerPractice_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "Practitioner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerPractice" ADD CONSTRAINT "PractitionerPractice_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "Practitioner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agenda" ADD CONSTRAINT "Agenda_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "Practitioner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agenda" ADD CONSTRAINT "Agenda_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Motive" ADD CONSTRAINT "Motive_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "Agenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityRule" ADD CONSTRAINT "AvailabilityRule_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "Agenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "Agenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "Agenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_motiveId_fkey" FOREIGN KEY ("motiveId") REFERENCES "Motive"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientRecordId_fkey" FOREIGN KEY ("patientRecordId") REFERENCES "PatientRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_rescheduledFromId_fkey" FOREIGN KEY ("rescheduledFromId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentEvent" ADD CONSTRAINT "AppointmentEvent_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistRequest" ADD CONSTRAINT "WaitlistRequest_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES "Agenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientRecord" ADD CONSTRAINT "PatientRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientRecord" ADD CONSTRAINT "PatientRecord_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "PatientRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_patientRecordId_fkey" FOREIGN KEY ("patientRecordId") REFERENCES "PatientRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_patientRecordId_fkey" FOREIGN KEY ("patientRecordId") REFERENCES "PatientRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalRecord" ADD CONSTRAINT "MedicalRecord_patientRecordId_fkey" FOREIGN KEY ("patientRecordId") REFERENCES "PatientRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordConsent" ADD CONSTRAINT "RecordConsent_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordAccessLog" ADD CONSTRAINT "RecordAccessLog_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allergy" ADD CONSTRAINT "Allergy_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalHistoryItem" ADD CONSTRAINT "MedicalHistoryItem_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vaccination" ADD CONSTRAINT "Vaccination_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentTreatment" ADD CONSTRAINT "CurrentTreatment_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrentTreatment" ADD CONSTRAINT "CurrentTreatment_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vital" ADD CONSTRAINT "Vital_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vital" ADD CONSTRAINT "Vital_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpPlan" ADD CONSTRAINT "FollowUpPlan_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "MedicalRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_replacedById_fkey" FOREIGN KEY ("replacedById") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionLine" ADD CONSTRAINT "PrescriptionLine_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionLine" ADD CONSTRAINT "PrescriptionLine_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionShare" ADD CONSTRAINT "PrescriptionShare_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispensation" ADD CONSTRAINT "Dispensation_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyProfile" ADD CONSTRAINT "PharmacyProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutySchedule" ADD CONSTRAINT "DutySchedule_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyProfile"("organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyProduct" ADD CONSTRAINT "PharmacyProduct_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyProfile"("organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PharmacyProduct" ADD CONSTRAINT "PharmacyProduct_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyProfile"("organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PharmacyProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsoredPlacement" ADD CONSTRAINT "SponsoredPlacement_pharmacyId_fkey" FOREIGN KEY ("pharmacyId") REFERENCES "PharmacyProfile"("organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNotificationSettings" ADD CONSTRAINT "OrganizationNotificationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
