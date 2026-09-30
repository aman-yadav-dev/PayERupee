import React from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getResolvedAuthDestination } from "@/modules/auth/application/destination-loader.service";
import { requireMerchantContext } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import StartKycClient from "./StartKycClient";

export default async function KycStartPage() {
  const destination = await getResolvedAuthDestination();
  
  if (destination !== "/kyc/start") {
    redirect(destination);
  }

  // Determine if application exists for "Resume" vs "Start" wording
  const req = new Request("http://localhost", { headers: await headers() });
  const context = await requireMerchantContext(req as any);
  
  const application = await db.kycApplication.findUnique({
    where: { merchantProfileId: context.merchantProfileId },
    include: { merchantProfile: { select: { merchantType: true } } }
  });

  return <StartKycClient hasApplication={!!application} currentMerchantType={application?.merchantProfile?.merchantType || undefined} />;
}
