"use server";

import { auth } from "@/modules/auth/infrastructure/auth";
import { headers } from "next/headers";
import { getActiveSystemLease } from "@/modules/system/domain/lease.service";

/**
 * Retrieves the remaining cooldown for email verification dispatch.
 *
 * Returns the exact Date string of expiration if an active cooldown exists,
 * or null if no cooldown is active.
 */
export async function getVerificationCooldownAction(): Promise<{ expiresAt: string | null }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user?.id) {
      return { expiresAt: null };
    }

    const lease = await getActiveSystemLease(`email_verification_cooldown_${session.user.id}`);

    if (lease) {
      return { expiresAt: lease.expiresAt.toISOString() };
    }

    return { expiresAt: null };
  } catch (error) {
    return { expiresAt: null };
  }
}
