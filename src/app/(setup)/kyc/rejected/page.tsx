import React from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getResolvedAuthDestination } from "@/modules/auth/application/destination-loader.service";
import { requireMerchantContext } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import RejectedClient from "./RejectedClient";

export default async function KycRejectedPage() {
  const destination = await getResolvedAuthDestination();
  
  if (destination !== "/kyc/rejected") {
    redirect(destination);
  }

  const req = new Request("http://localhost", { headers: await headers() });
  const context = await requireMerchantContext(req as any);
  
  const application = await db.kycApplication.findUnique({
    where: { merchantProfileId: context.merchantProfileId },
    include: { cycles: { where: { isCurrentCycle: true }, take: 1 } }
  });

  const activeCycle = application?.cycles?.[0];
  const rejectionReason = activeCycle?.rejectionReason;
  const allowResubmission = activeCycle?.allowResubmission;

  return (
    <RejectedClient 
      rejectionReason={rejectionReason} 
      allowResubmission={allowResubmission} 
    />
  );
}
