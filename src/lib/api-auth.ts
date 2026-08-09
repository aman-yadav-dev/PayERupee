import { db } from "@/lib/db";
import crypto from "crypto";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function authenticateApiKey(authHeader: string | null): Promise<string> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid Authorization header");
  }

  const rawKey = authHeader.replace("Bearer ", "").trim();
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash },
    select: { merchantProfileId: true, isActive: true }
  });

  if (!apiKey || !apiKey.isActive) {
    throw new UnauthorizedError("Invalid or revoked API Key");
  }

  // Update lastUsedAt in the background (fire-and-forget) to not block the request
  db.apiKey.update({
    where: { keyHash },
    data: { lastUsedAt: new Date() }
  }).catch(() => {});

  return apiKey.merchantProfileId;
}
