import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/infrastructure/database/db";
import { auth } from "@/modules/auth/infrastructure/auth";
import { GET, PATCH } from "@/app/api/v1/merchant/settings/notifications/route";

vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    }
  }
}));

describe("Notification Preferences API", () => {
  let mockUserId = "test-user-np";
  let mockMerchantId = "test-merchant-np";

  beforeEach(async () => {
    await db.notificationPreference.deleteMany({});
    await db.kycApplication.deleteMany({ where: { merchantProfileId: mockMerchantId } });
    await db.merchantProfile.deleteMany({ where: { id: mockMerchantId } });
    await db.user.deleteMany({ where: { id: mockUserId } });

    await db.user.create({ data: { id: mockUserId, name: "NP User", email: "np@test.com" } });
    await db.merchantProfile.create({
      data: { id: mockMerchantId, userId: mockUserId, accountStatus: "ACTIVE" }
    });
  });

  afterEach(async () => {
    await db.notificationPreference.deleteMany({});
    await db.kycApplication.deleteMany({ where: { merchantProfileId: mockMerchantId } });
    await db.merchantProfile.deleteMany({ where: { id: mockMerchantId } });
    await db.user.deleteMany({ where: { id: mockUserId } });
    vi.resetAllMocks();
  });

  const mockSession = (userId: string) => {
    (auth.api.getSession as any).mockResolvedValue({
      user: { id: userId, emailVerified: true },
    });
  };

  it("1. GET /notifications unauthenticated rejected", async () => {
    (auth.api.getSession as any).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/v1/merchant/settings/notifications");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("2. PATCH /notifications unauthenticated rejected", async () => {
    (auth.api.getSession as any).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/v1/merchant/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify({ loginEmailsEnabled: false })
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("3. Authenticated merchant with NO preference row returns TRUE/TRUE (opt-out model)", async () => {
    mockSession(mockUserId);
    const req = new NextRequest("http://localhost/api/v1/merchant/settings/notifications");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.loginEmailsEnabled).toBe(true);
    expect(body.data.kycEmailsEnabled).toBe(true);
    
    // Ensure DB still has no row (do not pollute DB for default readers)
    const count = await db.notificationPreference.count();
    expect(count).toBe(0);
  });

  it("4. PATCH loginEmailsEnabled=false persists correctly", async () => {
    mockSession(mockUserId);
    const req = new NextRequest("http://localhost/api/v1/merchant/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify({ loginEmailsEnabled: false })
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.loginEmailsEnabled).toBe(false);
    expect(body.data.kycEmailsEnabled).toBe(true); // Defaulted to true

    const dbRow = await db.notificationPreference.findUnique({ where: { userId: mockUserId } });
    expect(dbRow!.loginEmailsEnabled).toBe(false);
    expect(dbRow!.kycEmailsEnabled).toBe(true);
  });

  it("5. PATCH kycEmailsEnabled=false persists correctly", async () => {
    mockSession(mockUserId);
    const req = new NextRequest("http://localhost/api/v1/merchant/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify({ kycEmailsEnabled: false })
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.loginEmailsEnabled).toBe(true);
    expect(body.data.kycEmailsEnabled).toBe(false);
  });

  it("6. PATCH both values persists correctly", async () => {
    mockSession(mockUserId);
    const req = new NextRequest("http://localhost/api/v1/merchant/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify({ loginEmailsEnabled: false, kycEmailsEnabled: false })
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.loginEmailsEnabled).toBe(false);
    expect(body.data.kycEmailsEnabled).toBe(false);
  });

  it("7. Partial PATCH works on existing row", async () => {
    mockSession(mockUserId);
    // Create initial row
    await db.notificationPreference.create({
      data: { userId: mockUserId, loginEmailsEnabled: false, kycEmailsEnabled: false }
    });

    const req = new NextRequest("http://localhost/api/v1/merchant/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify({ loginEmailsEnabled: true })
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    
    // login changed, kyc remained same
    expect(body.data.loginEmailsEnabled).toBe(true);
    expect(body.data.kycEmailsEnabled).toBe(false);
  });

  it("8. Invalid string boolean rejected", async () => {
    mockSession(mockUserId);
    const req = new NextRequest("http://localhost/api/v1/merchant/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify({ loginEmailsEnabled: "false" })
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("expected boolean, received string");
  });

  it("9. Invalid null rejected", async () => {
    mockSession(mockUserId);
    const req = new NextRequest("http://localhost/api/v1/merchant/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify({ loginEmailsEnabled: null })
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("10. Unknown field rejected safely by strict schema", async () => {
    mockSession(mockUserId);
    const req = new NextRequest("http://localhost/api/v1/merchant/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify({ loginEmailsEnabled: false, randomField: true })
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Unrecognized key");
  });

  it("11. IDOR: Cannot modify another merchant by passing userId", async () => {
    // Create another user
    const mockUserIdB = "test-user-np2";
    await db.user.create({ data: { id: mockUserIdB, name: "B", email: "b@test.com" } });
    await db.merchantProfile.create({
      data: { id: "test-merchant-np2", userId: mockUserIdB, accountStatus: "ACTIVE" }
    });

    // Authenticate as A
    mockSession(mockUserId);
    
    // Try to update B
    const req = new NextRequest("http://localhost/api/v1/merchant/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify({ userId: mockUserIdB, loginEmailsEnabled: false })
    });
    
    const res = await PATCH(req);
    expect(res.status).toBe(400); // Fails because userId is an unrecognized key (strict mode)
    
    // Even if it didn't fail strict mode, it wouldn't update B
    const bPref = await db.notificationPreference.findUnique({ where: { userId: mockUserIdB } });
    expect(bPref).toBeNull(); // B still has no row

    // Cleanup B
    await db.merchantProfile.delete({ where: { userId: mockUserIdB } });
    await db.user.delete({ where: { id: mockUserIdB } });
  });

  it("12. Repeated PATCH is idempotent", async () => {
    mockSession(mockUserId);
    const req1 = new NextRequest("http://localhost/api/v1/merchant/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify({ kycEmailsEnabled: false })
    });
    const res1 = await PATCH(req1);
    expect(res1.status).toBe(200);

    // Repeated patch with same values
    const req2 = new NextRequest("http://localhost/api/v1/merchant/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify({ kycEmailsEnabled: false })
    });
    const res2 = await PATCH(req2);
    expect(res2.status).toBe(200);

    const count = await db.notificationPreference.count({ where: { userId: mockUserId } });
    expect(count).toBe(1); // Still exactly 1 row
  });
});
