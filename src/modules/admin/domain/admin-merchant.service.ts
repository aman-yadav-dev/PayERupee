import { db } from "@/infrastructure/database/db";
import { logAction } from "@/modules/audit/domain/audit.service";
import { AccountStatus, AuditActorType, AuditEntity, AuditAction } from "@prisma/client";
import { triggerImmediateEmailDispatch } from "@/modules/notifications/application/email-outbox.dispatcher";

export class AdminMerchantNotFoundError extends Error {
  constructor() {
    super("Merchant profile not found");
    this.name = "AdminMerchantNotFoundError";
  }
}

export class AdminMerchantStateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminMerchantStateConflictError";
  }
}

/**
 * Approves a merchant account, transitioning it from PENDING to ACTIVE.
 * Records the action in the audit log atomically.
 */
export async function approveMerchantAccount(adminUserId: string, merchantProfileId: string) {
  const result = await db.$transaction(async (tx) => {
    // 1. Fetch current state to determine precise error (404 vs 409)
    const profile = await tx.merchantProfile.findUnique({
      where: { id: merchantProfileId },
      select: { id: true, accountStatus: true, user: { select: { email: true, name: true } } }
    });

    if (!profile) {
      throw new AdminMerchantNotFoundError();
    }

    if (profile.accountStatus !== AccountStatus.PENDING) {
      throw new AdminMerchantStateConflictError(`Cannot approve merchant with status: ${profile.accountStatus}`);
    }

    // 2. Perform conditional atomic update for concurrency safety
    const result = await tx.merchantProfile.updateMany({
      where: {
        id: merchantProfileId,
        accountStatus: AccountStatus.PENDING
      },
      data: {
        accountStatus: AccountStatus.ACTIVE
      }
    });

    if (result.count === 0) {
      throw new AdminMerchantStateConflictError("Merchant status changed concurrently before approval could complete.");
    }

    // 3. Create Audit log
    await logAction({
      actorType: AuditActorType.ADMIN,
      actorId: adminUserId,
      entityType: AuditEntity.MERCHANT_PROFILE,
      entityId: merchantProfileId,
      action: AuditAction.APPROVE,
      metadata: { previousStatus: AccountStatus.PENDING }
    }, tx);

    // 4. Dispatch Email
    if (profile.user?.email && profile.user?.name) {
      const { env } = await import("@/config/env");
      await tx.outboxEvent.create({
        data: {
          referenceId: "ACCOUNT_APPROVED_" + merchantProfileId,
          referenceType: "EMAIL_DISPATCH",
          payload: {
            to: profile.user.email,
            subject: "Your PayERupee Account is Active",
            templateId: "ACCOUNT_APPROVED",
            templateVariables: {
              name: profile.user.name,
              ctaLink: env.BETTER_AUTH_URL + "/dashboard"
            }
          }
        }
      });
    }

    return { 
      success: true, 
      merchantProfileId, 
      accountStatus: AccountStatus.ACTIVE 
    };
  });

  triggerImmediateEmailDispatch();
  return result;
}


/**
 * Suspends a merchant account, transitioning it to SUSPENDED.
 * Revokes all active browser sessions transactionally.
 * Records the action in the audit log atomically.
 */
export async function suspendMerchantAccount(adminUserId: string, merchantProfileId: string) {
  return await db.$transaction(async (tx) => {
    const profile = await tx.merchantProfile.findUnique({
      where: { id: merchantProfileId },
      select: { id: true, accountStatus: true, userId: true }
    });

    if (!profile) {
      throw new AdminMerchantNotFoundError();
    }

    if (profile.accountStatus === AccountStatus.SUSPENDED) {
      return { success: true, merchantProfileId, accountStatus: AccountStatus.SUSPENDED };
    }

    if (profile.accountStatus === AccountStatus.DELETED) {
      throw new AdminMerchantStateConflictError("Cannot suspend a deleted account.");
    }

    const previousStatus = profile.accountStatus;

    const result = await tx.merchantProfile.updateMany({
      where: {
        id: merchantProfileId,
        accountStatus: { in: [AccountStatus.ACTIVE, AccountStatus.PENDING] }
      },
      data: {
        accountStatus: AccountStatus.SUSPENDED
      }
    });

    if (result.count === 0) {
      throw new AdminMerchantStateConflictError("Merchant status changed concurrently before suspension could complete.");
    }

    await tx.session.deleteMany({
      where: { userId: profile.userId }
    });

    await logAction({
      actorType: AuditActorType.ADMIN,
      actorId: adminUserId,
      entityType: AuditEntity.MERCHANT_PROFILE,
      entityId: merchantProfileId,
      action: AuditAction.SUSPEND,
      metadata: { previousStatus }
    }, tx);

    return { 
      success: true, 
      merchantProfileId, 
      accountStatus: AccountStatus.SUSPENDED 
    };
  });
}
