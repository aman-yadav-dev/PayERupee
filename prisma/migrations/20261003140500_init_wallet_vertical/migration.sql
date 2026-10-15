-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED');

-- AlterEnum
ALTER TYPE "ReferenceType" ADD VALUE 'WITHDRAWAL';

-- AlterTable
ALTER TABLE "ledger_entries" ADD COLUMN     "withdrawalId" TEXT;

-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "minAddFundsAmount" DECIMAL(18,4) NOT NULL DEFAULT 100.0000,
ADD COLUMN     "minWithdrawAmount" DECIMAL(18,4) NOT NULL DEFAULT 500.0000;

-- CreateTable
CREATE TABLE "merchant_banks" (
    "id" TEXT NOT NULL,
    "merchantProfileId" TEXT NOT NULL,
    "accountNumber" VARCHAR(30) NOT NULL,
    "ifscCode" VARCHAR(11) NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "merchant_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "merchantProfileId" TEXT NOT NULL,
    "merchantBankId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "fee" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "tax" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "totalDebitAmount" DECIMAL(18,4) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'IMPS',
    "provider" "PayoutProvider",
    "providerReference" TEXT,
    "bankReference" TEXT,
    "notes" TEXT,
    "failureReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "merchant_banks_merchantProfileId_idx" ON "merchant_banks"("merchantProfileId");

-- CreateIndex
CREATE INDEX "merchant_banks_deletedAt_idx" ON "merchant_banks"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawals_bankReference_key" ON "withdrawals"("bankReference");

-- CreateIndex
CREATE INDEX "withdrawals_merchantProfileId_createdAt_idx" ON "withdrawals"("merchantProfileId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "withdrawals_status_idx" ON "withdrawals"("status");

-- CreateIndex
CREATE INDEX "withdrawals_deletedAt_idx" ON "withdrawals"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawals_merchantProfileId_idempotencyKey_key" ON "withdrawals"("merchantProfileId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_withdrawalId_purpose_key" ON "ledger_entries"("withdrawalId", "purpose");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "withdrawals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_banks" ADD CONSTRAINT "merchant_banks_merchantProfileId_fkey" FOREIGN KEY ("merchantProfileId") REFERENCES "merchant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_merchantProfileId_fkey" FOREIGN KEY ("merchantProfileId") REFERENCES "merchant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_merchantBankId_fkey" FOREIGN KEY ("merchantBankId") REFERENCES "merchant_banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
