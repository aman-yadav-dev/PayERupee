import { db } from "@/lib/db";
import { UserRole, AccountStatus, LedgerAccountType, Currency, AuditActorType, AuditEntity, AuditAction, Prisma } from "@prisma/client";
import { logAction } from "./audit.service";

export type OnboardingInput = {
  userId: string;
  businessName?: string;
  phone?: string;
  address?: string;
};

export class MerchantExistsError extends Error {
  constructor() {
    super("Merchant profile already exists for this user.");
    this.name = "MerchantExistsError";
  }
}

/**
 * Executes the atomic merchant onboarding sequence.
 */
export async function onboardMerchant(input: OnboardingInput) {
  return await db.$transaction(async (tx) => {
    // 1. Verify merchant profile doesn't already exist
    const existing = await tx.merchantProfile.findUnique({
      where: { userId: input.userId },
    });
    if (existing) {
      throw new MerchantExistsError();
    }

    // 2. Mutate User.role only
    await tx.user.update({
      where: { id: input.userId },
      data: { role: UserRole.MERCHANT },
    });

    // 3. Create MerchantProfile
    const merchantProfile = await tx.merchantProfile.create({
      data: {
        userId: input.userId,
        businessName: input.businessName,
        phone: input.phone,
        address: input.address,
        accountStatus: AccountStatus.PENDING,
      },
    });

    // 4. Create Merchant Liability LedgerAccount
    const liabilityAccount = await tx.ledgerAccount.create({
      data: {
        merchantProfileId: merchantProfile.id,
        type: LedgerAccountType.MERCHANT_LIABILITY,
        currency: Currency.INR,
      },
    });

    // 5. Create Wallet linked to the LedgerAccount
    const wallet = await tx.wallet.create({
      data: {
        merchantProfileId: merchantProfile.id,
        ledgerAccountId: liabilityAccount.id,
        currency: Currency.INR,
        balance: 0.0,
      },
    });

    // 6. Audit Log
    await logAction({
      actorType: AuditActorType.SYSTEM,
      entityType: AuditEntity.MERCHANT_PROFILE,
      entityId: merchantProfile.id,
      action: AuditAction.CREATE,
      metadata: { userId: input.userId, walletId: wallet.id },
    }, tx);

    return { merchantProfile, liabilityAccount, wallet };
  });
}
