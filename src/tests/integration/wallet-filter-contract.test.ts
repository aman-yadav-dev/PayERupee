import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import { db } from "../../infrastructure/database/db";
import { GET as getExport } from "../../app/api/v1/merchant/wallet/export/route";
import { GET as getActivity } from "../../app/api/v1/merchant/wallet/activity/route";
import { NextRequest } from "next/server";
import { requireFullMerchantAccess } from "../../modules/auth/application/session-auth.service";

vi.mock("../../modules/auth/application/session-auth.service", () => ({
  requireFullMerchantAccess: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
  ForbiddenError: class ForbiddenError extends Error {}
}));

describe("Wallet Filter Contract (Activity vs Export)", () => {
  let merchantA: string;
  let bankA: string;

  beforeAll(async () => {
    const userA = await db.user.create({
      data: { email: `contract-A-${Date.now()}@test.com`, name: "Test User A", role: "MERCHANT" }
    });
    const profileA = await db.merchantProfile.create({
      data: { userId: userA.id, businessName: "Contract Test Merchant A", phone: `+91${Date.now().toString().slice(-10)}A` }
    });
    merchantA = profileA.id;

    const mbank = await db.merchantBank.create({
      data: { merchantProfileId: merchantA, accountHolderName: "A", accountNumber: "123", ifscCode: "ABC" }
    });
    bankA = mbank.id;

    // Seed Data
    await db.withdrawal.create({ data: { merchantProfile: { connect: { id: merchantA } }, merchantBank: { connect: { id: bankA } }, amount: 4999.99, providerReference: "WITH_FAI_4999", status: "FAILED", idempotencyKey: "IC1", totalDebitAmount: 4999.99 } });
    await db.withdrawal.create({ data: { merchantProfile: { connect: { id: merchantA } }, merchantBank: { connect: { id: bankA } }, amount: 5000, providerReference: "WITH_FAI_5000", status: "FAILED", idempotencyKey: "IC2", totalDebitAmount: 5000 } });
    await db.withdrawal.create({ data: { merchantProfile: { connect: { id: merchantA } }, merchantBank: { connect: { id: bankA } }, amount: 15000, providerReference: "WITH_FAI_15000", status: "FAILED", idempotencyKey: "IC3", totalDebitAmount: 15000 } });
    await db.withdrawal.create({ data: { merchantProfile: { connect: { id: merchantA } }, merchantBank: { connect: { id: bankA } }, amount: 20000, providerReference: "WITH_FAI_20000", status: "FAILED", idempotencyKey: "IC4", totalDebitAmount: 20000 } });
    await db.withdrawal.create({ data: { merchantProfile: { connect: { id: merchantA } }, merchantBank: { connect: { id: bankA } }, amount: 20000.01, providerReference: "WITH_FAI_20000_1", status: "FAILED", idempotencyKey: "IC5", totalDebitAmount: 20000.01 } });

    await db.fundRequest.create({ data: { merchantProfileId: merchantA, amount: 999.99, utrNumber: "FUND_SUC_999", paymentMode: "UPI", status: "APPROVED" } });
    await db.fundRequest.create({ data: { merchantProfileId: merchantA, amount: 1000, utrNumber: "FUND_SUC_1000", paymentMode: "UPI", status: "APPROVED" } });
    await db.fundRequest.create({ data: { merchantProfileId: merchantA, amount: 5000, utrNumber: "FUND_SUC_5000", paymentMode: "UPI", status: "APPROVED" } });
    await db.fundRequest.create({ data: { merchantProfileId: merchantA, amount: 10000, utrNumber: "FUND_SUC_10000", paymentMode: "UPI", status: "APPROVED" } });
    await db.fundRequest.create({ data: { merchantProfileId: merchantA, amount: 10000.01, utrNumber: "FUND_SUC_10000_1", paymentMode: "UPI", status: "APPROVED" } });
  });

  afterAll(async () => {
    await db.withdrawal.deleteMany({ where: { merchantProfileId: merchantA } });
    await db.fundRequest.deleteMany({ where: { merchantProfileId: merchantA } });
    await db.merchantBank.deleteMany({ where: { merchantProfileId: merchantA } });
    await db.merchantProfile.deleteMany({ where: { id: merchantA } });
    await db.user.deleteMany({ where: { email: { startsWith: "contract-" } } });
  });

  const getIdsFromActivity = async (query = "") => {
    (requireFullMerchantAccess as any).mockResolvedValue({ merchantProfileId: merchantA });
    const req = new NextRequest(`http://localhost/api/v1/merchant/wallet/activity${query}`);
    const res = await getActivity(req);
    const json = await res.json();
    return json.data.map((d: any) => d.reference).sort();
  };

  const getIdsFromExport = async (query = "") => {
    (requireFullMerchantAccess as any).mockResolvedValue({ merchantProfileId: merchantA });
    const req = new NextRequest(`http://localhost/api/v1/merchant/wallet/export${query}`);
    const res = await getExport(req);
    const text = await res.text();
    // parse CSV, ignore header
    const lines = text.trim().split("\n").slice(1);
    // Use a regex that splits on commas but ignores commas inside double quotes
    return lines.map(l => {
      const parts = l.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      let ref = parts[2] || "";
      if (ref.startsWith('"') && ref.endsWith('"')) {
        ref = ref.slice(1, -1).replace(/""/g, '"');
      }
      return ref;
    }).filter(Boolean).sort();
  };

  it("1. Withdraw + Failed + minAmount 5000 + maxAmount 20000 + search", async () => {
    const query = "?type=WITHDRAWAL&status=Failed&minAmount=5000&maxAmount=20000&search=15000";
    const activityIds = await getIdsFromActivity(query);
    const exportIds = await getIdsFromExport(query);
    
    expect(activityIds).toEqual(exportIds);
    expect(activityIds).toEqual(["WITH_FAI_15000"]); // Verify it actually found the right one
  });

  it("2. Add Money + Completed + minAmount 1000 + maxAmount 10000", async () => {
    const query = "?type=ADD_MONEY&status=Completed&minAmount=1000&maxAmount=10000";
    const activityIds = await getIdsFromActivity(query);
    const exportIds = await getIdsFromExport(query);
    
    expect(activityIds).toEqual(exportIds);
    expect(activityIds.length).toBe(3);
    expect(activityIds).toContain("FUND_SUC_1000");
    expect(activityIds).toContain("FUND_SUC_5000");
    expect(activityIds).toContain("FUND_SUC_10000");
  });
});
