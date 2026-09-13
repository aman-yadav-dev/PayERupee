import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/infrastructure/database/db";
import { GET as getWallet } from "@/app/api/v1/merchant/wallet/route";
import { GET as getPayouts } from "@/app/api/v1/merchant/payouts/route";
import { GET as getLedger } from "@/app/api/v1/merchant/ledger/route";

vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    }
  }
}));
import { auth } from "@/modules/auth/infrastructure/auth";
import { Prisma } from "@prisma/client";

describe("Merchant UI APIs (Tenant Isolation)", () => {
  let mockUserIdA = "test-user-a";
  let mockMerchantIdA = "test-merchant-a";
  let mockLedgerAccountIdA = "test-ledger-a";

  let mockUserIdB = "test-user-b";
  let mockMerchantIdB = "test-merchant-b";
  let mockLedgerAccountIdB = "test-ledger-b";

  beforeEach(async () => {
    // Let errors bubble up. If DB is down, this will throw ECONNREFUSED and legitimately fail the test execution.
    // We create two completely separate merchants to test cross-tenant isolation.
    
    await db.ledgerAccount.create({
      data: { id: "sys-transit", type: "SYSTEM_TRANSIT", currency: "INR" }
    });

    // Setup Merchant A
    await db.user.create({
      data: { id: mockUserIdA, name: "User A", email: "user_a@test.com" }
    });
    await db.merchantProfile.create({
      data: { id: mockMerchantIdA, userId: mockUserIdA, businessName: "Merchant A" }
    });
    await db.ledgerAccount.create({
      data: { id: mockLedgerAccountIdA, merchantProfileId: mockMerchantIdA, type: "MERCHANT_LIABILITY", currency: "INR" }
    });
    await db.wallet.create({
      data: { merchantProfileId: mockMerchantIdA, ledgerAccountId: mockLedgerAccountIdA, balance: 100.00 }
    });
    await db.payout.create({
      data: { id: "payout-a", merchantProfileId: mockMerchantIdA, idempotencyKey: "idem-a", amount: 10, totalDebitAmount: 10, paymentMode: "IMPS", accountNumber: "123", ifscCode: "ABC", accountHolderName: "Test" }
    });
    await db.ledgerEntry.create({
      data: { id: "ledger-a", amount: 10, debitAccountId: mockLedgerAccountIdA, creditAccountId: "sys-transit", purpose: "PRINCIPAL", referenceType: "PAYOUT", description: "Payout A" }
    });

    // Setup Merchant B
    await db.user.create({
      data: { id: mockUserIdB, name: "User B", email: "user_b@test.com" }
    });
    await db.merchantProfile.create({
      data: { id: mockMerchantIdB, userId: mockUserIdB, businessName: "Merchant B" }
    });
    await db.ledgerAccount.create({
      data: { id: mockLedgerAccountIdB, merchantProfileId: mockMerchantIdB, type: "MERCHANT_LIABILITY", currency: "INR" }
    });
    await db.wallet.create({
      data: { merchantProfileId: mockMerchantIdB, ledgerAccountId: mockLedgerAccountIdB, balance: 50.00 }
    });
    await db.payout.create({
      data: { id: "payout-b", merchantProfileId: mockMerchantIdB, idempotencyKey: "idem-b", amount: 20, totalDebitAmount: 20, paymentMode: "IMPS", accountNumber: "123", ifscCode: "ABC", accountHolderName: "Test" }
    });
    await db.ledgerEntry.create({
      data: { id: "ledger-b", amount: 20, debitAccountId: mockLedgerAccountIdB, creditAccountId: "sys-transit", purpose: "PRINCIPAL", referenceType: "PAYOUT", description: "Payout B" }
    });
  });

  afterEach(async () => {
    try {
      await db.ledgerEntry.deleteMany();
      await db.payout.deleteMany();
      await db.wallet.deleteMany();
      await db.ledgerAccount.deleteMany();
      await db.merchantProfile.deleteMany();
      await db.user.deleteMany();
    } catch (e) {
      // Cleanup might fail if DB is already down, safe to ignore during teardown
    }
    vi.resetAllMocks();
  });

  // 1. unauthenticated request rejected
  it("rejects unauthenticated requests (401)", async () => {
    (auth.api.getSession as any).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/v1/merchant/wallet");
    const res = await getWallet(req);
    expect(res.status).toBe(401);
  });

  // 2. Merchant A can read Merchant A wallet
  it("authenticates and retrieves Merchant A's wallet", async () => {
    (auth.api.getSession as any).mockResolvedValue({ user: { id: mockUserIdA } });
    const req = new NextRequest("http://localhost/api/v1/merchant/wallet");
    const res = await getWallet(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.balance).toBe("100");
  });

  // 3. Merchant A cannot read Merchant B wallet
  // (Inherently proven by the fact that getting the wallet returns exactly A's wallet, but we'll try spoofing)
  it("Merchant A cannot read Merchant B wallet", async () => {
    (auth.api.getSession as any).mockResolvedValue({ user: { id: mockUserIdA } });
    // Try to pass merchantProfileId in query
    const req = new NextRequest(`http://localhost/api/v1/merchant/wallet?merchantProfileId=${mockMerchantIdB}`);
    const res = await getWallet(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.balance).toBe("100"); // Remains 100, proving it ignored the spoof attempt and returned A's wallet.
  });

  // 4. Merchant A can read Merchant A payouts
  it("Merchant A can read Merchant A payouts", async () => {
    (auth.api.getSession as any).mockResolvedValue({ user: { id: mockUserIdA } });
    const req = new NextRequest("http://localhost/api/v1/merchant/payouts");
    const res = await getPayouts(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("payout-a");
  });

  // 5. Merchant A cannot read Merchant B payouts
  it("Merchant A cannot read Merchant B payouts", async () => {
    (auth.api.getSession as any).mockResolvedValue({ user: { id: mockUserIdA } });
    const req = new NextRequest(`http://localhost/api/v1/merchant/payouts?merchantProfileId=${mockMerchantIdB}`);
    const res = await getPayouts(req);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("payout-a"); // Did not get payout-b
  });

  // 6. Merchant A can read Merchant A ledger
  it("Merchant A can read Merchant A ledger", async () => {
    (auth.api.getSession as any).mockResolvedValue({ user: { id: mockUserIdA } });
    const req = new NextRequest("http://localhost/api/v1/merchant/ledger");
    const res = await getLedger(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("ledger-a");
  });

  // 7. Merchant A cannot read Merchant B ledger
  it("Merchant A cannot read Merchant B ledger", async () => {
    (auth.api.getSession as any).mockResolvedValue({ user: { id: mockUserIdA } });
    const req = new NextRequest(`http://localhost/api/v1/merchant/ledger?merchantProfileId=${mockMerchantIdB}`);
    const res = await getLedger(req);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("ledger-a"); // Did not get ledger-b
  });

  // 8. client-supplied merchantProfileId cannot override server-side merchant context
  it("client-supplied merchantProfileId cannot override server-side context", async () => {
    (auth.api.getSession as any).mockResolvedValue({ user: { id: mockUserIdB } });
    const req = new NextRequest(`http://localhost/api/v1/merchant/wallet?merchantProfileId=${mockMerchantIdA}`);
    const res = await getWallet(req);
    const body = await res.json();
    // B's session returns B's wallet (50.00), not A's (100.00)
    expect(body.data.balance).toBe("50"); 
  });

  // 9. pagination limit is capped at 100
  it("pagination limit is capped at 100", async () => {
    (auth.api.getSession as any).mockResolvedValue({ user: { id: mockUserIdA } });
    const req = new NextRequest("http://localhost/api/v1/merchant/payouts?limit=500");
    const res = await getPayouts(req);
    const body = await res.json();
    expect(body.pagination.limit).toBe(100);
  });

  // 10. invalid pagination parameters are safely handled
  it("invalid pagination parameters are safely handled", async () => {
    (auth.api.getSession as any).mockResolvedValue({ user: { id: mockUserIdA } });
    const req = new NextRequest("http://localhost/api/v1/merchant/payouts?limit=invalid&page=-5");
    const res = await getPayouts(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Safely defaults to page 1, limit 20 without throwing NaN DB errors
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(20);
  });
});
