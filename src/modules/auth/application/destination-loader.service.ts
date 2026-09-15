import { headers } from "next/headers";
import { auth } from "@/modules/auth/infrastructure/auth";
import { db } from "@/infrastructure/database/db";
import { resolveAuthDestination, AuthDestination } from "./destination.service";
import { cache } from "react";

/**
 * Retrieves the authoritative server state and calculates the correct destination.
 * Wrapped in React cache() to deduplicate DB queries during a single Server Component render pass.
 */
export const getResolvedAuthDestination = cache(async (): Promise<AuthDestination> => {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    return resolveAuthDestination({ session: null, profile: null });
  }

  const profile = await db.merchantProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      kycApplication: {
        select: { status: true, allowResubmission: true }
      }
    }
  });

  return resolveAuthDestination({
    session: {
      user: {
        id: session.user.id,
        emailVerified: session.user.emailVerified
      }
    },
    profile: profile ? {
      accountStatus: profile.accountStatus,
      kycApplication: profile.kycApplication
    } : null
  });
});
