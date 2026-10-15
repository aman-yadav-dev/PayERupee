import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/infrastructure/database/db";
import { PayoutController } from "@/modules/payout/controllers/payout.controller";
import { NextRequest } from "next/server";

describe("Payout API Contract (Fixes)", () => {
  let merchantId: string;
  let walletId: string;
  let testKey: string;

  beforeAll(async () => {
    

    // Setup
    const user = await db.user.create({
      data: {
        email: "payout-contract-" + Date.now() + "@example.com",
        name: "Contract Test User",
      },
    });

    
    if (!await db.ledgerAccount.findFirst({ where: { type: "SYSTEM_TRANSIT" } })) {
      await db.ledgerAccount.create({ data: { type: "SYSTEM_TRANSIT", isActive: true } });
    }
    if (!await db.ledgerAccount.findFirst({ where: { type: "SYSTEM_REVENUE" } })) {
      await db.ledgerAccount.create({ data: { type: "SYSTEM_REVENUE", isActive: true } });
    }
    const merchantProfile = await db.merchantProfile.create({
      data: {
        userId: user.id,
        businessName: "Contract Test",
        accountStatus: "ACTIVE",
          kycApplication: { create: { cycles: { create: { cycleNumber: 1, formVersion: { create: { versionNumber: 1, status: "PUBLISHED", form: { create: { name: "test" } } } }, status: "APPROVED", isCurrentCycle: true } } } },
        
      }
    });

    merchantId = merchantProfile.id;
    const la = await db.ledgerAccount.create({ data: { merchantProfileId: merchantId, type: "MERCHANT_LIABILITY", isActive: true } });
    await db.wallet.create({ data: { merchantProfileId: merchantId, ledgerAccountId: la.id, balance: "10000.00", version: 1, isActive: true } });

    const keyObj = await db.apiKey.create({
      data: {
        merchantProfileId: merchantId,
        environment: "TEST",
        name: "Test Key",
        keyHash: "dummy", keyPrefix: "sk_t", lastFour: "dummy"
      }
    });
    testKey = "sk_test_mocked_for_test_" + Date.now();
    await db.apiKey.update({
      where: { id: keyObj.id },
      data: { keyHash: require("crypto").createHash("sha256").update(testKey).digest("hex") }
    });

    const settingsCount = await db.systemSetting.count();
    if (settingsCount === 0) {
      await db.systemSetting.create({
        data: {
          id: "GLOBAL_SETTINGS",
          upiPayoutFee: 0,
          impsPayoutFee: 5,
          neftPayoutFee: 3,
          rtgsPayoutFee: 10,
          taxPercentage: 18,
          minPayoutAmount: 1,
          maxPayoutAmount: 10000000,
        }
      });
    }
  });

  const validBody = () => ({
    paymentMode: "IMPS",
    accountNumber: "1234567890",
    ifscCode: "HDFC0001234",
    accountHolderName: "John Doe",
  });

  it("should return 400 if Idempotency-Key header is missing", async () => {
    const req = new NextRequest("http://localhost/api/v1/payouts", {
      method: "POST",
      headers: { Authorization: "Bearer " + testKey },
      body: JSON.stringify({ ...validBody(), amount: 100 }),
    });
    const res = await PayoutController.create(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Missing or blank Idempotency-Key/);
  });

  it("should return 400 if Idempotency-Key header is blank", async () => {
    const req = new NextRequest("http://localhost/api/v1/payouts", {
      method: "POST",
      headers: { Authorization: "Bearer " + testKey, "Idempotency-Key": "   " },
      body: JSON.stringify({ ...validBody(), amount: 100 }),
    });
    const res = await PayoutController.create(req);
    expect(res.status).toBe(400);
  });

  it("should accept valid Idempotency-Key header and amount as number", async () => {
    const req = new NextRequest("http://localhost/api/v1/payouts", {
      method: "POST",
      headers: { Authorization: "Bearer " + testKey, "Idempotency-Key": "idem-" + Date.now() },
      body: JSON.stringify({ ...validBody(), amount: 100 }),
    });
    const res = await PayoutController.create(req);
    expect(res.status).toBe(201);
  });

  it("should accept valid Idempotency-Key header and amount as decimal string", async () => {
    const req = new NextRequest("http://localhost/api/v1/payouts", {
      method: "POST",
      headers: { Authorization: "Bearer " + testKey, "Idempotency-Key": "idem-str-" + Date.now() },
      body: JSON.stringify({ ...validBody(), amount: "100.50" }),
    });
    const res = await PayoutController.create(req);
    expect(res.status).toBe(201);
  });

  it("should safely reject NEFT payment mode with HTTP 400", async () => {
    const req = new NextRequest("http://localhost/api/v1/payouts", {
      method: "POST",
      headers: { Authorization: "Bearer " + testKey, "Idempotency-Key": "idem-neft-" + Date.now() },
      body: JSON.stringify({ ...validBody(), paymentMode: "NEFT" }),
    });
    const res = await PayoutController.create(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Validation failed/i);
    
  });

  it("should safely reject RTGS payment mode with HTTP 400", async () => {
    const req = new NextRequest("http://localhost/api/v1/payouts", {
      method: "POST",
      headers: { Authorization: "Bearer " + testKey, "Idempotency-Key": "idem-rtgs-" + Date.now() },
      body: JSON.stringify({ ...validBody(), paymentMode: "RTGS" }),
    });
    const res = await PayoutController.create(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Validation failed/i);
  });
  
  describe("Security IP Whitelisting", () => {
    const makeReq = (ip: string) => {
      const req = new NextRequest("http://localhost:3000/api/v1/payouts", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + testKey,
          "Idempotency-Key": "ip-sec-" + Date.now() + Math.random(),
        },
        body: JSON.stringify({
          amount: 10,
          paymentMode: "IMPS",
          accountNumber: "1234567890",
          ifscCode: "HDFC0001234",
          accountHolderName: "Test User"
        })
      });
      // Mock NextRequest ip property
      Object.defineProperty(req, 'ip', { value: ip, writable: false });
      return req;
    };

    it("should allow a whitelisted IPv4 address", async () => {
      await db.merchantSecuritySettings.upsert({
        where: { merchantProfileId: merchantId },
        create: { merchantProfileId: merchantId, ipWhitelistEnabled: true, allowedIps: ["192.168.1.100"] },
        update: { ipWhitelistEnabled: true, allowedIps: ["192.168.1.100"] }
      });

      const req = makeReq("192.168.1.100");
      const res = await PayoutController.create(req);
      expect(res.status).toBe(201);
    });

    it("should block a non-whitelisted IP and return structured IP_NOT_WHITELISTED error", async () => {
      await db.merchantSecuritySettings.update({
        where: { merchantProfileId: merchantId },
        data: { allowedIps: ["192.168.1.100"] }
      });

      const req = makeReq("203.0.113.50");
      const res = await PayoutController.create(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("IP_NOT_WHITELISTED");
      expect(json.error.message).toMatch(/IP validation failed/i);
      expect(json.error.detectedIp).toBe("203.0.113.50");
    });

    it("should allow a whitelisted IPv6 address", async () => {
      await db.merchantSecuritySettings.update({
        where: { merchantProfileId: merchantId },
        data: { allowedIps: ["192.168.1.100", "2001:0db8:85a3:0000:0000:8a2e:0370:7334"] }
      });

      const req = makeReq("2001:db8:85a3::8a2e:370:7334");
      const res = await PayoutController.create(req);
      expect(res.status).toBe(201);
    });

    it("should block when whitelist is empty but enabled and return structured IP_WHITELIST_EMPTY error", async () => {
      await db.merchantSecuritySettings.update({
        where: { merchantProfileId: merchantId },
        data: { allowedIps: [] }
      });

      const req = makeReq("192.168.1.100");
      const res = await PayoutController.create(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("IP_WHITELIST_EMPTY");
      expect(json.error.message).toMatch(/IP validation failed/i);
      expect(json.error.detectedIp).toBe("192.168.1.100");
    });
});
});
