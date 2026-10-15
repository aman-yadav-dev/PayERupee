
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/infrastructure/database/db";
import { PayoutController } from "@/modules/payout/controllers/payout.controller";
import { NextRequest } from "next/server";
import crypto from "crypto";

const uuidv4 = () => crypto.randomUUID();

describe("Payout Pricing Tiers & Boundaries", () => {
  let merchantId: string;
  let testKey: string;
  let walletId: string;

  beforeAll(async () => {
    const user = await db.user.create({ data: { email: "pricing-" + Date.now() + "@ex.com", name: "Pricing Test" }});
    const { onboardMerchant } = await import("@/modules/merchant/domain/merchant.service");
    const { merchantProfile, wallet } = await onboardMerchant({ userId: user.id, businessName: "Pricing Test" });
    merchantId = merchantProfile.id;
    walletId = wallet.id;

    await db.merchantProfile.update({
      where: { id: merchantId },
      data: {
        accountStatus: "ACTIVE",
        kycApplication: {
          create: { cycles: { create: { status: "APPROVED", isCurrentCycle: true, cycleNumber: 1, formVersion: { create: { status: "PUBLISHED", versionNumber: 1, form: { create: { name: "Dummy Form 2" } } } } } } }
        }
      }
    });

    await db.wallet.update({
      where: { id: walletId },
      data: { balance: 100000000.0, version: { increment: 1 } }
    });

    await db.systemSetting.upsert({
      where: { id: "GLOBAL_SETTINGS" },
      update: { minPayoutAmount: 1, maxPayoutAmount: 10000000, taxPercentage: 18 },
      create: { id: "GLOBAL_SETTINGS", minPayoutAmount: 1, maxPayoutAmount: 10000000, taxPercentage: 18 }
    });

    

    testKey = "sk_test_" + Date.now();
    const testKeyHash = require("crypto").createHash("sha256").update(testKey).digest("hex");
    await db.apiKey.create({
      data: {
        merchantProfileId: merchantId,
        environment: "TEST",
        name: "Test Key Pricing",
        keyPrefix: "sk_test_",
        lastFour: testKey.slice(-4),
        keyHash: testKeyHash
      }
    });
  });

  const makeReq = (amount: number | string, mode: "UPI" | "IMPS") => {
    return new NextRequest("http://localhost/api/v1/payouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${testKey}`,
        "Idempotency-Key": uuidv4()
      },
      body: JSON.stringify(mode === "UPI" ? {
        amount,
        paymentMode: "UPI",
        vpa: "test@upi"
      } : {
        amount,
        paymentMode: "IMPS",
        accountNumber: "1234567890",
        ifscCode: "HDFC0001234",
        accountHolderName: "Test"
      })
    });
  };

  const expectFee = async (amount: number | string, mode: "UPI" | "IMPS", expectedFee: number) => {
    const res = await PayoutController.create(makeReq(amount, mode));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(Number(data.payout.fee)).toBe(expectedFee);
    
    // Tax = fee * 18%
    const expectedTax = Number((expectedFee * 0.18).toFixed(4));
    expect(Number(data.payout.tax)).toBeCloseTo(expectedTax, 2);

    // Total = amount + fee + tax
    const expectedTotal = Number(amount) + expectedFee + expectedTax;
    expect(Number(data.payout.totalDebitAmount)).toBeCloseTo(expectedTotal, 2);
  };

  it("calculates UPI pricing tiers correctly", async () => {
    await expectFee(1, "UPI", 2.50);
    await expectFee(1000, "UPI", 2.50);
    await expectFee(1000.01, "UPI", 10.45);
    await expectFee(1001, "UPI", 10.45);
    await expectFee(10000, "UPI", 10.45);
    await expectFee(10000.01, "UPI", 20.80);
    await expectFee(10001, "UPI", 20.80);
    await expectFee(10000000, "UPI", 20.80);
  });

  it("calculates IMPS pricing tiers correctly", async () => {
    await expectFee(1, "IMPS", 6.00);
    await expectFee(1000, "IMPS", 6.00);
    await expectFee(1000.01, "IMPS", 10.45);
    await expectFee(1001, "IMPS", 10.45);
    await expectFee(10000, "IMPS", 10.45);
    await expectFee(10000.01, "IMPS", 20.80);
    await expectFee(10001, "IMPS", 20.80);
    await expectFee(10000000, "IMPS", 20.80);
  });

  it("rejects amount below 1", async () => {
    const res = await PayoutController.create(makeReq(0.99, "UPI"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Amount must be between");
  });

  it("rejects amount above 10000000", async () => {
    const res = await PayoutController.create(makeReq(10000000.01, "IMPS"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Amount must be between");
  });

  it("should validate pricing configuration cleanly", async () => {
    const { validatePricingConfiguration } = await import("@/modules/payout/application/pricing.validator");
    await expect(validatePricingConfiguration()).resolves.toBe(true);
  });

  it("should safely reject overlaps via application-level validation if manually inserted", async () => {
    const { PaymentMode } = await import("@prisma/client");
    const badRule = await db.payoutFeeRule.create({
      data: {
        paymentMode: PaymentMode.UPI,
        minAmount: 500,
        maxAmount: 2000,
        fee: 5.00,
        isActive: true
      }
    });

    const { validatePricingConfiguration } = await import("@/modules/payout/application/pricing.validator");
    await expect(validatePricingConfiguration()).rejects.toThrow(/Expected exactly 6 active rules|Overlapping or duplicate rules/);

    // Cleanup
    await db.payoutFeeRule.delete({ where: { id: badRule.id } });
  });

  it("should reject multiple active rules matching an amount in resolvePayoutFee", async () => {
    const { PaymentMode } = await import("@prisma/client");
    const badRule = await db.payoutFeeRule.create({
      data: {
        paymentMode: PaymentMode.UPI,
        minAmount: 1,
        maxAmount: 1000,
        fee: 2.50,
        isActive: true
      }
    });

    const res = await PayoutController.create(makeReq(500, "UPI"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(JSON.stringify(data)).toMatch(/Configuration error: Multiple overlapping active rules/i);

    // cleanup
    await db.payoutFeeRule.delete({ where: { id: badRule.id } });
  });
});
