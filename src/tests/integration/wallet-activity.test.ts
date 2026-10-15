import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import { db } from "../../infrastructure/database/db";
import { GET } from "../../app/api/v1/merchant/wallet/activity/route";
import { NextRequest } from "next/server";
import { requireFullMerchantAccess } from "../../modules/auth/application/session-auth.service";

vi.mock("../../modules/auth/application/session-auth.service", () => ({
  requireFullMerchantAccess: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
  ForbiddenError: class ForbiddenError extends Error {}
}));

describe("Wallet Activity API", () => {
  let merchantA: string;
  let merchantB: string;
  let bankA: string;

  beforeAll(async () => {
    const userA = await db.user.create({
      data: { email: `activity-A-${Date.now()}@test.com`, name: "A", role: "MERCHANT" }
    });
    const profileA = await db.merchantProfile.create({
      data: { userId: userA.id, businessName: "A", phone: `+91${Date.now().toString().slice(-10)}A` }
    });
    merchantA = profileA.id;

    const mbank = await db.merchantBank.create({
      data: { merchantProfileId: merchantA, accountHolderName: "A", accountNumber: "123", ifscCode: "ABC" }
    });
    bankA = mbank.id;

    const userB = await db.user.create({
      data: { email: `activity-B-${Date.now()}@test.com`, name: "B", role: "MERCHANT" }
    });
    const profileB = await db.merchantProfile.create({
      data: { userId: userB.id, businessName: "B", phone: `+91${Date.now().toString().slice(-10)}B` }
    });
    merchantB = profileB.id;

    // A - Funds
    await db.fundRequest.create({ data: { merchantProfileId: merchantA, amount: 1000, utrNumber: "FUND_PEN", paymentMode: "UPI", status: "PENDING" } });
    await db.fundRequest.create({ data: { merchantProfileId: merchantA, amount: 2000, utrNumber: "FUND_APP", paymentMode: "UPI", status: "APPROVED" } });
    await db.fundRequest.create({ data: { merchantProfileId: merchantA, amount: 3000, utrNumber: "FUND_REJ", paymentMode: "UPI", status: "REJECTED" } });

    // A - Withdrawals
    await db.withdrawal.create({ data: { merchantProfile: { connect: { id: merchantA } }, merchantBank: { connect: { id: bankA } }, amount: 4000, providerReference: "WITH_PEN", status: "PENDING", idempotencyKey: "I1", totalDebitAmount: 4000 } });
    await db.withdrawal.create({ data: { merchantProfile: { connect: { id: merchantA } }, merchantBank: { connect: { id: bankA } }, amount: 5000, providerReference: "WITH_SUC", status: "SUCCESS", idempotencyKey: "I2", totalDebitAmount: 5000 } });
    await db.withdrawal.create({ data: { merchantProfile: { connect: { id: merchantA } }, merchantBank: { connect: { id: bankA } }, amount: 6000, providerReference: "WITH_FAI", status: "FAILED", idempotencyKey: "I3", totalDebitAmount: 6000 } });

    // A - Payout
    await db.payout.create({ data: { merchantProfileId: merchantA, amount: 9999, fee: 0, tax: 0, totalDebitAmount: 9999, status: "SUCCESS", paymentMode: "IMPS", accountHolderName: "TEST", accountNumber: "123", ifscCode: "ABC", idempotencyKey: "PAY1" } });

    // B - Funds
    await db.fundRequest.create({ data: { merchantProfileId: merchantB, amount: 1000, utrNumber: "FUND_B", paymentMode: "UPI", status: "PENDING" } });
  });

  afterAll(async () => {
    await db.payout.deleteMany({ where: { merchantProfileId: { in: [merchantA, merchantB] } } });
    await db.withdrawal.deleteMany({ where: { merchantProfileId: { in: [merchantA, merchantB] } } });
    await db.fundRequest.deleteMany({ where: { merchantProfileId: { in: [merchantA, merchantB] } } });
    await db.merchantBank.deleteMany({ where: { merchantProfileId: { in: [merchantA, merchantB] } } });
    await db.merchantProfile.deleteMany({ where: { id: { in: [merchantA, merchantB] } } });
    await db.user.deleteMany({ where: { email: { startsWith: "activity-" } } });
  });

  const runGet = async (query = "") => {
    (requireFullMerchantAccess as any).mockResolvedValue({ merchantProfileId: merchantA });
    const req = new NextRequest(`http://localhost/api/v1/merchant/wallet/activity${query}`);
    const res = await GET(req);
    const body = await res.json();
    return { status: res.status, body };
  };

  it("1. no filters", async () => {
    const res = await runGet();
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(6);
  });

  it("2. Pending", async () => {
    const res = await runGet("?status=Pending");
    expect(res.body.data.length).toBe(2);
    expect(res.body.data.map((d: any) => d.reference)).toContain("FUND_PEN");
    expect(res.body.data.map((d: any) => d.reference)).toContain("WITH_PEN");
  });

  it("3. Completed", async () => {
    const res = await runGet("?status=Completed");
    expect(res.body.data.length).toBe(2);
    expect(res.body.data.map((d: any) => d.reference)).toContain("FUND_APP");
    expect(res.body.data.map((d: any) => d.reference)).toContain("WITH_SUC");
  });

  it("4. Failed", async () => {
    const res = await runGet("?status=Failed");
    expect(res.body.data.length).toBe(2);
    expect(res.body.data.map((d: any) => d.reference)).toContain("FUND_REJ");
    expect(res.body.data.map((d: any) => d.reference)).toContain("WITH_FAI");
  });

  it("5. Add Money + Pending", async () => {
    const res = await runGet("?type=ADD_MONEY&status=Pending");
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].reference).toBe("FUND_PEN");
  });

  it("6. Add Money + Completed", async () => {
    const res = await runGet("?type=ADD_MONEY&status=Completed");
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].reference).toBe("FUND_APP");
  });

  it("7. Add Money + Failed", async () => {
    const res = await runGet("?type=ADD_MONEY&status=Failed");
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].reference).toBe("FUND_REJ");
  });

  it("8. Withdraw + Pending", async () => {
    const res = await runGet("?type=WITHDRAWAL&status=Pending");
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].reference).toBe("WITH_PEN");
  });

  it("9. Withdraw + Completed", async () => {
    const res = await runGet("?type=WITHDRAWAL&status=Completed");
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].reference).toBe("WITH_SUC");
  });

  it("10. Withdraw + Failed", async () => {
    const res = await runGet("?type=WITHDRAWAL&status=Failed");
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].reference).toBe("WITH_FAI");
  });

  it("11. type + status + amount", async () => {
    const res = await runGet("?type=ADD_MONEY&status=Completed&minAmount=1500&maxAmount=2500");
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].reference).toBe("FUND_APP");
  });

  it("12. type + status + search", async () => {
    const res = await runGet("?type=WITHDRAWAL&status=Failed&search=WITH_FAI");
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].reference).toBe("WITH_FAI");
  });

  it("13. type + status + date", async () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    const res = await runGet(`?type=ADD_MONEY&status=Pending&startDate=${d.toISOString()}`);
    expect(res.body.data.length).toBe(1);
  });

  it("14. all filters combined", async () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    const res = await runGet(`?type=WITHDRAWAL&status=Failed&minAmount=5000&maxAmount=7000&search=WITH_FAI&startDate=${d.toISOString()}`);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].reference).toBe("WITH_FAI");
  });

  it("15. invalid date -> 400", async () => {
    const res = await runGet("?startDate=invalid");
    expect(res.status).toBe(400);
  });

  it("16. invalid amount -> 400", async () => {
    const res = await runGet("?minAmount=abc");
    expect(res.status).toBe(400);
  });

  it("17. min > max -> 400", async () => {
    const res = await runGet("?minAmount=100&maxAmount=50");
    expect(res.status).toBe(400);
  });

  it("18. merchant isolation", async () => {
    const res = await runGet("?search=FUND_B");
    expect(res.body.data.length).toBe(0);
  });

  it("19. Payout never appears", async () => {
    const res = await runGet();
    const refs = res.body.data.map((d: any) => d.reference);
    expect(refs).not.toContain("PAY1");
  });

  it("20. pagination still works after filters", async () => {
    const res = await runGet("?limit=2");
    expect(res.body.pagination.totalRecords).toBe(6);
    expect(res.body.pagination.totalPages).toBe(3);
    expect(res.body.data.length).toBe(2);
  });
});
