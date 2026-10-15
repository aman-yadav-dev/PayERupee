-- AlterTable
ALTER TABLE "system_settings" ALTER COLUMN "minPayoutAmount" SET DEFAULT 1.0000,
ALTER COLUMN "maxPayoutAmount" SET DEFAULT 10000000.0000;

-- CreateTable
CREATE TABLE "payout_fee_rules" (
    "id" TEXT NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "minAmount" DECIMAL(18,4) NOT NULL,
    "maxAmount" DECIMAL(18,4) NOT NULL,
    "fee" DECIMAL(18,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_fee_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payout_fee_rules_paymentMode_isActive_idx" ON "payout_fee_rules"("paymentMode", "isActive");
