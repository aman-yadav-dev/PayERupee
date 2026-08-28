import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { PayoutReconciler } from "@/modules/payout/application/payout.reconciler";
import { db } from "@/infrastructure/database/db";
import { PayoutStatus, Prisma, LedgerAccountType } from "@prisma/client";
import { InMemoryPayoutProvider } from "@/modules/provider/adapters/mock.provider";
import { onboardMerchant } from "@/modules/merchant/domain/merchant.service";
import { adjustWalletBalance } from "@/modules/wallet/domain/wallet.service";
import { handlePayoutSuccess, failPayout } from "@/modules/payout/domain/payout.service";
import { acquireSystemLease } from "@/modules/system/domain/lease.service";

describe("PayoutReconciler", () => {
  let merchantId: string;
  let walletId: string;

  beforeAll(async () => {
    // Heavy cleanup once per suite
    await db.auditLog.deleteMany({});
    await db.ledgerEntry.deleteMany({});
    await db.payout.deleteMany({});
    await db.wallet.deleteMany({});
    await db.apiKey.deleteMany({});
    await db.ledgerAccount.deleteMany({
      where: { merchantProfileId: { not: null } }
    });
    await db.merchantProfile.deleteMany({});
    await db.user.deleteMany({});

    // Create System Accounts if missing
    await db.ledgerAccount.upsert({
      where: { id: "system_revenue" },
      update: {},
      create: {
        id: "system_revenue",
        type: LedgerAccountType.SYSTEM_REVENUE,
        currency: "INR"
      }
    });

    await db.ledgerAccount.upsert({
      where: { id: "system_transit" },
      update: {},
      create: {
        id: "system_transit",
        type: LedgerAccountType.SYSTEM_TRANSIT,
        currency: "INR"
      }
    });

    // Create Global Settings if missing
    await db.systemSetting.upsert({
      where: { id: "GLOBAL_SETTINGS" },
      create: {
        id: "GLOBAL_SETTINGS",
        upiPayoutFee: new Prisma.Decimal(0),
        impsPayoutFee: new Prisma.Decimal(5),
        neftPayoutFee: new Prisma.Decimal(3),
        rtgsPayoutFee: new Prisma.Decimal(10),
        taxPercentage: new Prisma.Decimal(18),
        minPayoutAmount: new Prisma.Decimal(10),
        maxPayoutAmount: new Prisma.Decimal(500000),
        reconciliationThresholdMins: 0,
      },
      update: {
        reconciliationThresholdMins: 0,
      }
    });

    const user = await db.user.create({
      data: {
        email: `test_reconciler_${Date.now()}@test.com`,
        name: "Test Reconciler User",
      },
    });

    const { wallet, merchantProfile } = await onboardMerchant({
      userId: user.id,
      businessName: "Test Merchant",
      phone: "9999999999"
    });
    merchantId = merchantProfile.id;
    walletId = wallet.id;
  });

  beforeEach(async () => {
    InMemoryPayoutProvider.reset();
    await db.ledgerEntry.deleteMany({});
    await db.payout.deleteMany({});
    await db.outboxEvent.deleteMany({});
    await db.systemLease.deleteMany({});
  });

  const createStalePayout = async (status: PayoutStatus, outboxStatus: any = "COMPLETED") => {
    const pastDate = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
    
    const payout = await db.payout.create({
      data: {
        merchantProfileId: merchantId,
        idempotencyKey: `stale_${status}_${Date.now()}`,
        amount: new Prisma.Decimal(100),
        totalDebitAmount: new Prisma.Decimal(100),
        accountNumber: "123",
        ifscCode: "ABC",
        paymentMode: "IMPS",
        accountHolderName: "Test",
        status: status,
        updatedAt: pastDate,
      }
    });

    if (status === "PROCESSING") {
      await db.outboxEvent.create({
        data: {
          referenceType: "PAYOUT_DISPATCH",
          referenceId: payout.id,
          status: outboxStatus,
          updatedAt: pastDate
        }
      });
    }

    return payout;
  };

  it("finalizes PROCESSING payout when provider returns SUCCESS", async () => {
    const payout = await createStalePayout(PayoutStatus.PROCESSING);
    
    InMemoryPayoutProvider.nextStatusOutcome = "SUCCESS";
    
    const result = await PayoutReconciler.reconcileStalePayouts("worker-1");
    expect(result?.processingSettled).toBe(1);

    const updatedPayout = await db.payout.findUnique({ where: { id: payout.id } });
    expect(updatedPayout?.status).toBe(PayoutStatus.SUCCESS);
  });

  it("refunds PROCESSING payout when provider returns REJECTED", async () => {
    const payout = await createStalePayout(PayoutStatus.PROCESSING);
    
    InMemoryPayoutProvider.nextStatusOutcome = "REJECTED";
    
    const result = await PayoutReconciler.reconcileStalePayouts("worker-1");
    expect(result?.processingFailed).toBe(1);

    const updatedPayout = await db.payout.findUnique({ where: { id: payout.id } });
    expect(updatedPayout?.status).toBe(PayoutStatus.FAILED);
  });

  it("skips polling and leaves PROCESSING unchanged if Outbox is PENDING", async () => {
    const payout = await createStalePayout(PayoutStatus.PROCESSING, "PENDING");
    
    InMemoryPayoutProvider.nextStatusOutcome = "SUCCESS"; // Would succeed if polled
    
    const result = await PayoutReconciler.reconcileStalePayouts("worker-1");
    
    // Result object has processingSettled: 0, because it skipped it
    expect(result?.processingSettled).toBe(0);
    expect(result?.processingUnresolved).toBe(0);

    const updatedPayout = await db.payout.findUnique({ where: { id: payout.id } });
    expect(updatedPayout?.status).toBe(PayoutStatus.PROCESSING);
  });

  it("leaves PROCESSING payout unchanged when provider returns NOT_FOUND", async () => {
    const payout = await createStalePayout(PayoutStatus.PROCESSING);
    
    InMemoryPayoutProvider.nextStatusOutcome = "NOT_FOUND";
    
    const result = await PayoutReconciler.reconcileStalePayouts("worker-1");
    expect(result?.processingUnresolved).toBe(1);

    const updatedPayout = await db.payout.findUnique({ where: { id: payout.id } });
    expect(updatedPayout?.status).toBe(PayoutStatus.PROCESSING);
  });

  it("skips running if lease is already held by another worker", async () => {
    await acquireSystemLease("PAYOUT_RECONCILER", "worker-other", 300);

    const result = await PayoutReconciler.reconcileStalePayouts("worker-1");
    expect(result).toBeNull(); // Lease not acquired
  });
});
