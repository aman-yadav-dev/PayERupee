-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "merchantProfileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_merchantProfileId_fkey" FOREIGN KEY ("merchantProfileId") REFERENCES "merchant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
