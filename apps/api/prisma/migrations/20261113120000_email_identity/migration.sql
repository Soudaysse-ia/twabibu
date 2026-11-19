-- Identité par e-mail (ADR-016) : le code de connexion part par e-mail, plus par SMS.
ALTER TABLE "OtpCode" RENAME COLUMN "phone" TO "recipient";
ALTER INDEX "OtpCode_phone_purpose_createdAt_idx" RENAME TO "OtpCode_recipient_purpose_createdAt_idx";
