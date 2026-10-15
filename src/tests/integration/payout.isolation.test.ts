import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { PayoutController } from "@/modules/payout/controllers/payout.controller";
import { NextRequest } from "next/server";
import { env } from "@/config/env";
import { getPayoutProvider } from "@/modules/provider/adapters/provider.factory";
import { InMemoryPayoutProvider } from "@/modules/provider/adapters/mock.provider";
import { PayMyQrPayoutProvider } from "@/modules/provider/adapters/paymyqr.provider"; import { vi } from "vitest";

describe("Payout Isolation & Environment Flow", () => {
  let merchantId: string;
  let walletId: string;

  beforeAll(async () => {
    

    vi.spyOn(PayMyQrPayoutProvider.prototype, "dispatch").mockResolvedValue({ outcome: "QUEUED", providerReference: "mock-ref" });
    // Setup User
    const user = await db.user.create({
      data: {
        email: `isolation-test-${Date.now()}@example.com`,
        name: "Test User",
      }
    });

    // 1. Setup Merchant
    const merchant = await db.merchantProfile.create({
      data: {
        userId: user.id,
        businessName: "Isolation Test Merchant",
        accountStatus: "ACTIVE",
        kycApplication: { 
          create: { 
            cycles: { 
              create: { 
                cycleNumber: 1, 
                formVersion: { 
                  create: { 
                    status: "PUBLISHED", 
                    versionNumber: 1, 
                    form: { 
                      create: { 
                        name: "Test Form" 
                      } 
                    } 
                  } 
                }, 
                status: "APPROVED", 
                isCurrentCycle: true 
              } 
            } 
          } 
        }
      }
    });
    merchantId = merchant.id;

    // 4. Setup Merchant Wallet & Ledger
    const merchantLedger = await db.ledgerAccount.create({ data: { merchantProfileId: merchantId, type: "MERCHANT_LIABILITY", currency: "INR" } });
    const wallet = await db.wallet.create({
      data: {
        merchantProfileId: merchantId,
        ledgerAccountId: merchantLedger.id,
        balance: 1000.00
      }
    });
    walletId = wallet.id;

    // 5. Create TEST API Key
    const testRaw = "sk_test_12345";
    const testKeyHash = require("crypto").createHash("sha256").update(testRaw).digest("hex");
    await db.apiKey.create({
      data: {
        merchantProfileId: merchantId,
        environment: "TEST",
        name: "Test Key",
        keyPrefix: "sk_test_",
        lastFour: "2345",
        keyHash: testKeyHash
      }
    });

    // 6. Create LIVE API Key
    const liveRaw = "sk_live_67890";
    const liveKeyHash = require("crypto").createHash("sha256").update(liveRaw).digest("hex");
    await db.apiKey.create({
      data: {
        merchantProfileId: merchantId,
        environment: "LIVE",
        name: "Live Key",
        keyPrefix: "sk_live_",
        lastFour: "7890",
        keyHash: liveKeyHash
      }
    });

    // Global settings
    await db.systemSetting.upsert({
      where: { id: "GLOBAL_SETTINGS" },
      update: {},
      create: {
        id: "GLOBAL_SETTINGS",
        minPayoutAmount: 1,
        maxPayoutAmount: 10000000,
        impsPayoutFee: 5,
        upiPayoutFee: 0,
        taxPercentage: 18,
      }
    });
  });

  afterEach(async () => {
    // Only clean transactional data, not setup data!
    await db.ledgerEntry.deleteMany({});
    await db.outboxEvent.deleteMany({});
    await db.payout.deleteMany({});
    // Reset wallet balance
    await db.wallet.updateMany({
      where: { merchantProfileId: merchantId },
      data: { balance: 1000.00 }
    });
  });

  it("A,B,C,H,I,L: should enforce factory rules", () => {
    expect(getPayoutProvider("TEST")).toBeInstanceOf(InMemoryPayoutProvider);
    expect(getPayoutProvider("LIVE")).toBeInstanceOf(PayMyQrPayoutProvider);
  });

  it("D,E,F,G,J: should process TEST payout without deducting wallet or ledger", async () => {
    const req = new NextRequest("http://localhost/api/v1/payouts", {
      method: "POST",
      headers: { Authorization: "Bearer sk_test_12345", "Idempotency-Key": "idem-" + Date.now() },
      body: JSON.stringify({
        idempotencyKey: "test-idx-1",
        amount: "100.00",
        paymentMode: "UPI",
        vpa: "test@upi"
      })
    });

    const response = await PayoutController.create(req);
    expect(response.status).toBe(201);
    
    const body = await response.json();
    expect(body.success).toBe(true);

    const payoutId = body.payout.id;
    const dbPayout = await db.payout.findUnique({ where: { id: payoutId } });
    expect(dbPayout?.environment).toBe("TEST");

    // Wallet untouched
    const wallet = await db.wallet.findUnique({ where: { id: walletId } });
    expect(wallet?.balance.toNumber()).toBe(1000.00);

    // Ledger untouched
    const ledgers = await db.ledgerEntry.findMany({ where: { payoutId } });
    expect(ledgers.length).toBe(0);
  });

  it("K: should not allow request body to override TEST to LIVE", async () => {
    const req = new NextRequest("http://localhost/api/v1/payouts", {
      method: "POST",
      headers: { Authorization: "Bearer sk_test_12345", "Idempotency-Key": "idem-" + Date.now() },
      body: JSON.stringify({
        idempotencyKey: "test-idx-override",
        amount: "100.00",
        paymentMode: "UPI",
        vpa: "test@upi",
        environment: "LIVE" // Attempted injection
      })
    });

    const response = await PayoutController.create(req);
    const body = await response.json();
    
    const dbPayout = await db.payout.findUnique({ where: { id: body.payout.id } });
    expect(dbPayout?.environment).toBe("TEST"); // Safe
  });

  it("should process LIVE payout and deduct wallet", async () => {
    const req = new NextRequest("http://localhost/api/v1/payouts", {
      method: "POST",
      headers: { Authorization: "Bearer sk_live_67890", "Idempotency-Key": "idem-" + Date.now() },
      body: JSON.stringify({
        idempotencyKey: "live-idx-1",
        amount: "100.00",
        paymentMode: "UPI",
        vpa: "test@upi"
      })
    });

    const response = await PayoutController.create(req);
    const body = await response.json();

    const payoutId = body.payout.id;
    const dbPayout = await db.payout.findUnique({ where: { id: payoutId } });
    expect(dbPayout?.environment).toBe("LIVE");

    // For a LIVE payout, it attempts to fetch from PayMyQR but fails due to no mock in vitest environment (network error). 
    // The wallet is currently deducted.
    const wallet = await db.wallet.findUnique({ where: { id: walletId } });
    expect(wallet?.balance.toNumber()).toBeLessThan(1000.00);
  });
});
