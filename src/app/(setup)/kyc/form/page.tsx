import React from 'react';
import { redirect } from 'next/navigation';
import { headers } from "next/headers";
import { getResolvedAuthDestination } from '@/modules/auth/application/destination-loader.service';
import { requireMerchantContext } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { DynamicKycForm } from '@/components/merchant/kyc/DynamicKycForm';
import { KycShell } from "@/components/merchant/kyc/KycShell";

export default async function KycFormPage() {
  const destination = await getResolvedAuthDestination();
  
  let isAllowed = false;
  
  if (destination === '/kyc/start') {
    const req = new Request("http://localhost", { headers: await headers() });
    try {
      const context = await requireMerchantContext(req as any);
      const app = await db.kycApplication.findUnique({
        where: { merchantProfileId: context.merchantProfileId },
        include: { cycles: { where: { isCurrentCycle: true }, take: 1 } }
      });
      if (app && app.cycles[0]?.status === "PENDING_SUBMISSION") {
        isAllowed = true;
      }
    } catch (e) {
      // Ignored
    }
  } else if (destination === '/kyc/rejected') {
    const req = new Request("http://localhost", { headers: await headers() });
    try {
      const context = await requireMerchantContext(req as any);
      const app = await db.kycApplication.findUnique({
        where: { merchantProfileId: context.merchantProfileId },
        include: { cycles: { where: { isCurrentCycle: true }, take: 1 } }
      });
      if (app?.cycles?.[0]?.allowResubmission) {
        isAllowed = true;
      }
    } catch (e) {
      // Ignored, isAllowed remains false
    }
  }

  if (!isAllowed) {
    redirect(destination);
  }

  return (
    <KycShell maxWidth="max-w-[560px]" doThisLaterHref="/kyc/start">
      <DynamicKycForm />
    </KycShell>
  );
}
