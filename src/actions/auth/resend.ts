"use server";

import { auth } from "@/modules/auth/infrastructure/auth";
import { headers } from "next/headers";
import { getActiveSystemLease } from "@/modules/system/domain/lease.service";

/**
 * Server action to resend the verification email and return the authoritative cooldown.
 */
export async function resendVerificationEmailAction(callbackURL: string): Promise<{ success: boolean; error?: string; expiresAt?: string | null }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user?.id || !session?.user?.email) {
      return { success: false, error: "Unauthorized" };
    }

    // Call Better Auth's internal API to resend the email
    await auth.api.sendVerificationEmail({
      body: {
        email: session.user.email,
        callbackURL
      },
      headers: await headers()
    });

    // By the time this returns, the callback has executed (or was queued).
    // If the mailer succeeded, the SystemLease was created.
    const lease = await getActiveSystemLease(`email_verification_cooldown_${session.user.id}`);

    if (lease) {
      return { success: true, expiresAt: lease.expiresAt.toISOString() };
    }

    return { success: false, error: "Failed to dispatch email via SMTP." };
  } catch (error) {
    return { success: false, error: "An unexpected error occurred." };
  }
}
