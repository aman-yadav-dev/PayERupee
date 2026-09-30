import { getResolvedAuthDestination } from "@/modules/auth/application/destination-loader.service";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const destination = await getResolvedAuthDestination();
  
  if (destination !== "/onboarding") {
    redirect(destination);
  }
  
  return <>{children}</>;
}
