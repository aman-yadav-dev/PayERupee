-- CreateEnum
CREATE TYPE "MerchantType" AS ENUM ('INDIVIDUAL', 'PROPRIETOR', 'COMPANY', 'LLP');

-- CreateEnum
CREATE TYPE "KycFormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "KycDataType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'FILE');

-- CreateEnum
CREATE TYPE "KycInputType" AS ENUM ('TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX', 'FILE');

-- CreateEnum
CREATE TYPE "DocumentUploadStatus" AS ENUM ('PENDING', 'UPLOADED');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXHAUSTED');

-- AlterTable
ALTER TABLE "kyc_applications" ADD COLUMN     "allowResubmission" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "formVersionId" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewerId" TEXT,
ALTER COLUMN "documentUrls" DROP NOT NULL;

-- AlterTable
ALTER TABLE "merchant_profiles" ADD COLUMN     "merchantType" "MerchantType";

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "reconciliationThresholdMins" INTEGER NOT NULL DEFAULT 15;

-- CreateTable
CREATE TABLE "kyc_forms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_form_versions" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "KycFormStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_form_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_field_definitions" (
    "id" TEXT NOT NULL,
    "formVersionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "section" TEXT NOT NULL,
    "dataType" "KycDataType" NOT NULL,
    "inputType" "KycInputType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "applicableTypes" "MerchantType"[],
    "validationRules" JSONB,
    "selectOptions" JSONB,
    "fileRules" JSONB,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "kyc_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_answers" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_documents" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "DocumentUploadStatus" NOT NULL DEFAULT 'PENDING',
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_leases" (
    "resource" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_leases_pkey" PRIMARY KEY ("resource")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "payload" JSONB,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),
    "lockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kyc_form_versions_formId_versionNumber_key" ON "kyc_form_versions"("formId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_field_definitions_formVersionId_key_key" ON "kyc_field_definitions"("formVersionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_answers_applicationId_fieldDefinitionId_key" ON "kyc_answers"("applicationId", "fieldDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_documents_storageKey_key" ON "kyc_documents"("storageKey");

-- CreateIndex
CREATE INDEX "kyc_documents_applicationId_idx" ON "kyc_documents"("applicationId");

-- CreateIndex
CREATE INDEX "kyc_documents_status_createdAt_idx" ON "kyc_documents"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_referenceId_key" ON "outbox_events"("referenceId");

-- CreateIndex
CREATE INDEX "outbox_events_status_nextRunAt_idx" ON "outbox_events"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "outbox_events_lockedUntil_idx" ON "outbox_events"("lockedUntil");

-- AddForeignKey
ALTER TABLE "kyc_applications" ADD CONSTRAINT "kyc_applications_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "kyc_form_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_applications" ADD CONSTRAINT "kyc_applications_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_form_versions" ADD CONSTRAINT "kyc_form_versions_formId_fkey" FOREIGN KEY ("formId") REFERENCES "kyc_forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_field_definitions" ADD CONSTRAINT "kyc_field_definitions_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "kyc_form_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_answers" ADD CONSTRAINT "kyc_answers_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "kyc_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_answers" ADD CONSTRAINT "kyc_answers_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "kyc_field_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "kyc_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "kyc_field_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreatePartialUniqueIndex
CREATE UNIQUE INDEX "idx_published_form" ON "kyc_form_versions"("formId") WHERE status = 'PUBLISHED';

