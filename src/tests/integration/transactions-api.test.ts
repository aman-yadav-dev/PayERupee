import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { GET as getTransactions } from "@/app/api/v1/merchant/transactions/route";
import { GET as exportTransactions } from "@/app/api/v1/merchant/transactions/export/route";
import { GET as getTransactionDetail } from "@/app/api/v1/merchant/transactions/[id]/route";
import { db } from "@/infrastructure/database/db";
import { NextRequest } from "next/server";
import { requireFullMerchantAccess } from "@/modules/auth/application/session-auth.service";

vi.mock("@/modules/auth/application/session-auth.service", () => ({
  requireFullMerchantAccess: vi.fn(),
  requireAdminAccess: vi.fn()
}));

let mockMerchantIdA: string;
let mockMerchantIdB: string;

let payoutA1: any;
let payoutA2: any;
let payoutB1: any;
let fundReqA: any;
let withdrawalA: any;

describe("Transactions API", () => {
  beforeAll(async () => {
    // 1. Create two merchants for isolation testing
    const mA = await db.merchantProfile.create({
      data: { businessName: "Merch A", accountStatus: "ACTIVE", user: { create: { name: "A", email: "a@a.com" } } }
    });
    mockMerchantIdA = mA.id;

    const mB = await db.merchantProfile.create({
      data: { businessName: "Merch B", accountStatus: "ACTIVE", user: { create: { name: "B", email: "b@b.com" } } }
    });
    mockMerchantIdB = mB.id;

    // 2. Create actual transactions (Payouts)
    payoutA1 = await db.payout.create({
      data: {
        merchantProfileId: mockMerchantIdA,
        idempotencyKey: "pA1",
        amount: 5000.0,
        fee: 5.0,
        tax: 0.9,
        totalDebitAmount: 5005.9,
        status: "SUCCESS",
        accountNumber: "1234567890",
        ifscCode: "HDFC0001",
        accountHolderName: "John Doe",
        merchantReference: "ORD-1",
        createdAt: new Date("2024-01-01T10:00:00Z")
      }
    });

    payoutA2 = await db.payout.create({
      data: {
        merchantProfileId: mockMerchantIdA,
        idempotencyKey: "pA2",
        amount: 15000.0,
        fee: 10.0,
        tax: 1.8,
        totalDebitAmount: 15011.8,
        status: "FAILED",
        accountNumber: "0987654321",
        ifscCode: "SBIN0002",
        accountHolderName: "Jane Doe",
        merchantReference: "ORD-2",
        failureReason: "Invalid Account",
        createdAt: new Date("2024-01-02T10:00:00Z")
      }
    });

    payoutB1 = await db.payout.create({
      data: {
        merchantProfileId: mockMerchantIdB,
        idempotencyKey: "pB1",
        amount: 3000.0,
        fee: 0,
        tax: 0,
        totalDebitAmount: 3000.0,
        status: "PENDING",
        accountNumber: "1122334455",
        ifscCode: "ICIC0003",
        accountHolderName: "Bob Smith",
        merchantReference: "ORD-B",
        createdAt: new Date("2024-01-03T10:00:00Z")
      }
    });

    // 3. Create FundRequest (Add Money)
    fundReqA = await db.fundRequest.create({
      data: {
        merchantProfileId: mockMerchantIdA,
        amount: 50000.0,
        utrNumber: "UTR123",
        status: "APPROVED"
      }
    });

    // 4. Create Withdrawal
    const mBank = await db.merchantBank.create({
      data: {
        merchantProfileId: mockMerchantIdA,
        accountNumber: "9988776655",
        ifscCode: "TEST0001",
        accountHolderName: "Merch A",
        isVerified: true
      }
    });

    withdrawalA = await db.withdrawal.create({
      data: {
        merchantProfileId: mockMerchantIdA,
        merchantBankId: mBank.id,
        idempotencyKey: "wA1",
        amount: 20000.0,
        totalDebitAmount: 20000.0,
        status: "SUCCESS"
      }
    });

    // 5. Create UPI Payout
    await db.payout.create({
      data: {
        merchantProfileId: mockMerchantIdA,
        idempotencyKey: "pA3_UPI",
        amount: 100.0,
        fee: 1.0,
        tax: 0.18,
        totalDebitAmount: 101.18,
        status: "SUCCESS",
        paymentMode: "UPI",
        vpa: "test@upi",
        accountHolderName: "UPI Doe",
        merchantReference: "ORD-UPI",
        createdAt: new Date("2024-01-04T10:00:00Z")
      }
    });

  });

  afterAll(async () => {
    await db.ledgerEntry.deleteMany({});
    await db.payout.deleteMany({});
    await db.fundRequest.deleteMany({});
    await db.withdrawal.deleteMany({});
    await db.merchantBank.deleteMany({});
    await db.merchantProfile.deleteMany({});
    await db.user.deleteMany({});
  });

  const asMerchant = (merchantProfileId: string) => {
    vi.mocked(requireFullMerchantAccess).mockResolvedValue({ merchantProfileId, userId: "1",  });
  };

  it("1, 2, 3, 4, 5, 6. returns only legitimate payouts, excludes Add Money, Withdrawals, LedgerEntries, ensures isolation, no duplicates", async () => {
    asMerchant(mockMerchantIdA);
    const req = new NextRequest("http://localhost/api/v1/merchant/transactions");
    const res = await getTransactions(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.length).toBe(3);
    
    // Check isolation (payoutB1 is absent)
    expect(json.data.map((d: any) => d.id)).not.toContain(payoutB1.id);
    
    // Check exclusions (FundRequest and Withdrawal are absent)
    expect(json.data.map((d: any) => d.id)).not.toContain(fundReqA.id);
    expect(json.data.map((d: any) => d.id)).not.toContain(withdrawalA.id);
    
    // Ensure no duplicates or raw ledger entries
    const types = json.data.map((d: any) => d.type);
    expect(types).toEqual(["PAYOUT", "PAYOUT", "PAYOUT"]);
  });

  it("resolves IMPS and UPI destinations correctly via mapping", async () => {
    asMerchant(mockMerchantIdA);
    const req = new NextRequest("http://localhost/api/v1/merchant/transactions");
    const res = await getTransactions(req);
    const json = await res.json();
    
    const impsPayout = json.data.find((d: any) => d.id === payoutA1.id);
    expect(impsPayout.destination.accountNumber).toBe("******7890");
    expect(impsPayout.destination.ifscCode).toBe("HDFC0001");
    expect(impsPayout.destination.vpa).toBeNull();
    
    const upiPayout = json.data.find((d: any) => d.paymentMode === "UPI");
    expect(upiPayout.destination.vpa).toBe("test@upi");
  });

  it("7. Search filter works (by reference)", async () => {
    asMerchant(mockMerchantIdA);
    const req = new NextRequest("http://localhost/api/v1/merchant/transactions?search=ORD-2");
    const res = await getTransactions(req);
    const json = await res.json();
    
    expect(json.data.length).toBe(1);
    expect(json.data[0].id).toBe(payoutA2.id);
  });

  it("8. Status filter works", async () => {
    asMerchant(mockMerchantIdA);
    const req = new NextRequest("http://localhost/api/v1/merchant/transactions?status=FAILED");
    const res = await getTransactions(req);
    const json = await res.json();
    
    expect(json.data.length).toBe(1);
    expect(json.data[0].id).toBe(payoutA2.id);
  });

  it("9. Date range filter works", async () => {
    asMerchant(mockMerchantIdA);
    const req = new NextRequest("http://localhost/api/v1/merchant/transactions?startDate=2024-01-01T00:00:00Z&endDate=2024-01-01T23:59:59Z");
    const res = await getTransactions(req);
    const json = await res.json();
    
    expect(json.data.length).toBe(1);
    expect(json.data[0].id).toBe(payoutA1.id);
  });

  it("10, 11, 12. Combined amount and status filter works", async () => {
    asMerchant(mockMerchantIdA);
    const req = new NextRequest("http://localhost/api/v1/merchant/transactions?minAmount=10000&maxAmount=20000&status=FAILED");
    const res = await getTransactions(req);
    const json = await res.json();
    
    expect(json.data.length).toBe(1);
    expect(json.data[0].id).toBe(payoutA2.id);
    expect(json.data[0].amount).toBe("15000");
  });

  it("13. Pagination works", async () => {
    asMerchant(mockMerchantIdA);
    const req = new NextRequest("http://localhost/api/v1/merchant/transactions?page=1&limit=1");
    const res = await getTransactions(req);
    const json = await res.json();
    
    expect(json.data.length).toBe(1);
    expect(json.pagination.totalRecords).toBe(3);
    expect(json.pagination.totalPages).toBe(3);
  });

  it("14. Export works and contains correct rows", async () => {
    asMerchant(mockMerchantIdA);
    const req = new NextRequest("http://localhost/api/v1/merchant/transactions/export");
    const res = await exportTransactions(req);
    const text = await res.text();
    
    expect(text).toContain(payoutA1.id);
    expect(text).toContain("******7890"); // Account masking in export
    expect(text).not.toContain(fundReqA.id);
    expect(text).not.toContain(withdrawalA.id);
  });

  it("15, 16, 17. Detail API returns full info with masked account and failure reason", async () => {
    asMerchant(mockMerchantIdA);
    const req = new NextRequest(`http://localhost/api/v1/merchant/transactions/${payoutA2.id}`);
    const res = await getTransactionDetail(req, { params: Promise.resolve({ id: payoutA2.id }) } as any);
    const json = await res.json();
    
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(payoutA2.id);
    expect(json.data.destination.accountNumber).toBe("******4321"); // Masking
    expect(json.data.failureReason).toBe("Invalid Account"); // Failure reason
  });

  it("Detail API returns VPA for UPI transactions", async () => {
    asMerchant(mockMerchantIdA);
    // Find the UPI payout we created earlier (pA3_UPI)
    const upiPayout = await db.payout.findFirst({ where: { idempotencyKey: "pA3_UPI", merchantProfileId: mockMerchantIdA } });
    
    const req = new NextRequest(`http://localhost/api/v1/merchant/transactions/${upiPayout!.id}`);
    const res = await getTransactionDetail(req, { params: Promise.resolve({ id: upiPayout!.id }) } as any);
    const json = await res.json();
    
    expect(json.success).toBe(true);
    expect(json.data.paymentMode).toBe("UPI");
    expect(json.data.destination.vpa).toBe("test@upi");
  });
});
