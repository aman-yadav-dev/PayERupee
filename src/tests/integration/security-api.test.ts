import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { PUT, GET } from "@/app/api/v1/merchant/settings/security/route";
import { db } from "@/infrastructure/database/db";

// Mock Better Auth session retrieval
vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    }
  }
}));
import { auth } from "@/modules/auth/infrastructure/auth";

describe("Security Settings API Integration", () => {
  const mockUserIdA = "test-sec-user-a";
  const mockMerchantIdA = "test-sec-merchant-a";

  const mockUserIdB = "test-sec-user-b";
  const mockMerchantIdB = "test-sec-merchant-b";

  beforeAll(async () => {
    // Setup Merchant A
    await db.user.create({
      data: { id: mockUserIdA, name: "User A", email: "sec_a@test.com", role: "MERCHANT", emailVerified: true }
    });
    await db.merchantProfile.create({
      data: { id: mockMerchantIdA, userId: mockUserIdA, businessName: "Merchant A", accountStatus: "ACTIVE" }
    });

    // Setup Merchant B
    await db.user.create({
      data: { id: mockUserIdB, name: "User B", email: "sec_b@test.com", role: "MERCHANT", emailVerified: true }
    });
    await db.merchantProfile.create({
      data: { id: mockMerchantIdB, userId: mockUserIdB, businessName: "Merchant B", accountStatus: "ACTIVE" }
    });
  });

  afterAll(async () => {
    await db.securityEvent.deleteMany({});
    await db.merchantSecuritySettings.deleteMany({});
    await db.merchantProfile.deleteMany({
      where: { id: { in: [mockMerchantIdA, mockMerchantIdB] } }
    });
    await db.user.deleteMany({
      where: { id: { in: [mockUserIdA, mockUserIdB] } }
    });
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.securityEvent.deleteMany({});
    await db.merchantSecuritySettings.deleteMany({});
  });

  const mockSession = (userId: string) => {
    (auth.api.getSession as any).mockResolvedValue({
      session: { id: "test-session", userId },
      user: { id: userId, email: "test@test.com", role: "MERCHANT" }
    });
  };

  const makePutReq = (body: any) => {
    return new NextRequest("http://localhost/api/v1/merchant/settings/security", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  };

  const makeGetReq = () => {
    return new NextRequest("http://localhost/api/v1/merchant/settings/security", {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
  };

  it("1. ACTUALLY TEST THE PUT ENDPOINT - should coerce string maxApiPayoutAmount safely without 500 error", async () => {
    mockSession(mockUserIdA);

    const req = makePutReq({
      maxApiPayoutEnabled: true,
      maxApiPayoutAmount: "1500.50"
    });

    const res = await PUT(req);
    const json = await res.json();
    
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    // Verify persisted DB value
    const saved = await db.merchantSecuritySettings.findUnique({
      where: { merchantProfileId: mockMerchantIdA }
    });
    expect(saved).toBeDefined();
    expect(saved?.maxApiPayoutEnabled).toBe(true);
    expect(saved?.maxApiPayoutAmount.toNumber()).toBe(1500.50);
  });

  it("2. TEST PARTIAL UPDATE SAFETY - should update one field and leave others intact", async () => {
    mockSession(mockUserIdA);

    // Create existing settings
    await db.merchantSecuritySettings.create({
      data: {
        merchantProfileId: mockMerchantIdA,
        ipWhitelistEnabled: true,
        allowedIps: ["127.0.0.1"],
        maxApiPayoutEnabled: false,
        maxApiPayoutAmount: 5000,
        suspiciousAlertsEnabled: true,
        loginNotificationsEnabled: true
      }
    });

    // Partial update
    const req = makePutReq({
      maxApiPayoutEnabled: true,
      maxApiPayoutAmount: "1500.50"
    });

    const res = await PUT(req);
    const json = await res.json();
    expect(res.status).toBe(200);

    // Verify DB
    const saved = await db.merchantSecuritySettings.findUnique({
      where: { merchantProfileId: mockMerchantIdA }
    });
    
    // Updated fields
    expect(saved?.maxApiPayoutEnabled).toBe(true);
    expect(saved?.maxApiPayoutAmount.toNumber()).toBe(1500.50);
    
    // Untouched fields
    expect(saved?.ipWhitelistEnabled).toBe(true);
    expect(saved?.allowedIps).toEqual(["127.0.0.1"]);
    expect(saved?.suspiciousAlertsEnabled).toBe(true);
    expect(saved?.loginNotificationsEnabled).toBe(true);
  });

  it("3. TEST INVALID INPUT - returns 400 with controlled JSON", async () => {
    mockSession(mockUserIdA);

    // Invalid IP
    let req = makePutReq({ allowedIps: ["not-an-ip"] });
    let res = await PUT(req);
    let json = await res.json();
    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain("Invalid IP address or CIDR: not-an-ip");

    // Invalid CIDR
    req = makePutReq({ allowedIps: ["192.168.1.0/999"] });
    res = await PUT(req);
    json = await res.json();
    expect(res.status).toBe(400);

    // Negative max amount
    req = makePutReq({ maxApiPayoutAmount: -100 });
    res = await PUT(req);
    json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid data provided for settings.");

    // Malformed JSON handled automatically by Next/Zod but we mock parse failure here if it's structural
    req = makePutReq({ maxApiPayoutAmount: "banana" });
    res = await PUT(req);
    json = await res.json();
    expect(res.status).toBe(400);
  });

  it("4. TEST AUTHORIZATION - unauthorized returns 401, merchant A cannot mutate merchant B", async () => {
    // Unauthenticated request
    (auth.api.getSession as any).mockResolvedValue(null);
    let res = await GET(makeGetReq());
    expect(res.status).toBe(401);

    // Merchant A creates setting
    mockSession(mockUserIdA);
    await PUT(makePutReq({ maxApiPayoutEnabled: true, maxApiPayoutAmount: 100 }));

    // Merchant B gets their own, it should be auto-created and different from A
    mockSession(mockUserIdB);
    res = await GET(makeGetReq());
    let json = await res.json();
    expect(res.status).toBe(200);
    expect(json.settings.maxApiPayoutEnabled).toBe(false); // B's default

    // Merchant B cannot PUT an update that affects Merchant A
    // (There is no merchantProfileId passed in the body, it strictly uses the session context)
    const mutateReq = makePutReq({ maxApiPayoutEnabled: true, maxApiPayoutAmount: 200 });
    await PUT(mutateReq);

    // Verify A was completely untouched by B's mutation
    const savedA = await db.merchantSecuritySettings.findUnique({
      where: { merchantProfileId: mockMerchantIdA }
    });
    expect(savedA?.maxApiPayoutAmount.toNumber()).toBe(100);
  });

  it("5. TEST ALL TOGGLES INDIVIDUALLY", async () => {
    mockSession(mockUserIdA);

    // 1. ipWhitelistEnabled
    let req = makePutReq({ ipWhitelistEnabled: true });
    let res = await PUT(req);
    expect(res.status).toBe(200);

    // 2. maxApiPayoutEnabled
    req = makePutReq({ maxApiPayoutEnabled: true });
    res = await PUT(req);
    expect(res.status).toBe(200);

    // 3. suspiciousAlertsEnabled
    req = makePutReq({ suspiciousAlertsEnabled: true });
    res = await PUT(req);
    expect(res.status).toBe(200);

    req = makePutReq({ suspiciousAlertsEnabled: false });
    res = await PUT(req);
    expect(res.status).toBe(200);

    req = makePutReq({ suspiciousThreshold: 10 });
    res = await PUT(req);
    expect(res.status).toBe(200);

    req = makePutReq({ suspiciousWindowSeconds: 60 });
    res = await PUT(req);
    expect(res.status).toBe(200);

    // 4. loginNotificationsEnabled
    req = makePutReq({ loginNotificationsEnabled: true });
    res = await PUT(req);
    expect(res.status).toBe(200);
  }); // End of 5. TEST ALL TOGGLES INDIVIDUALLY
  describe("Merchant Security Activity Pagination", () => {
    beforeEach(async () => {
      // Create 21 events
      const events = [];
      for (let i = 0; i < 21; i++) {
        events.push({
          merchantProfileId: mockMerchantIdA,
          eventType: "SECURITY_SETTING_CHANGED",
          severity: "LOW",
          description: `Event ${i}`,
          ipAddress: "127.0.0.1",
          createdAt: new Date(Date.now() - i * 1000)
        });
      }
      await db.securityEvent.createMany({ data: events as any });
    });

    const getReq = (url: string) => {
      return new NextRequest(`http://localhost:3000${url}`, { method: "GET" });
    };

    beforeEach(() => {
      vi.clearAllMocks();
      (auth.api.getSession as any).mockResolvedValue({
        session: { userId: mockUserIdA },
        user: { id: mockUserIdA, role: "MERCHANT", merchantProfileId: mockMerchantIdA }
      });
    });

    it("should return default page with 20 records", async () => {
      const { GET: getAct } = await import("@/app/api/v1/merchant/settings/security/activity/route");
      const req = getReq("/api/v1/merchant/settings/security/activity");
      const res = await getAct(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(20);
      expect(json.pagination.total).toBe(21);
      expect(json.pagination.totalPages).toBe(2);
      expect(json.pagination.page).toBe(1);
    });

    it("should return 1 record on page 2", async () => {
      const { GET: getAct } = await import("@/app/api/v1/merchant/settings/security/activity/route");
      const req = getReq("/api/v1/merchant/settings/security/activity?page=2");
      const res = await getAct(req);
      const json = await res.json();
      
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
      expect(json.pagination.page).toBe(2);
    });

    it("should return empty array for out of bounds page", async () => {
      const { GET: getAct } = await import("@/app/api/v1/merchant/settings/security/activity/route");
      const req = getReq("/api/v1/merchant/settings/security/activity?page=3");
      const res = await getAct(req);
      const json = await res.json();
      
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(0);
      expect(json.pagination.page).toBe(3);
    });
  });
});
