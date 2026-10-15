import { db } from "@/infrastructure/database/db";
import crypto from "crypto";
import { ForbiddenError } from "./session-auth.service"; // Reuse from session-auth or export here

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

// Ensure ForbiddenError is available if not importing from session-auth. Let's just define it here to be safe and independent.
export class ApiForbiddenError extends Error {
  public code?: string;
  public details?: string;
  public action?: string;

  constructor(message = "Forbidden", options?: { code?: string, details?: string, action?: string }) {
    super(message);
    this.name = "ForbiddenError"; // Must match "ForbiddenError" for controllers catching it by name, but actually let's just export a new one.
    this.code = options?.code;
    this.details = options?.details;
    this.action = options?.action;
  }
}

export async function authenticateApiKey(authHeader: string | null): Promise<{ merchantProfileId: string, environment: "TEST" | "LIVE" }> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid Authorization header");
  }

  const rawKey = authHeader.replace("Bearer ", "").trim();
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  // Include merchant profile to verify account status and KYC
  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    select: {
      merchantProfileId: true,
      environment: true,
      isActive: true,
      expiresAt: true,
      merchantProfile: {
        select: {
          accountStatus: true,
          kycApplication: {
            select: {
              cycles: {
                where: { isCurrentCycle: true },
                select: { status: true }
              }
            }
          }
        }
      }
    }
  });

  if (!apiKey || !apiKey.isActive) {
    throw new UnauthorizedError("Invalid or revoked API Key");
  }

  if (apiKey.expiresAt !== null && apiKey.expiresAt < new Date()) {
    throw new UnauthorizedError("API Key has expired");
  }

  if (!apiKey.merchantProfile) {
    throw new ApiForbiddenError("No merchant profile associated with this API key", {
      code: "NO_MERCHANT_PROFILE",
      details: "Your API key is valid, but your account does not have a merchant profile configured.",
      action: "Complete your merchant registration."
    });
  }

  if (apiKey.merchantProfile.accountStatus !== "ACTIVE") {
    throw new ApiForbiddenError("Merchant account is not active", {
      code: "ACCOUNT_NOT_ACTIVE",
      details: `Your account status is ${apiKey.merchantProfile.accountStatus}.`,
      action: "Please contact support to activate your account."
    });
  }

  const currentCycle = apiKey.merchantProfile.kycApplication?.cycles?.[0];
  if (currentCycle?.status !== "APPROVED") {
    throw new ApiForbiddenError("Merchant KYC is not approved", {
      code: "KYC_NOT_APPROVED",
      details: `Your current KYC status is ${currentCycle?.status || "NOT_SUBMITTED"}. You cannot use the API until KYC is fully approved.`,
      action: "Complete KYC verification in your dashboard."
    });
  }

  // Update lastUsedAt in the background (fire-and-forget) to not block the request
  db.apiKey.update({
    where: { keyHash },
    data: { lastUsedAt: new Date() }
  }).catch(() => {});

  return { merchantProfileId: apiKey.merchantProfileId, environment: apiKey.environment as "TEST" | "LIVE" };
}
