import { db } from "@/infrastructure/database/db";
import crypto from "crypto";
import { Environment, AuditAction, AuditEntity, AuditActorType } from "@prisma/client";
import { logAction } from "@/modules/audit/domain/audit.service";

export class KeyLimitExceededError extends Error {
  constructor() {
    super("Active API key limit exceeded for this environment.");
    this.name = "KeyLimitExceededError";
  }
}

export class KeyNotFoundError extends Error {
  constructor() {
    super("API key not found.");
    this.name = "KeyNotFoundError";
  }
}

const MAX_ACTIVE_KEYS = 5;

export async function generateApiKey(merchantProfileId: string, name: string, environment: Environment) {
  return await db.$transaction(async (tx) => {
    // 1. Lock the merchant profile to serialize constraint checks
    await tx.merchantProfile.update({
      where: { id: merchantProfileId },
      data: { updatedAt: new Date() }
    });

    // 2. Count existing active keys for this environment
    const activeKeysCount = await tx.apiKey.count({
      where: {
        merchantProfileId,
        environment,
        isActive: true
      }
    });

    if (activeKeysCount >= MAX_ACTIVE_KEYS) {
      throw new KeyLimitExceededError();
    }

    // 3. Generate cryptographic key
    const rawEntropy = crypto.randomBytes(32).toString("hex");
    const keyPrefix = environment === Environment.TEST ? "sk_test_" : "sk_live_";
    const rawSecret = `${keyPrefix}${rawEntropy}`;
    
    const lastFour = rawSecret.slice(-4);
    const keyHash = crypto.createHash("sha256").update(rawSecret).digest("hex");

    // 4. Insert into database
    const apiKey = await tx.apiKey.create({
      data: {
        merchantProfileId,
        environment,
        name,
        keyPrefix,
        lastFour,
        keyHash,
        isActive: true
      }
    });

    // 5. Audit Log (NO SECRETS)
    await logAction({
      actorType: AuditActorType.MERCHANT,
      actorId: merchantProfileId, // Using merchant profile ID as actor for M2M context
      entityType: AuditEntity.API_KEY,
      entityId: apiKey.id,
      action: AuditAction.CREATE,
      metadata: {
        name,
        environment,
        lastFour
      }
    }, tx);

    // Filter out keyHash before returning the DTO
    const { keyHash: _droppedHash, ...safeApiKey } = apiKey;

    return {
      apiKey: safeApiKey,
      rawSecret
    };
  });
}

export async function listApiKeys(merchantProfileId: string) {
  const keys = await db.apiKey.findMany({
    where: { merchantProfileId },
    select: {
      id: true,
      name: true,
      environment: true,
      keyPrefix: true,
      lastFour: true,
      isActive: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return keys;
}

export async function revokeApiKey(merchantProfileId: string, apiKeyId: string) {
  return await db.$transaction(async (tx) => {
    const key = await tx.apiKey.findUnique({
      where: { id: apiKeyId, merchantProfileId }
    });

    if (!key) {
      throw new KeyNotFoundError();
    }

    if (!key.isActive) {
      // Idempotent return if already revoked
      return { success: true, message: "API key is already revoked." };
    }

    await tx.apiKey.update({
      where: { id: apiKeyId, merchantProfileId },
      data: {
        isActive: false,
        revokedAt: new Date()
      }
    });

    await logAction({
      actorType: AuditActorType.MERCHANT,
      actorId: merchantProfileId,
      entityType: AuditEntity.API_KEY,
      entityId: key.id,
      action: AuditAction.UPDATE,
      metadata: {
        name: key.name,
        environment: key.environment,
        lastFour: key.lastFour,
        status: "REVOKED"
      }
    }, tx);

    return { success: true, message: "API key revoked successfully." };
  });
}
