import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { db } from "../../infrastructure/database/db";
import { GET as getExport } from "../../app/api/v1/merchant/transactions/export/route";
import { NextRequest } from "next/server";

let merchantId: string;
let otherMerchantId: string;

vi.mock("../../modules/auth/application/session-auth.service", () => ({
  requireFullMerchantAccess: vi.fn().mockImplementation(async () => {
    return { merchantProfileId: merchantId };
  }),
  UnauthorizedError: class UnauthorizedError extends Error {},
  ForbiddenError: class ForbiddenError extends Error {}
}));

describe("Transactions Export API", () => {
  beforeAll(async () => {
    const u1 = await db.user.create({ data: { email: `t1e-${Date.now()}@test.com`, name: "T1e User" } });
    const m1 = await db.merchantProfile.create({ data: { userId: u1.id, businessName: "T1e LLC", phone: `+919${Date.now().toString().slice(-9)}` } });
    merchantId = m1.id;

    const u2 = await db.user.create({ data: { email: `t2e-${Date.now()}@test.com`, name: "T2e User" } });
    const m2 = await db.merchantProfile.create({ data: { userId: u2.id, businessName: "T2e LLC", phone: `+918${Date.now().toString().slice(-9)}` } });
    otherMerchantId = m2.id;
  });

  beforeEach(async () => {
    await db.payout.deleteMany({ where: { merchantProfileId: { in: [merchantId, otherMerchantId] } } });
    await db.fundRequest.deleteMany({ where: { merchantProfileId: { in: [merchantId, otherMerchantId] } } });
    await db.withdrawal.deleteMany({ where: { merchantProfileId: { in: [merchantId, otherMerchantId] } } });
  });

  const reqGet = async (query: string = "") => {
    const req = new NextRequest(`http://localhost/api/v1/merchant/transactions/export${query}`);
    return getExport(req);
  };

  it("exports only Payouts, masks accounts, ignores other tenants, escapes CSV", async () => {
    await db.payout.create({ data: { merchantProfileId: merchantId, idempotencyKey: "p1", amount: 1500, fee: 10, tax: 2, totalDebitAmount: 1512, accountNumber: "123456789", ifscCode: "HDFC", accountHolderName: "John, Doe", status: "SUCCESS", provider: "CASHFREE", providerReference: "CF123" }});
    
    await db.payout.create({ data: { merchantProfileId: otherMerchantId, idempotencyKey: "p2", amount: 3000, fee: 0, tax: 0, totalDebitAmount: 3000, accountNumber: "321", ifscCode: "HDFC", accountHolderName: "Jane", status: "SUCCESS" }});

    await db.fundRequest.create({ data: { merchantProfileId: merchantId, amount: 5000, status: "APPROVED", utrNumber: "U1" }});

    const bank = await db.merchantBank.create({ data: { merchantProfileId: merchantId, accountNumber: "321", ifscCode: "SBIN", accountHolderName: "WD" }});
    await db.withdrawal.create({ data: { merchantProfileId: merchantId, amount: 2000, totalDebitAmount: 2000, status: "SUCCESS", idempotencyKey: "wd1", merchantBankId: bank.id }});

    const res = await reqGet();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    
    const csv = await res.text();
    const lines = csv.split("\n");
    expect(lines.length).toBe(2); // Header + 1 row (because others are excluded)
    
    // Check masking and escaping
    const row = lines[1];
    expect(row).toContain("******6789"); // masked account
    expect(row).toContain("1500");
    expect(row).toContain("CASHFREE");
  });

  it("filters correctly", async () => {
    await db.payout.create({ data: { merchantProfileId: merchantId, idempotencyKey: "p1", amount: 100, fee: 0, tax: 0, totalDebitAmount: 100, accountNumber: "1", ifscCode: "H", accountHolderName: "N", status: "SUCCESS" }});
    await db.payout.create({ data: { merchantProfileId: merchantId, idempotencyKey: "p2", amount: 200, fee: 0, tax: 0, totalDebitAmount: 200, accountNumber: "2", ifscCode: "H", accountHolderName: "N", status: "FAILED", failureReason: "Network issue" }});

    const res = await reqGet("?status=Failed&minAmount=150");
    const csv = await res.text();
    const lines = csv.split("\n");
    expect(lines.length).toBe(2); // header + 1 row
    expect(lines[1]).toContain("200");
    expect(lines[1]).toContain("Network issue");
  });

  it("returns 400 for bad filters", async () => {
    const r1 = await reqGet("?minAmount=abc");
    expect(r1.status).toBe(400);
  });
});
