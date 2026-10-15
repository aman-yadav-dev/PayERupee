-- CreateEnum
CREATE TYPE "BanDestinationType" AS ENUM ('UPI', 'BANK_ACCOUNT');

-- CreateEnum
CREATE TYPE "BanStatus" AS ENUM ('ACTIVE', 'UNBANNED');

-- CreateEnum
CREATE TYPE "BanRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GlobalBanStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateTable
CREATE TABLE "merchant_bans" (
    "id" TEXT NOT NULL,
    "merchantProfileId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "unbannedById" TEXT,
    "destinationType" "BanDestinationType" NOT NULL,
    "identifierHash" VARCHAR(64) NOT NULL,
    "encryptedDestination" TEXT NOT NULL,
    "maskedDestination" VARCHAR(100) NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "status" "BanStatus" NOT NULL DEFAULT 'ACTIVE',
    "hashKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "encryptionKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "unbannedAt" TIMESTAMP(3),
    "unbanReason" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_bans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_ban_requests" (
    "id" TEXT NOT NULL,
    "merchantProfileId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "destinationType" "BanDestinationType" NOT NULL,
    "identifierHash" VARCHAR(64) NOT NULL,
    "encryptedDestination" TEXT NOT NULL,
    "maskedDestination" VARCHAR(100) NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "status" "BanRequestStatus" NOT NULL DEFAULT 'PENDING',
    "hashKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "encryptionKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" VARCHAR(255),
    "rejectionReason" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_ban_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_bans" (
    "id" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "removedById" TEXT,
    "sourceRequestId" TEXT,
    "destinationType" "BanDestinationType" NOT NULL,
    "identifierHash" VARCHAR(64) NOT NULL,
    "encryptedDestination" TEXT NOT NULL,
    "maskedDestination" VARCHAR(100) NOT NULL,
    "reason" VARCHAR(255) NOT NULL,
    "status" "GlobalBanStatus" NOT NULL DEFAULT 'ACTIVE',
    "hashKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "encryptionKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "removedAt" TIMESTAMP(3),
    "removalReason" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_bans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "merchant_bans_merchantProfileId_status_idx" ON "merchant_bans"("merchantProfileId", "status");

-- CreateIndex
CREATE INDEX "merchant_bans_destinationType_identifierHash_idx" ON "merchant_bans"("destinationType", "identifierHash");

-- CreateIndex
CREATE INDEX "merchant_bans_identifierHash_status_idx" ON "merchant_bans"("identifierHash", "status");

-- CreateIndex
CREATE INDEX "global_ban_requests_status_createdAt_idx" ON "global_ban_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "global_ban_requests_merchantProfileId_status_idx" ON "global_ban_requests"("merchantProfileId", "status");

-- CreateIndex
CREATE INDEX "global_ban_requests_destinationType_identifierHash_idx" ON "global_ban_requests"("destinationType", "identifierHash");

-- CreateIndex
CREATE UNIQUE INDEX "global_bans_sourceRequestId_key" ON "global_bans"("sourceRequestId");

-- CreateIndex
CREATE INDEX "global_bans_destinationType_identifierHash_idx" ON "global_bans"("destinationType", "identifierHash");

-- CreateIndex
CREATE INDEX "global_bans_status_idx" ON "global_bans"("status");

-- CreateIndex (Partial Unique Indexes for Concurrency & Deduplication)
CREATE UNIQUE INDEX "merchant_bans_active_unique_idx" ON "merchant_bans"("merchantProfileId", "destinationType", "identifierHash") WHERE "status" = 'ACTIVE';

-- CreateIndex (Partial Unique Indexes for Concurrency & Deduplication)
CREATE UNIQUE INDEX "global_bans_active_unique_idx" ON "global_bans"("destinationType", "identifierHash") WHERE "status" = 'ACTIVE';

-- CreateIndex (Partial Unique Indexes for Concurrency & Deduplication)
CREATE UNIQUE INDEX "global_ban_requests_pending_unique_idx" ON "global_ban_requests"("merchantProfileId", "destinationType", "identifierHash") WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "merchant_bans" ADD CONSTRAINT "merchant_bans_merchantProfileId_fkey" FOREIGN KEY ("merchantProfileId") REFERENCES "merchant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_bans" ADD CONSTRAINT "merchant_bans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_bans" ADD CONSTRAINT "merchant_bans_unbannedById_fkey" FOREIGN KEY ("unbannedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_ban_requests" ADD CONSTRAINT "global_ban_requests_merchantProfileId_fkey" FOREIGN KEY ("merchantProfileId") REFERENCES "merchant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_ban_requests" ADD CONSTRAINT "global_ban_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_ban_requests" ADD CONSTRAINT "global_ban_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_bans" ADD CONSTRAINT "global_bans_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_bans" ADD CONSTRAINT "global_bans_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_bans" ADD CONSTRAINT "global_bans_sourceRequestId_fkey" FOREIGN KEY ("sourceRequestId") REFERENCES "global_ban_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
