import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { NextRequest } from "next/server";
import { POST as suspendMerchant } from "@/app/api/v1/admin/merchants/[id]/suspend/route";
import { POST as approveMerchant } from "@/app/api/v1/admin/merchants/[id]/approve/route";
import { AccountStatus } from "@prisma/client";

vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    }
  }
}));
import { auth } from "@/modules/auth/infrastructure/auth";

describe("Admin Merchant Account Approval API", () => {
  const adminUserId = "test-admin-user";
  const merchantUserId = "test-merchant-user";
  let testCount = 0;

  beforeEach(async () => {
    // Ensure base users exist
    await db.user.upsert({
      where: { id: adminUserId },
      update: {},
      create: {
        id: adminUserId,
        email: "admin@payerupee.test",
        name: "Test Admin",
        role: "ADMIN"
      }
    });

    await db.user.upsert({
      where: { id: merchantUserId },
      update: {},
      create: {
        id: merchantUserId,
        email: "merchant@payerupee.test",
        name: "Test Merchant",
        role: "MERCHANT"
      }
    });
  });

  function createMockRequest(userId: string | null) {
    if (userId) {
      (auth.api.getSession as any).mockResolvedValue({ user: { id: userId } });
    } else {
      (auth.api.getSession as any).mockResolvedValue(null);
    }
    return new NextRequest("http://localhost:3000/api/v1/admin/merchants/test/approve", {
      method: "POST",
    });
  }

  async function createMerchant(status: AccountStatus) {
    testCount++;
    const mId = `test-merchant-${testCount}`;
    const uId = `test-merchant-user-${testCount}`;
    
    await db.user.create({
      data: { id: uId, email: `m${testCount}@test.com`, name: "M", role: "MERCHANT" }
    });

    await db.merchantProfile.create({
      data: {
        id: mId,
        userId: uId,
        businessName: `Test Merchant ${testCount}`,
        accountStatus: status
      }
    });
    return { mId, uId };
  }

  it("returns 401 for unauthenticated request", async () => {
    const req = createMockRequest(null);
    const { mId } = await createMerchant(AccountStatus.PENDING);
    
    const res = await approveMerchant(req, { params: Promise.resolve({ id: mId }) as any });
    expect(res.status).toBe(401);
  });

  it("returns 403 for authenticated MERCHANT attempting approval", async () => {
    const { mId, uId } = await createMerchant(AccountStatus.PENDING);
    const req = createMockRequest(uId);
    
    const res = await approveMerchant(req, { params: Promise.resolve({ id: mId }) as any });
    expect(res.status).toBe(403);
  });

  it("returns 404 when ADMIN attempts to approve nonexistent merchant", async () => {
    const req = createMockRequest(adminUserId);
    
    const res = await approveMerchant(req, { params: Promise.resolve({ id: "non-existent-id" }) as any });
    expect(res.status).toBe(404);
  });

  it("returns 409 when ADMIN attempts to approve ACTIVE merchant", async () => {
    const req = createMockRequest(adminUserId);
    const { mId } = await createMerchant(AccountStatus.ACTIVE);
    
    const res = await approveMerchant(req, { params: Promise.resolve({ id: mId }) as any });
    expect(res.status).toBe(409);
  });

  it("returns 409 when ADMIN attempts to approve SUSPENDED merchant", async () => {
    const req = createMockRequest(adminUserId);
    const { mId } = await createMerchant(AccountStatus.SUSPENDED);
    
    const res = await approveMerchant(req, { params: Promise.resolve({ id: mId }) as any });
    expect(res.status).toBe(409);
  });

  it("returns 409 when ADMIN attempts to approve DELETED merchant", async () => {
    const req = createMockRequest(adminUserId);
    const { mId } = await createMerchant(AccountStatus.DELETED);
    
    const res = await approveMerchant(req, { params: Promise.resolve({ id: mId }) as any });
    expect(res.status).toBe(409);
  });

  it("returns 200 and successfully approves a PENDING merchant atomically with audit log", async () => {
    const req = createMockRequest(adminUserId);
    const { mId } = await createMerchant(AccountStatus.PENDING);
    
    const res = await approveMerchant(req, { params: Promise.resolve({ id: mId }) as any });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    // Verify MerchantProfile.accountStatus === ACTIVE
    const profile = await db.merchantProfile.findUnique({ where: { id: mId } });
    expect(profile?.accountStatus).toBe(AccountStatus.ACTIVE);

    // Verify exactly expected AuditLog entry exists
    const logs = await db.auditLog.findMany({
      where: { entityId: mId }
    });
    
    expect(logs.length).toBe(1);
    const log = logs[0];
    expect(log.actorId).toBe(adminUserId);
    expect(log.actorType).toBe("ADMIN");
    expect(log.entityType).toBe("MERCHANT_PROFILE");
    expect(log.action).toBe("APPROVE");
  });

  it("ensures Phase 2A full-access gate STILL blocks the newly ACTIVE merchant (403)", async () => {
    // 1. Approve merchant
    const req = createMockRequest(adminUserId);
    const { mId, uId } = await createMerchant(AccountStatus.PENDING);
    await approveMerchant(req, { params: Promise.resolve({ id: mId }) as any });

    // 2. Attempt to hit a Phase 2A endpoint (e.g. Wallet GET) as that merchant
    const { GET: getWallet } = await import("@/app/api/v1/merchant/wallet/route");
    
    const merchantReq = new NextRequest("http://localhost:3000/api/v1/merchant/wallet");
    (auth.api.getSession as any).mockResolvedValue({ user: { id: uId } });

    const res = await getWallet(merchantReq);
    expect(res.status).toBe(403);
    
    const body = await res.json();
    expect(body.error.message).toContain("Merchant KYC is not approved");
  });
});


