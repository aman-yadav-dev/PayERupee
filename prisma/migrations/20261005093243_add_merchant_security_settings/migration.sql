-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('IP_BLOCKED', 'API_AMOUNT_LIMIT_EXCEEDED', 'SUSPICIOUS_IP_ACTIVITY', 'SUSPICIOUS_UPI_ACTIVITY', 'SUSPICIOUS_BANK_ACCOUNT_ACTIVITY', 'NEW_LOGIN', 'SECURITY_SETTING_CHANGED');

-- CreateEnum
CREATE TYPE "SecuritySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('IP', 'UPI', 'BANK_ACCOUNT');

-- CreateTable
CREATE TABLE "merchant_security_settings" (
    "id" TEXT NOT NULL,
    "merchantProfileId" TEXT NOT NULL,
    "ipWhitelistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedIps" TEXT[],
    "maxApiPayoutEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxApiPayoutAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "suspiciousAlertsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "suspiciousThreshold" INTEGER NOT NULL DEFAULT 10,
    "suspiciousWindowSeconds" INTEGER NOT NULL DEFAULT 60,
    "suspiciousIpEnabled" BOOLEAN NOT NULL DEFAULT true,
    "suspiciousUpiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "suspiciousBankAccountEnabled" BOOLEAN NOT NULL DEFAULT true,
    "suspiciousEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "suspiciousAlertCooldown" INTEGER NOT NULL DEFAULT 300,
    "loginNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_security_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "merchantProfileId" TEXT NOT NULL,
    "eventType" "SecurityEventType" NOT NULL,
    "severity" "SecuritySeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "ipAddress" TEXT,
    "fingerprint" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suspicious_activity_logs" (
    "id" TEXT NOT NULL,
    "merchantProfileId" TEXT NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suspicious_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merchant_security_settings_merchantProfileId_key" ON "merchant_security_settings"("merchantProfileId");

-- CreateIndex
CREATE INDEX "security_events_merchantProfileId_eventType_idx" ON "security_events"("merchantProfileId", "eventType");

-- CreateIndex
CREATE INDEX "security_events_merchantProfileId_createdAt_idx" ON "security_events"("merchantProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "security_events_ipAddress_idx" ON "security_events"("ipAddress");

-- CreateIndex
CREATE INDEX "suspicious_activity_logs_merchantProfileId_activityType_fin_idx" ON "suspicious_activity_logs"("merchantProfileId", "activityType", "fingerprint", "createdAt");

-- AddForeignKey
ALTER TABLE "merchant_security_settings" ADD CONSTRAINT "merchant_security_settings_merchantProfileId_fkey" FOREIGN KEY ("merchantProfileId") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_merchantProfileId_fkey" FOREIGN KEY ("merchantProfileId") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
