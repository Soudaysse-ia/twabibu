-- Chaque entrée du dossier médical connaît la structure qui l'a écrite (règle de consentement, SPEC-13).
ALTER TABLE "Allergy" ADD COLUMN "organizationId" UUID;
ALTER TABLE "MedicalHistoryItem" ADD COLUMN "organizationId" UUID;
ALTER TABLE "Vaccination" ADD COLUMN "organizationId" UUID;
ALTER TABLE "CurrentTreatment" ADD COLUMN "organizationId" UUID, ADD COLUMN "authorId" UUID;
ALTER TABLE "Vital" ADD COLUMN "organizationId" UUID, ADD COLUMN "authorId" UUID;
ALTER TABLE "FollowUpPlan" ADD COLUMN "organizationId" UUID;
ALTER TABLE "Prescription" ADD COLUMN "notes" TEXT;
