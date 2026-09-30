import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getResolvedAuthDestination } from "@/modules/auth/application/destination-loader.service";
import AuthOnboardingLayout from "@/components/auth/AuthOnboardingLayout";

export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const destination = await getResolvedAuthDestination();

  // The (setup) route group houses /kyc/start, /kyc/under-review, /kyc/rejected, /pending-approval
  // If their resolved destination is not one of these, redirect them away.
  const setupRoutes = ["/kyc/start", "/kyc/under-review", "/kyc/rejected", "/pending-approval"];
  
  if (!setupRoutes.includes(destination)) {
    redirect(destination);
  }

  return (
    <AuthOnboardingLayout>
      {children}
    </AuthOnboardingLayout>
  );
}
