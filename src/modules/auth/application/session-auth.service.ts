import { NextRequest } from "next/server";
import { auth } from "@/modules/auth/infrastructure/auth";
import { db } from "@/infrastructure/database/db";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface AuthenticatedMerchantContext {
  userId: string;
  merchantProfileId: string;
}

/**
 * Validates the Better Auth session and derives the MerchantProfileId.
 * This ensures the client cannot forge their tenant scope.
 */
export async function authenticateSession(req: NextRequest | Request): Promise<AuthenticatedMerchantContext> {
  const session = await auth.api.getSession({
    headers: req.headers
  });

  if (!session || !session.user) {
    throw new UnauthorizedError("Invalid or missing session");
  }

  const merchantProfile = await db.merchantProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, accountStatus: true }
  });

  if (!merchantProfile) {
    throw new ForbiddenError("No merchant profile associated with this user");
  }

  return {
    userId: session.user.id,
    merchantProfileId: merchantProfile.id
  };
}
