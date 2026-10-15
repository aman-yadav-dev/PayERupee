import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getResolvedAuthDestination } from "@/modules/auth/application/destination-loader.service";
import { auth } from "@/modules/auth/infrastructure/auth";
import { MerchantLayoutWrapper } from "./MerchantLayoutWrapper";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const destination = await getResolvedAuthDestination();

  // Strict check: if the authoritative destination is not /dashboard, they are
  // not an ACTIVE approved merchant. Redirect them to their required state.
  if (destination !== "/dashboard") {
    redirect(destination);
  }

  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  return (
    <MerchantLayoutWrapper user={session?.user}>
      {children}
    </MerchantLayoutWrapper>
  );
}
