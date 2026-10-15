-- DropIndex
DROP INDEX "payouts_merchantProfileId_idempotencyKey_key";

-- AlterTable
ALTER TABLE "payouts" ADD COLUMN     "environment" "Environment" NOT NULL DEFAULT 'LIVE';

-- CreateIndex
CREATE UNIQUE INDEX "payouts_merchantProfileId_idempotencyKey_environment_key" ON "payouts"("merchantProfileId", "idempotencyKey", "environment");

