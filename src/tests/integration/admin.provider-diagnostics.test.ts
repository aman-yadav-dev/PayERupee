import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { PayMyQrPayoutProvider } from "@/modules/provider/adapters/paymyqr.provider";
import { env } from "@/config/env";
import { createPayout, failPayout } from "@/modules/payout/domain/payout.service";
import { PayoutController } from "@/modules/payout/controllers/payout.controller";
import { NextRequest } from "next/server";
import { GET as adminGetPayout } from "@/app/api/v1/admin/payouts/[id]/route";

// Mock auth services
vi.mock("@/modules/auth/application/api-auth.service", () => ({
  authenticateApiKey: vi.fn().mockResolvedValue({ merchantProfileId: "mocked-id", environment: "TEST" }),
  UnauthorizedError: class UnauthorizedError extends Error {}
}));

vi.mock("@/modules/auth/application/session-auth.service", () => ({
  requireAdmin: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
  ForbiddenError: class ForbiddenError extends Error {}
}));

import { requireAdmin } from "@/modules/auth/application/session-auth.service";
import { authenticateApiKey } from "@/modules/auth/application/api-auth.service";

describe("Provider Failure Diagnostics", () => {
  let merchantId = "";
  let merchantUserId = "";
  let merchantWalletId = "";

  beforeAll(async () => {
    env.PAYMYQR_SECURITY_TOKEN = "SECRET_TOKEN_XYZ";
    env.PAYMYQR_VENDOR_ID = "VENDOR_ID_ABC";

    const user = await db.user.create({
       data: {
         email: "test_merchant_" + Date.now() + "@test.com",
         name: "Test Merchant",
         role: "MERCHANT",
         merchantProfile: {
           create: {
             phone: "9998887776",
             wallet: {
               create: {
                 balance: 100,
                 currency: "INR",
                 ledgerAccount: {
                   create: {
                     type: "MERCHANT_LIABILITY",
                     currency: "INR"
                   }
                 }
               }
             }
           }
         }
       },
       include: {
         merchantProfile: {
           include: {
             wallet: true
           }
         }
       }
     });

    merchantUserId = user.id;
    merchantId = user.merchantProfile!.id;
    merchantWalletId = user.merchantProfile!.wallet!.ledgerAccountId;
    
    (authenticateApiKey as any).mockResolvedValue({ merchantProfileId: merchantId, environment: "TEST" });
  });

  afterAll(async () => {
    const payouts = await db.payout.findMany({ where: { merchantProfileId: merchantId } });
    await db.ledgerEntry.deleteMany({ where: { payoutId: { in: payouts.map(p => p.id) } } });
    await db.payout.deleteMany({ where: { merchantProfileId: merchantId } });
    if (merchantWalletId) {
       await db.wallet.deleteMany({ where: { merchantProfileId: merchantId } });
       await db.ledgerAccount.deleteMany({ where: { id: merchantWalletId } });
    }
    await db.merchantProfile.deleteMany({ where: { id: merchantId } });
    await db.user.deleteMany({ where: { id: merchantUserId } });
  });

  it("should capture 4xx response and sanitize token (A, B, D, E)", async () => {
    const provider = new PayMyQrPayoutProvider();
    
    vi.spyOn(provider as any, "httpRequest").mockResolvedValue({
       statusCode: 400,
       body: JSON.stringify({ 
          status: "error", 
          message: "Invalid account SECRET_TOKEN_XYZ for VENDOR_ID_ABC",
          error_code: "SECRET_TOKEN_XYZ_ERR",
          details: { token: "SECRET_TOKEN_XYZ", acct: "12345678" } 
       })
    });

    const result = await provider.dispatch("test_id_1", "100", "12345678", "IFSC000", "IMPS", "Test Name");
    expect(result.outcome).toBe("REJECTED");
    
    const details = result.providerFailureDetails;
    expect(details).toBeDefined();
    expect(details.httpStatus).toBe(400);
    expect(details.provider).toBe("PAYMYQR");

    const jsonStr = JSON.stringify(details);
    
    expect(jsonStr).not.toContain("SECRET_TOKEN_XYZ");
    expect(jsonStr).not.toContain("VENDOR_ID_ABC");
    expect(jsonStr).not.toContain("12345678"); 
    expect(jsonStr).toContain("[REDACTED_TOKEN]");
    expect(jsonStr).toContain("[REDACTED_VENDOR]");
    expect(jsonStr).toContain("[REDACTED_ACCOUNT]");
    
    expect(details.errorMessage).toContain("[REDACTED_TOKEN]");
    expect(details.errorCode).toContain("[REDACTED_TOKEN]");
  });

  it("should capture non-JSON safely (C)", async () => {
    const provider = new PayMyQrPayoutProvider();
    vi.spyOn(provider as any, "httpRequest").mockResolvedValue({
       statusCode: 400,
       body: "<html>Bad Gateway SECRET_TOKEN_XYZ VENDOR_ID_ABC 12345678</html>"
    });

    const result = await provider.dispatch("test_id_2", "100", "12345678", null, "IMPS", "Test Name");
    expect(result.providerFailureDetails.httpStatus).toBe(400);
    expect(result.providerFailureDetails.details).toContain("[REDACTED_TOKEN]");
    expect(result.providerFailureDetails.details).toContain("[REDACTED_VENDOR]");
    expect(result.providerFailureDetails.details).toContain("[REDACTED_ACCOUNT]");
    expect(result.providerFailureDetails.details).not.toContain("SECRET_TOKEN_XYZ");
  });

  it("should not expose diagnostics to merchants (F)", async () => {
    const req = new NextRequest("http://localhost/api/v1/payouts", {
       method: "POST",
       headers: { 
         "Authorization": "Bearer fake_key",
         "idempotency-key": "test-key-merch",
         "content-type": "application/json"
       },
       body: JSON.stringify({ amount: "10.00", paymentMode: "IMPS", accountNumber: "1234567890", ifscCode: "HDFC0000001", accountHolderName: "Test", merchantReference: "ref123" })
    });
    
    vi.spyOn(await import("@/modules/payout/domain/payout.service"), "createPayout").mockResolvedValue({
      payout: {
         id: "mock_payout_id",
         amount: 10,
         status: "FAILED",
         providerFailureDetails: { secret: "should_not_be_here" }
      },
      isNew: true
    } as any);
    
    vi.spyOn(await import("@/modules/payout/application/payout.orchestrator"), "dispatchPayout").mockResolvedValue({
         id: "mock_payout_id",
         amount: 10,
         status: "FAILED",
         providerFailureDetails: { secret: "should_not_be_here" }
    } as any);
    
    const res = await PayoutController.create(req);
    const body = await res.json();
    if(!body.payout) console.error("BODY:", body);
    expect(body.payout).toBeDefined();
    expect(body.payout.providerFailureDetails).toBeUndefined(); 
  });
     
  
  it("should enforce admin-only access (G, H)", async () => {
     const p = await db.payout.create({
       data: {
         merchantProfileId: merchantId,
         idempotencyKey: "test-admin-key",
         amount: 1,
         totalDebitAmount: 1,
         providerFailureDetails: { test: "data" }
       }
     });

     (requireAdmin as any).mockRejectedValueOnce(new (await import("@/modules/auth/application/session-auth.service")).UnauthorizedError());
     const req = new NextRequest("http://localhost/api/v1/admin/payouts/" + p.id);
     const res = await adminGetPayout(req, { params: Promise.resolve({ id: p.id }) });
     expect(res.status).toBe(401);

     (requireAdmin as any).mockResolvedValueOnce({ id: "admin1" });
     const res2 = await adminGetPayout(req, { params: Promise.resolve({ id: p.id }) });
     expect(res2.status).toBe(200);
     const body2 = await res2.json();
     expect(body2.payout.providerFailureDetails).toBeDefined();
  });

  it("should preserve FAILED + reversal and idempotency behavior (I, J)", async () => {
    const p = await db.payout.create({
       data: {
         merchantProfileId: merchantId,
         idempotencyKey: "test-fail-key",
         amount: 1,
         totalDebitAmount: 1,
         status: "PROCESSING"
       }
    });

    const failed = await failPayout(p.id, merchantId, "Payment provider rejected the payout request", { fake: "data" });
    expect(failed.status).toBe("FAILED");
    expect(failed.providerFailureDetails).toEqual({ fake: "data" });
    
    await expect(failPayout(p.id, merchantId, "Another reason", { fake: "data2" })).rejects.toThrowError("Cannot transition payout from FAILED to FAILED");
  });

  it("should capture IP validation failure safely", async () => {
    const provider = new PayMyQrPayoutProvider();
    vi.spyOn(provider as any, "httpRequest").mockResolvedValue({
       statusCode: 400,
       body: JSON.stringify({ 
          status: "error", 
          message: "IP validation failed",
          details: { token: "SECRET_TOKEN_XYZ", acct: "12345678" }
       })
    });

    const result = await provider.dispatch("test_id_ip", "100", "12345678", null, "IMPS", "Test Name");
    expect(result.outcome).toBe("REJECTED");
    expect(result.failureReason).toBe("IP validation failed");
    
    const details = result.providerFailureDetails;
    expect(details).toBeDefined();
    expect(details.httpStatus).toBe(400);
    
    const jsonStr = JSON.stringify(details);
    expect(jsonStr).toContain("[REDACTED_TOKEN]");
    expect(jsonStr).toContain("[REDACTED_ACCOUNT]");
    expect(jsonStr).not.toContain("SECRET_TOKEN_XYZ");
    expect(jsonStr).not.toContain("12345678");
  });
});
