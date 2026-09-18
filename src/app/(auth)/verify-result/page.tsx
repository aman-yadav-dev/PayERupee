import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/modules/auth/infrastructure/auth";
import { getResolvedAuthDestination } from "@/modules/auth/application/destination-loader.service";
import { VerifyResultClient } from "./VerifyResultClient";

export default async function VerifyResultPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const errorParam = params.error;
  const successParam = params.success === "true";

  const session = await auth.api.getSession({ headers: await headers() });

  // If no transient parameters exist, redirect manual access to the correct state
  if (!errorParam && !successParam) {
    const destination = await getResolvedAuthDestination();
    redirect(destination);
  }

  // Transient semantics:
  // ?error=... always overrides to an error state.
  // ?success=true requires the session to actually be verified.
  let isError = !!errorParam;
  let isVerified = session?.user?.emailVerified === true;

  if (successParam && !isVerified) {
    isError = true;
  }

  const cookieStore = await cookies();
  const isFresh = cookieStore.has("payERupee_verification_fresh");
  let isAlreadyVerified = false;

  if (!isError && successParam && isVerified && !isFresh) {
    isAlreadyVerified = true;
  }

  const { getVerificationCooldownAction } = await import("@/actions/auth/cooldown");
  const { expiresAt } = await getVerificationCooldownAction();

  return (
    <VerifyResultClient
      isError={isError}
      isAlreadyVerified={isAlreadyVerified}
      userEmail={session?.user?.email || null}
      userId={session?.user?.id || null}
      serverExpiresAt={expiresAt}
    />
  );
}
