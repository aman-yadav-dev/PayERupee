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

describe("Wallet Export API (Advanced Combinations)", () => {
  let merchantA: string;
  let merchantB: string;
  let bankA: string;

  beforeAll(async () => {
    const userA = await db.user.create({
      data: { email: `export2-A-${Date.now()}@test.com`, name: "Test User A", role: "MERCHANT" }
    });
    const profileA = await db.merchantProfile.create({
      data: { userId: userA.id, businessName: "Export 2 Test Merchant A", phone: `+91${Date.now().toString().slice(-10)}A` }
    });
    merchantA = profileA.id;

    const mbank = await db.merchantBank.create({
      data: { merchantProfileId: merchantA, accountHolderName: "A", accountNumber: "123", ifscCode: "ABC" }
    });
    bankA = mbank.id;

    // Seed Data for tests:
    // A. Withdraw + Failed + 5000-20000
    await db.withdrawal.create({ data: { merchantProfile: { connect: { id: merchantA } }, merchantBank: { connect: { id: bankA } }, amount: 4999.99, providerReference: "WITH_FAI_4999", status: "FAILED", idempotencyKey: "I1", totalDebitAmount: 4999.99 } });
    await db.withdrawal.create({ data: { merchantProfile: { connect: { id: merchantA } }, merchantBank: { connect: { id: bankA } }, amount: 5000, providerReference: "WITH_FAI_5000", status: "FAILED", idempotencyKey: "I2", totalDebitAmount: 5000 } });
    await db.withdrawal.create({ data: { merchantProfile: { connect: { id: merchantA } }, merchantBank: { connect: { id: bankA } }, amount: 15000, providerReference: "WITH_FAI_15000", status: "FAILED", idempotencyKey: "I3", totalDebitAmount: 15000 } });
    await db.withdrawal.create({ data: { merchantProfile: { connect: { id: merchantA } }, merchantBank: { connect: { id: bankA } }, amount: 20000, providerReference: "WITH_FAI_20000", status: "FAILED", idempotencyKey: "I4", totalDebitAmount: 20000 } });
    await db.withdrawal.create({ data: { merchantProfile: { connect: { id: merchantA } }, merchantBank: { connect: { id: bankA } }, amount: 20000.01, providerReference: "WITH_FAI_20000_1", status: "FAILED", idempotencyKey: "I5", totalDebitAmount: 20000.01 } });

    // B. Add Money + Completed + 1000-10000
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
    await db.user.deleteMany({ where: { email: { startsWith: "export2-" } } });
  });

  const runGet = async (query = "") => {
    (requireFullMerchantAccess as any).mockResolvedValue({ merchantProfileId: merchantA });
    const req = new NextRequest(`http://localhost/api/v1/merchant/wallet/export${query}`);
    const res = await GET(req);
    const text = await res.text();
    return { status: res.status, text };
  };

  it("A. Withdraw + Failed + minAmount 5000 + maxAmount 20000", async () => {
    const res = await runGet("?type=WITHDRAWAL&status=Failed&minAmount=5000&maxAmount=20000");
    const { text } = res;
    expect(text).toContain("WITH_FAI_5000");
    expect(text).toContain("WITH_FAI_15000");
    expect(text).toContain("WITH_FAI_20000");
    expect(text).not.toContain("WITH_FAI_4999");
    expect(text).not.toContain("WITH_FAI_20000_1");
  });

  it("B. Add Money + Completed + minAmount 1000 + maxAmount 10000", async () => {
    const res = await runGet("?type=ADD_MONEY&status=Completed&minAmount=1000&maxAmount=10000");
    const { text } = res;
    expect(text).toContain("FUND_SUC_1000");
    expect(text).toContain("FUND_SUC_5000");
    expect(text).toContain("FUND_SUC_10000");
    expect(text).not.toContain("FUND_SUC_999");
    expect(text).not.toContain("FUND_SUC_10000_1");
  });

  it("C. Combined filters: Withdraw + Failed + 5000-20000 + search", async () => {
    const res = await runGet("?type=WITHDRAWAL&status=Failed&minAmount=5000&maxAmount=20000&search=15000");
    const { text } = res;
    expect(text).toContain("WITH_FAI_15000");
    expect(text).not.toContain("WITH_FAI_5000");
    expect(text).not.toContain("WITH_FAI_20000");
  });

  it("F. No-range regression", async () => {
    const res = await runGet();
    const { text } = res;
    // Everything should be included
    expect(text).toContain("WITH_FAI_4999");
    expect(text).toContain("FUND_SUC_999");
  });
});
