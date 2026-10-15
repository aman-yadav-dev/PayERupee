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
  public code?: string;
  public details?: string;
  public action?: string;

  constructor(message = "Forbidden", options?: { code?: string, details?: string, action?: string }) {
    super(message);
    this.name = "ForbiddenError";
    this.code = options?.code;
    this.details = options?.details;
    this.action = options?.action;
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
    throw new ForbiddenError("No merchant profile associated with this user", {
      code: "NO_MERCHANT_PROFILE",
      details: "Your session is valid, but your account does not have a merchant profile configured.",
      action: "Complete your merchant registration."
    });
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
    throw new ForbiddenError("Merchant account is not active", {
      code: "ACCOUNT_NOT_ACTIVE",
      details: `Your account status is not active.`,
      action: "Please contact support to activate your account."
    });
  }
  return context;
}

/**
 * Ensures the merchant KYC is APPROVED.
 */
export async function requireKycApproved(req: NextRequest | Request) {
  const context = await requireMerchantContext(req);
  if (context.kycStatus !== "APPROVED") {
    throw new ForbiddenError("Merchant KYC is not approved", {
      code: "KYC_NOT_APPROVED",
      details: `You cannot access this resource until KYC is fully approved.`,
      action: "Complete KYC verification in your dashboard."
    });
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
    throw new ForbiddenError("Merchant account is not active", {
      code: "ACCOUNT_NOT_ACTIVE",
      details: `Your account status is not active.`,
      action: "Please contact support to activate your account."
    });
  }

  if (context.kycStatus !== "APPROVED") {
    throw new ForbiddenError("Merchant KYC is not approved", {
      code: "KYC_NOT_APPROVED",
      details: `You cannot access this resource until KYC is fully approved.`,
      action: "Complete KYC verification in your dashboard."
    });
  }

  return {
    userId: context.userId,
    merchantProfileId: context.merchantProfileId
  };
}

/**
 * Ensures the authenticated user has the ADMIN or SUPER_ADMIN role.
 */
export async function requireAdmin(req: NextRequest | Request) {
  const session = await authenticateSession(req);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    throw new ForbiddenError("Admin access required", {
      code: "ADMIN_ACCESS_REQUIRED",
      details: "This endpoint requires administrative privileges.",
      action: "Sign in with an administrator account."
    });
  }

  return session;
}

/**
 * Ensures the authenticated user has the SUPER_ADMIN role.
 */
export async function requireSuperAdmin(req: NextRequest | Request) {
  const session = await authenticateSession(req);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });

  if (!user || user.role !== "SUPER_ADMIN") {
    throw new ForbiddenError("Super Admin access required", {
      code: "SUPER_ADMIN_ACCESS_REQUIRED",
      details: "This endpoint requires super administrative privileges.",
      action: "Sign in with a super administrator account."
    });
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
