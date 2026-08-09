import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { Prisma, LedgerAccountType, PaymentMode, LedgerEntryPurpose, ReferenceType } from "@prisma/client";
import { adjustWalletBalance, OptimisticLockError, reconcileWalletBalance, ReconciliationError } from "@/lib/services/wallet.service";
import { onboardMerchant } from "@/lib/services/merchant.service";
import { createPayout, processPayout, failPayout, handlePayoutSuccess, IllegalStateTransitionError, SystemConfigurationError } from "@/lib/services/payout.service";
import crypto from "crypto";

const uuidv4 = () => crypto.randomUUID();
const Decimal = Prisma.Decimal;

describe("Payout Service Integration (Phase 3.1)", () => {
  let merchantId: string;
  let walletId: string;
  let liabilityAccountId: string;

  beforeAll(async () => {
    // Fail-Closed Test relies on settings existing for the rest of tests
    // so we ensure it exists here.
    const settingsCount = await db.systemSetting.count();
    if (settingsCount === 0) {
      await db.systemSetting.create({
        data: {
          id: "GLOBAL_SETTINGS",
          upiPayoutFee: new Decimal(0),
          impsPayoutFee: new Decimal(5),
          neftPayoutFee: new Decimal(3),
          rtgsPayoutFee: new Decimal(10),
          taxPercentage: new Decimal(18),
          minPayoutAmount: new Decimal(10),
          maxPayoutAmount: new Decimal(500000),
        }
      });
    }

    const dummyUser = await db.user.create({
      data: {
        email: `payout-vitest-${Date.now()}@example.com`,
        name: "Payout Test User",
      },
    });

    const { wallet, liabilityAccount, merchantProfile } = await onboardMerchant({
      userId: dummyUser.id,
      businessName: "Payout Vitest Business",
    });

    merchantId = merchantProfile.id;
    walletId = wallet.id;
    liabilityAccountId = liabilityAccount.id;

    const transit = await db.ledgerAccount.findFirst({ where: { type: LedgerAccountType.SYSTEM_TRANSIT }});
    const { createLedgerEntry } = await import("@/lib/services/ledger.service");
    await createLedgerEntry({
      amount: "100000.0",
      creditAccountId: liabilityAccount.id,
      debitAccountId: transit!.id,
      purpose: LedgerEntryPurpose.MANUAL_ADJUSTMENT,
      referenceType: ReferenceType.SYSTEM,
      description: "Seed Funds"
    });
    
    await db.wallet.update({
      where: { id: wallet.id },
      data: { balance: 100000.0, version: { increment: 1 } }
    });
  });



  const validPayoutData = () => ({
    idempotencyKey: uuidv4(),
    amount: "100.0",
    paymentMode: PaymentMode.IMPS,
    accountNumber: "1234567890",
    ifscCode: "HDFC0001234",
    accountHolderName: "Test Beneficiary",
    beneficiaryPhone: "+919876543210",
  });

  it("should reject invalid Zod inputs (IFSC, E.164, min/max)", async () => {
    const invalidIfsc = { ...validPayoutData(), ifscCode: "BADIFSC" };
    await expect(createPayout(merchantId, invalidIfsc)).rejects.toThrow();

    const invalidPhone = { ...validPayoutData(), beneficiaryPhone: "98765" };
    await expect(createPayout(merchantId, invalidPhone)).rejects.toThrow();

    const underMin = { ...validPayoutData(), amount: "5.0" };
    await expect(createPayout(merchantId, underMin)).rejects.toThrow("Amount must be between 10 and 500000");
  });

  it("should enforce P2002 idempotency seamlessly", async () => {
    const data = validPayoutData();
    const { payout: p1, isNew: isNew1 } = await createPayout(merchantId, data);
    const { payout: p2, isNew: isNew2 } = await createPayout(merchantId, data);
    
    expect(isNew1).toBe(true);
    expect(isNew2).toBe(false);
    expect(p1.id).toBe(p2.id);
  });

  it("should handle true concurrency identically via Promise.allSettled", async () => {
    const data = validPayoutData();
    const promises = Array.from({ length: 10 }).map(() => createPayout(merchantId, data));
    const results = await Promise.allSettled(promises);
    
    const fulfilled = results.filter(r => r.status === "fulfilled");
    const rejected = results.filter(r => r.status === "rejected");
    
    expect(fulfilled.length).toBe(10);
    expect(rejected.length).toBe(0);

    const ids = new Set(fulfilled.map((r: any) => r.value.payout.id));
    expect(ids.size).toBe(1); // Exactly 1 unique payout created
  });

  it("should completely rollback on insufficient funds", async () => {
    const huge = { ...validPayoutData(), amount: "499999.0" }; // Allowed by Max, but exceeds Wallet
    const { payout } = await createPayout(merchantId, huge);
    
    await expect(processPayout(payout.id, merchantId)).rejects.toThrow("Insufficient wallet balance.");
    
    const { expectedBalance, wallet } = await reconcileWalletBalance(walletId, merchantId);
    expect(wallet.balance.toString()).toBe(expectedBalance.toString());
  });

  it("should successfully process, transition states, and reconcile exact mathematical boundaries", async () => {
    const data = validPayoutData();
    const { payout } = await createPayout(merchantId, data);
    
    const processed = await processPayout(payout.id, merchantId);
    expect(processed.status).toBe("PROCESSING");

    const { expectedBalance, wallet } = await reconcileWalletBalance(walletId, merchantId);
    expect(wallet.balance.toString()).toBe(expectedBalance.toString());

    const success = await handlePayoutSuccess(payout.id, merchantId, "PROVIDER_REF_1");
    expect(success.status).toBe("SUCCESS");
  });

  it("should successfully reverse, output compensating ledgers, and block duplicate reversals", async () => {
    const data = validPayoutData();
    const { payout } = await createPayout(merchantId, data);
    await processPayout(payout.id, merchantId);
    
    const reversed = await failPayout(payout.id, merchantId, "Failed by provider");
    expect(reversed.status).toBe("FAILED");

    const { expectedBalance, wallet } = await reconcileWalletBalance(walletId, merchantId);
    expect(wallet.balance.toString()).toBe(expectedBalance.toString());

    await expect(failPayout(payout.id, merchantId, "Double")).rejects.toThrow(IllegalStateTransitionError);
  });
});
