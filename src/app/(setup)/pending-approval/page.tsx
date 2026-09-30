import React from "react";
import { redirect } from "next/navigation";
import { getResolvedAuthDestination } from "@/modules/auth/application/destination-loader.service";
import PendingApprovalClient from "./PendingApprovalClient";
import PendingApprovalPoller from "./PendingApprovalPoller";

export default async function PendingApprovalPage() {
  const destination = await getResolvedAuthDestination();
  
  // NOTE: This component handles both /pending-approval (which maps to APPROVED + PENDING)
  // as well as the ACTIVE fallback mapping in the resolver.
  if (destination !== "/pending-approval") {
    redirect(destination);
  }

  return (
    <>
      <PendingApprovalPoller />
      <PendingApprovalClient />
    </>
  );
}
