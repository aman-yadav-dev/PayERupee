import { redirect } from "next/navigation";
import { getResolvedAuthDestination } from "@/modules/auth/application/destination-loader.service";

export default async function VerifyEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const destination = await getResolvedAuthDestination();

  // Enforce authoritative state
  if (destination !== "/verify-email") {
    redirect(destination);
  }

  return <>{children}</>;
}
