import { getVerificationCooldownAction } from "@/actions/auth/cooldown";
import { VerifyEmailClient } from "./VerifyEmailClient";

export default async function VerifyEmailPage() {
  const { expiresAt } = await getVerificationCooldownAction();

  return (
    <VerifyEmailClient serverExpiresAt={expiresAt} />
  );
}