describe("Admin Merchant Account Suspension API", () => {
  const adminUserId = "test-admin-user";
  
  function createSuspendRequest(userId: string | null) {
    if (userId) {
      (auth.api.getSession as any).mockResolvedValue({ user: { id: userId } });
    } else {
      (auth.api.getSession as any).mockResolvedValue(null);
    }
    return new NextRequest("http://localhost:3000/api/v1/admin/merchants/test/suspend", { method: "POST" });
  }

  it("suspends merchant, creates audit log, and revokes sessions", async () => {
    // 1. Create ACTIVE merchant
    const mId = "suspend-test-m1";
    const uId = "suspend-test-u1";
    await db.user.create({ data: { id: uId, email: "susp@test.com", name: "M", role: "MERCHANT" } });
    await db.merchantProfile.create({
      data: { id: mId, userId: uId, businessName: "Susp M", accountStatus: AccountStatus.ACTIVE }
    });

    // 2. Create dummy session for the merchant
    await db.session.create({
      data: {
        id: "dummy-session",
        userId: uId,
        token: "dummy-token",
        expiresAt: new Date(Date.now() + 100000)
      }
    });

    // 3. Suspend
    const req = createSuspendRequest(adminUserId);
    const res = await suspendMerchant(req, { params: Promise.resolve({ id: mId }) as any });
    expect(res.status).toBe(200);

    // 4. Verify DB
    const profile = await db.merchantProfile.findUnique({ where: { id: mId } });
    expect(profile?.accountStatus).toBe(AccountStatus.SUSPENDED);

    const sessions = await db.session.findMany({ where: { userId: uId } });
    expect(sessions.length).toBe(0); // session is revoked!

    const logs = await db.auditLog.findMany({ where: { entityId: mId, action: "SUSPEND" } });
    expect(logs.length).toBe(1);
  });

  it("fails to suspend a DELETED merchant", async () => {
    const mId = "suspend-del-m1";
    const uId = "suspend-del-u1";
    await db.user.create({ data: { id: uId, email: "sdel@test.com", name: "M", role: "MERCHANT" } });
    await db.merchantProfile.create({
      data: { id: mId, userId: uId, businessName: "Del M", accountStatus: AccountStatus.DELETED }
    });

    const req = createSuspendRequest(adminUserId);
    const res = await suspendMerchant(req, { params: Promise.resolve({ id: mId }) as any });
    
    // Check if it fails
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("Cannot suspend a deleted account");
  });
});
