-- AlterTable
ALTER TABLE "payouts" ADD COLUMN     "vpa" VARCHAR(100),
ALTER COLUMN "accountNumber" DROP NOT NULL,
ALTER COLUMN "ifscCode" DROP NOT NULL,
ALTER COLUMN "accountHolderName" DROP NOT NULL;
