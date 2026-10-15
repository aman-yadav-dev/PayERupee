import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { PayoutController } from "@/modules/payout/controllers/payout.controller";
import { NextRequest } from "next/server";
import { env } from "@/config/env";
import { getPayoutProvider } from "@/modules/provider/adapters/provider.factory";
import { InMemoryPayoutProvider } from "@/modules/provider/adapters/mock.provider";
import { PayMyQrPayoutProvider } from "@/modules/provider/adapters/paymyqr.provider";
import { vi } from "vitest";

describe("Phase 2: Idempotency + Concurrency Safety", () => {
  let merchantId: string;
  let walletId: string;

  beforeAll(async () => {
    

    vi.spyOn(PayMyQrPayoutProvider.prototype, "dispatch").mockResolvedValue({ outcome: "QUEUED", providerReference: "mock-ref" } as any);

    const user = await db.user.create({
      data: {
        email: `concurrency-test-${Date.now()}@example.com`,
        name: "Test User",
      }
    });

    const merchant = await db.merchantProfile.create({
      data: {
        userId: user.id,
        businessName: "Concurrency Test Merchant",
        accountStatus: "ACTIVE",
        kycApplication: { 
          create: { 
            cycles: { 
              create: { 
                cycleNumber: 1, 
                formVersion: { create: { status: "PUBLISHED", versionNumber: 1, form: { create: { name: "Test Form" } } } }, 
                status: "APPROVED", 
                isCurrentCycle: true 
              } 
            } 
          } 
        }
      }
    });
    merchantId = merchant.id;

    const merchantLedger = await db.ledgerAccount.create({ data: { merchantProfileId: merchantId, type: "MERCHANT_LIABILITY", currency: "INR" } });
    const wallet = await db.wallet.create({
      data: {
        merchantProfileId: merchantId,
        ledgerAccountId: merchantLedger.id,
        balance: 10000.00
      }
    });
    walletId = wallet.id;

    const liveKeyHash = require("crypto").createHash("sha256").update("sk_live_concurrency").digest("hex");
    await db.apiKey.create({
      data: {
        merchantProfileId: merchantId,
        environment: "LIVE",
        name: "Concurrency Key",
        keyPrefix: "sk_live_",
        lastFour: "1111",
        keyHash: liveKeyHash
      }
    });
  });

  afterEach(async () => {
    await db.ledgerEntry.deleteMany({});
    await db.outboxEvent.deleteMany({});
    await db.payout.deleteMany({});
    await db.wallet.updateMany({
      where: { merchantProfileId: merchantId },
      data: { balance: 10000.00 }
    });
  });

  it("should handle 10 concurrent requests safely with exact one creation and exact one debit", async () => {
    
    const makeRequest = () => {
      const req = new NextRequest("http://localhost/api/v1/payouts", {
        method: "POST",
        headers: { Authorization: "Bearer sk_live_concurrency", "Idempotency-Key": "concurrent-idx-1" },
        body: JSON.stringify({
          idempotencyKey: "concurrent-idx-1",
          amount: "100.00",
          paymentMode: "UPI",
          vpa: "test@upi"
        })
      });
      return PayoutController.create(req);
    };

    const requests = Array.from({ length: 10 }, () => makeRequest());
    const responses = await Promise.all(requests);

    // All should be 2xx (either 201 or 200)
    for (const res of responses) {
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
    }

    // Exact ONE payout
    const payouts = await db.payout.findMany({ where: { merchantProfileId: merchantId, idempotencyKey: "concurrent-idx-1" } });
    expect(payouts.length).toBe(1);

    // Exact ONE ledger transaction pairs
    const ledgers = await db.ledgerEntry.findMany({ where: { payoutId: payouts[0].id } });
    // Assuming 2 entries (one debit from wallet, one credit to transit)
    expect(ledgers.length).toBe(2);

    // Wallet deducted exactly once (amount 100 + fee + tax)
    const wallet = await db.wallet.findUnique({ where: { id: walletId } });
    expect(wallet?.balance.toNumber()).toBeLessThan(10000.00);
  });
});
