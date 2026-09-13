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
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError"; // Must match "ForbiddenError" for controllers catching it by name, but actually let's just export a new one.
  }
}

export async function authenticateApiKey(authHeader: string | null): Promise<string> {
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
      isActive: true,
      expiresAt: true,
      merchantProfile: {
        select: {
          accountStatus: true,
          kycApplication: {
            select: { status: true }
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
    throw new ApiForbiddenError("No merchant profile associated with this API key");
  }

  if (apiKey.merchantProfile.accountStatus !== "ACTIVE") {
    throw new ApiForbiddenError("Merchant account is not active");
  }

  if (apiKey.merchantProfile.kycApplication?.status !== "APPROVED") {
    throw new ApiForbiddenError("Merchant KYC is not approved");
  }

  // Update lastUsedAt in the background (fire-and-forget) to not block the request
  db.apiKey.update({
    where: { keyHash },
    data: { lastUsedAt: new Date() }
  }).catch(() => {});

  return apiKey.merchantProfileId;
}
