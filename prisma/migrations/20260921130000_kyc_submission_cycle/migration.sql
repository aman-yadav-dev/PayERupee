-- CreateTable
CREATE TABLE "kyc_submission_cycles" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "formVersionId" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "isCurrentCycle" BOOLEAN NOT NULL DEFAULT true,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING_SUBMISSION',
    "rejectionReason" TEXT,
    "allowResubmission" BOOLEAN NOT NULL DEFAULT false,
    "reviewerId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_submission_cycles_pkey" PRIMARY KEY ("id")
);

-- Seed Cycle 1
INSERT INTO "kyc_submission_cycles" (
    "id", "applicationId", "formVersionId", "cycleNumber", "isCurrentCycle",
    "status", "rejectionReason", "allowResubmission", "reviewerId",
    "submittedAt", "reviewedAt", "createdAt", "updatedAt"
)
SELECT 
    gen_random_uuid()::text, "id", "formVersionId", 1, true,
    "status", "rejectionReason", "allowResubmission", "reviewerId",
    "submittedAt", "reviewedAt", "createdAt", "updatedAt"
FROM "kyc_applications";

-- DropForeignKey
ALTER TABLE "kyc_answers" DROP CONSTRAINT "kyc_answers_applicationId_fkey";
ALTER TABLE "kyc_documents" DROP CONSTRAINT "kyc_documents_applicationId_fkey";
ALTER TABLE "kyc_applications" DROP CONSTRAINT "kyc_applications_formVersionId_fkey";
ALTER TABLE "kyc_applications" DROP CONSTRAINT "kyc_applications_reviewerId_fkey";

-- Alter kyc_answers
ALTER TABLE "kyc_answers" ADD COLUMN "submissionCycleId" TEXT;
UPDATE "kyc_answers" a SET "submissionCycleId" = c."id" FROM "kyc_submission_cycles" c WHERE a."applicationId" = c."applicationId";
ALTER TABLE "kyc_answers" ALTER COLUMN "submissionCycleId" SET NOT NULL;
ALTER TABLE "kyc_answers" DROP COLUMN "applicationId";

-- Alter kyc_documents
ALTER TABLE "kyc_documents" ADD COLUMN "submissionCycleId" TEXT;
UPDATE "kyc_documents" d SET "submissionCycleId" = c."id" FROM "kyc_submission_cycles" c WHERE d."applicationId" = c."applicationId";
ALTER TABLE "kyc_documents" ALTER COLUMN "submissionCycleId" SET NOT NULL;
ALTER TABLE "kyc_documents" DROP COLUMN "applicationId";

-- Alter kyc_applications
ALTER TABLE "kyc_applications" 
DROP COLUMN "allowResubmission",
DROP COLUMN "formVersionId",
DROP COLUMN "rejectionReason",
DROP COLUMN "reviewedAt",
DROP COLUMN "reviewerId",
DROP COLUMN "status",
DROP COLUMN "submissionCount",
DROP COLUMN "submittedAt";

-- Indexes and Constraints
CREATE INDEX "kyc_submission_cycles_applicationId_isCurrentCycle_idx" ON "kyc_submission_cycles"("applicationId", "isCurrentCycle");
CREATE UNIQUE INDEX "kyc_submission_cycles_applicationId_cycleNumber_key" ON "kyc_submission_cycles"("applicationId", "cycleNumber");
CREATE UNIQUE INDEX "kyc_submission_cycles_active_unique" ON "kyc_submission_cycles"("applicationId") WHERE "isCurrentCycle" = true;

CREATE UNIQUE INDEX "kyc_answers_submissionCycleId_fieldDefinitionId_key" ON "kyc_answers"("submissionCycleId", "fieldDefinitionId");
CREATE INDEX "kyc_documents_submissionCycleId_idx" ON "kyc_documents"("submissionCycleId");

-- Foreign Keys
ALTER TABLE "kyc_submission_cycles" ADD CONSTRAINT "kyc_submission_cycles_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "kyc_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kyc_submission_cycles" ADD CONSTRAINT "kyc_submission_cycles_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "kyc_form_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kyc_submission_cycles" ADD CONSTRAINT "kyc_submission_cycles_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "kyc_answers" ADD CONSTRAINT "kyc_answers_submissionCycleId_fkey" FOREIGN KEY ("submissionCycleId") REFERENCES "kyc_submission_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_submissionCycleId_fkey" FOREIGN KEY ("submissionCycleId") REFERENCES "kyc_submission_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
