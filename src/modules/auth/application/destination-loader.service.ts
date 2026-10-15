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

  const userRecord = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      merchantProfile: {
        include: {
          kycApplication: {
            include: {
              cycles: {
                where: { isCurrentCycle: true },
                take: 1,
                select: { status: true, allowResubmission: true }
              }
            }
          }
        }
      }
    }
  });

  const profile = userRecord?.merchantProfile ?? null;

  return resolveAuthDestination({
    session: {
      user: {
        id: session.user.id,
        emailVerified: session.user.emailVerified,
        role: userRecord?.role
      }
    },
    profile: profile ? {
      accountStatus: profile.accountStatus,
      kycApplication: profile.kycApplication ? {
        status: profile.kycApplication.cycles[0]?.status ?? "PENDING_SUBMISSION",
        allowResubmission: profile.kycApplication.cycles[0]?.allowResubmission ?? false
      } : null
    } : null
  });
});
