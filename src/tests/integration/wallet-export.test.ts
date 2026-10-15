import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import { db } from "../../infrastructure/database/db";
import { GET } from "../../app/api/v1/merchant/wallet/export/route";
import { NextRequest } from "next/server";
import { requireFullMerchantAccess } from "../../modules/auth/application/session-auth.service";

vi.mock("../../modules/auth/application/session-auth.service", () => ({
  requireFullMerchantAccess: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
  ForbiddenError: class ForbiddenError extends Error {}
}));

describe("Wallet Export API", () => {
  let merchantA: string;
  let merchantB: string;
  let bankA: string;

  beforeAll(async () => {
    const userA = await db.user.create({
      data: {
        email: `export-A-${Date.now()}@test.com`,
        name: "Test User A",
        role: "MERCHANT",
      }
    });
    const profileA = await db.merchantProfile.create({
      data: {
        userId: userA.id,
        businessName: "Export Test Merchant A",
        phone: `+91${Date.now().toString().slice(-10)}A`
      }
    });
    merchantA = profileA.id;

    const mbank = await db.merchantBank.create({
      data: {
        merchantProfileId: merchantA,
        accountHolderName: "A",
        accountNumber: "123",
        ifscCode: "ABC"
      }
    });
    bankA = mbank.id;

    const userB = await db.user.create({
      data: {
        email: `export-B-${Date.now()}@test.com`,
        name: "Test User B",
        role: "MERCHANT",
      }
    });
    const profileB = await db.merchantProfile.create({
      data: {
        userId: userB.id,
        businessName: "Export Test Merchant B",
        phone: `+91${Date.now().toString().slice(-10)}B`
      }
    });
    merchantB = profileB.id;

    // Seed Data for Merchant A
    await db.fundRequest.create({
      data: {
        merchantProfileId: merchantA,
        amount: 1500,
        utrNumber: "FUND_A_1",
        paymentMode: "UPI",
        status: "APPROVED"
      }
    });
    await db.fundRequest.create({
      data: {
        merchantProfileId: merchantA,
        amount: 8000,
        utrNumber: "FUND_A_2",
        paymentMode: "NEFT",
        status: "PENDING"
      }
    });
    await db.withdrawal.create({
      data: {
        merchantProfile: { connect: { id: merchantA } },
        merchantBank: { connect: { id: bankA } },
        amount: 500,
        providerReference: "WITH_A_1",
        status: "SUCCESS",
        bankReference: "BANK_A_1",
        idempotencyKey: "IDEMP_A_1",
        totalDebitAmount: 500
      }
    });
    await db.withdrawal.create({
      data: {
        merchantProfile: { connect: { id: merchantA } },
        merchantBank: { connect: { id: bankA } },
        amount: 12000,
        providerReference: "WITH_A_2",
        status: "FAILED",
        idempotencyKey: "IDEMP_A_2",
        totalDebitAmount: 12000
      }
    });
    // Create a payout for A (Should NOT appear in Wallet export)
    await db.payout.create({
      data: {
        merchantProfileId: merchantA,
        amount: 200,
        fee: 0,
        tax: 0,
        totalDebitAmount: 200,
        status: "SUCCESS",
        paymentMode: "IMPS",
        accountHolderName: "TEST",
        accountNumber: "123",
        ifscCode: "TEST001",
        idempotencyKey: `PAY_A_1_${Date.now()}`
      }
    });

    // Seed Data for Merchant B
    await db.fundRequest.create({
      data: {
        merchantProfileId: merchantB,
        amount: 9999,
        utrNumber: "FUND_B_1",
        paymentMode: "UPI",
        status: "APPROVED"
      }
    });
  });

  afterAll(async () => {
    // cleanup
    await db.payout.deleteMany({ where: { merchantProfileId: { in: [merchantA, merchantB] } } });
    await db.withdrawal.deleteMany({ where: { merchantProfileId: { in: [merchantA, merchantB] } } });
    await db.fundRequest.deleteMany({ where: { merchantProfileId: { in: [merchantA, merchantB] } } });
    await db.merchantBank.deleteMany({ where: { merchantProfileId: { in: [merchantA, merchantB] } } });
    await db.merchantProfile.deleteMany({ where: { id: { in: [merchantA, merchantB] } } });
    await db.user.deleteMany({ where: { email: { startsWith: "export-" } } });
  });

  it("A. Export all Wallet activity (includes Add/Withdraw, excludes Payout)", async () => {
    (requireFullMerchantAccess as any).mockResolvedValue({ merchantProfileId: merchantA });
    const req = new NextRequest("http://localhost/api/v1/merchant/wallet/export");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const text = await res.text();

    expect(text).toContain("FUND_A_1");
    expect(text).toContain("FUND_A_2");
    expect(text).toContain("BANK_A_1");
    expect(text).toContain("WITH_A_2");
    expect(text).not.toContain("PAY_A_1");
  });

  it("B. Type filter (ADD_MONEY)", async () => {
    (requireFullMerchantAccess as any).mockResolvedValue({ merchantProfileId: merchantA });
    const req = new NextRequest("http://localhost/api/v1/merchant/wallet/export?type=ADD_MONEY");
    const res = await GET(req);
    const text = await res.text();
    expect(text).toContain("FUND_A_1");
    expect(text).toContain("FUND_A_2");
    expect(text).not.toContain("BANK_A_1");
  });

  it("B. Type filter (WITHDRAWAL)", async () => {
    (requireFullMerchantAccess as any).mockResolvedValue({ merchantProfileId: merchantA });
    const req = new NextRequest("http://localhost/api/v1/merchant/wallet/export?type=WITHDRAWAL");
    const res = await GET(req);
    const text = await res.text();
    expect(text).toContain("BANK_A_1");
    expect(text).toContain("WITH_A_2");
    expect(text).not.toContain("FUND_A_1");
  });

  it("C. Status filter (Pending)", async () => {
    (requireFullMerchantAccess as any).mockResolvedValue({ merchantProfileId: merchantA });
    const req = new NextRequest("http://localhost/api/v1/merchant/wallet/export?status=Pending");
    const res = await GET(req);
    const text = await res.text();
    expect(text).toContain("FUND_A_2");
    expect(text).not.toContain("FUND_A_1");
    expect(text).not.toContain("BANK_A_1");
  });

  it("D. Search filter", async () => {
    (requireFullMerchantAccess as any).mockResolvedValue({ merchantProfileId: merchantA });
    const req = new NextRequest("http://localhost/api/v1/merchant/wallet/export?search=BANK_A_1");
    const res = await GET(req);
    const text = await res.text();
    expect(text).toContain("BANK_A_1");
    expect(text).not.toContain("FUND_A_1");
  });

  it("E. Date filter", async () => {
    (requireFullMerchantAccess as any).mockResolvedValue({ merchantProfileId: merchantA });
    // We can just pass a narrow date window
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();
    const req = new NextRequest(`http://localhost/api/v1/merchant/wallet/export?startDate=${now}&endDate=${future}`);
    const res = await GET(req);
    const text = await res.text();
    // Since our test records were created recently (before `now`), they should not appear in this future window.
    expect(text.trim()).toBe("Date,Type,Reference,Amount,Status,Payment Mode");
  });

  it("F. Amount filter", async () => {
    (requireFullMerchantAccess as any).mockResolvedValue({ merchantProfileId: merchantA });
    const req = new NextRequest("http://localhost/api/v1/merchant/wallet/export?minAmount=1000&maxAmount=2000");
    const res = await GET(req);
    const text = await res.text();
    // FUND_A_1 is 1500 (inside). FUND_A_2 is 8000 (outside). WITH_A_1 is 500 (outside). WITH_A_2 is 12000 (outside).
    expect(text).toContain("FUND_A_1");
    expect(text).not.toContain("FUND_A_2");
    expect(text).not.toContain("BANK_A_1");
    expect(text).not.toContain("WITH_A_2");
  });

  it("H. Merchant isolation", async () => {
    (requireFullMerchantAccess as any).mockResolvedValue({ merchantProfileId: merchantA });
    const req = new NextRequest("http://localhost/api/v1/merchant/wallet/export");
    const res = await GET(req);
    const text = await res.text();
    expect(text).not.toContain("FUND_B_1");
  });

  it("I. Empty result returns CSV header", async () => {
    (requireFullMerchantAccess as any).mockResolvedValue({ merchantProfileId: merchantA });
    const req = new NextRequest("http://localhost/api/v1/merchant/wallet/export?minAmount=99999");
    const res = await GET(req);
    const text = await res.text();
    expect(text.trim()).toBe("Date,Type,Reference,Amount,Status,Payment Mode");
  });
});
