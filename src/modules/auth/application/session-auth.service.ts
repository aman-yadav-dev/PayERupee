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
 * Low-level authentication. Only validates that a valid session exists.
 * Does not check roles or merchant profiles.
 */
export async function authenticateSession(req: NextRequest | Request) {
  const session = await auth.api.getSession({
    headers: req.headers
  });

  if (!session || !session.user) {
    throw new UnauthorizedError("Invalid or missing session");
  }

  return session;
}

/**
 * Ensures the authenticated user has a MerchantProfile and the MERCHANT role.
 */
export async function requireMerchantContext(req: NextRequest | Request) {
  const session = await authenticateSession(req);

  const merchantProfile = await db.merchantProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      accountStatus: true,
      kycApplication: { 
        include: {
          cycles: {
            where: { isCurrentCycle: true },
            take: 1,
            select: { status: true }
          }
        }
      }
    }
  });

  if (!merchantProfile) {
    throw new ForbiddenError("No merchant profile associated with this user");
  }

  return {
    userId: session.user.id,
    merchantProfileId: merchantProfile.id,
    accountStatus: merchantProfile.accountStatus,
    kycStatus: merchantProfile.kycApplication?.cycles?.[0]?.status || null
  };
}

/**
 * Ensures the merchant account is ACTIVE.
 */
export async function requireAccountApproved(req: NextRequest | Request) {
  const context = await requireMerchantContext(req);
  if (context.accountStatus !== "ACTIVE") {
    throw new ForbiddenError("Merchant account is not active");
  }
  return context;
}

/**
 * Ensures the merchant KYC is APPROVED.
 */
export async function requireKycApproved(req: NextRequest | Request) {
  const context = await requireMerchantContext(req);
  if (context.kycStatus !== "APPROVED") {
    throw new ForbiddenError("Merchant KYC is not approved");
  }
  return context;
}

/**
 * FULL MERCHANT ACCESS GATE
 * Ensures account is ACTIVE and KYC is APPROVED.
 */
export async function requireFullMerchantAccess(req: NextRequest | Request): Promise<AuthenticatedMerchantContext> {
  const context = await requireMerchantContext(req);

  if (context.accountStatus !== "ACTIVE") {
    throw new ForbiddenError("Merchant account is not active");
  }

  if (context.kycStatus !== "APPROVED") {
    throw new ForbiddenError("Merchant KYC is not approved");
  }

  return {
    userId: context.userId,
    merchantProfileId: context.merchantProfileId
  };
}

/**
 * Ensures the authenticated user has the ADMIN role.
 */
export async function requireAdmin(req: NextRequest | Request) {
  const session = await authenticateSession(req);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  if (!user || user.role !== "ADMIN") {
    throw new ForbiddenError("Admin access required");
  }

  return session;
}

/**
 * Hard-revoke all browser sessions for a given user.
 */
export async function revokeAllUserSessions(userId: string, tx?: any) {
  const dbClient = tx || db;
  await dbClient.session.deleteMany({
    where: { userId }
  });
}
