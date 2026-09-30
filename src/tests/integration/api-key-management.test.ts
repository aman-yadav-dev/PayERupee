import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/infrastructure/database/db";
import { POST, GET } from "@/app/api/v1/merchant/api-keys/route";
import { DELETE } from "@/app/api/v1/merchant/api-keys/[id]/route";
import { authenticateApiKey } from "@/modules/auth/application/api-auth.service";
import { Environment, AuditEntity, AuditAction } from "@prisma/client";

vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    }
  }
}));
import { auth } from "@/modules/auth/infrastructure/auth";

describe("Merchant API Key Management", () => {
  const mockUserId1 = "test-user-api-mgt-1";
  const mockMerchantId1 = "test-merch-api-mgt-1";

  const mockUserId2 = "test-user-api-mgt-2";
  const mockMerchantId2 = "test-merch-api-mgt-2";

  beforeEach(async () => {
    // Setup Merchant 1 (Active, KYC Approved)
    await db.user.create({
      data: { id: mockUserId1, name: "API Mgt User 1", email: "mgt1@test.com" }
    });
    await db.merchantProfile.create({
      data: { id: mockMerchantId1, userId: mockUserId1, businessName: "API Mgt Merch 1", accountStatus: "ACTIVE" }
    });
    await db.kycApplication.create({
      data: { merchantProfileId: mockMerchantId1,
          cycles: { create: { cycleNumber: 1, formVersion: { create: { status: "PUBLISHED", versionNumber: 1, form: { create: { name: "Test Form" } } } }, status: "APPROVED", isCurrentCycle: true } }
    },
        include: { cycles: true }
    });

    // Setup Merchant 2 (Active, KYC Approved)
    await db.user.create({
      data: { id: mockUserId2, name: "API Mgt User 2", email: "mgt2@test.com" }
    });
    await db.merchantProfile.create({
      data: { id: mockMerchantId2, userId: mockUserId2, businessName: "API Mgt Merch 2", accountStatus: "ACTIVE" }
    });
    await db.kycApplication.create({
      data: { merchantProfileId: mockMerchantId2,
          cycles: { create: { cycleNumber: 1, formVersion: { create: { status: "PUBLISHED", versionNumber: 1, form: { create: { name: "Test Form" } } } }, status: "APPROVED", isCurrentCycle: true } }
    },
        include: { cycles: true }
    });
  });

  afterEach(async () => {
    try {
      await db.auditLog.deleteMany();
      await db.apiKey.deleteMany();
      await db.kycApplication.deleteMany();
      await db.merchantProfile.deleteMany();
      await db.user.deleteMany();
    } catch (e) {
      console.error("Cleanup error:", e);
    }
    vi.resetAllMocks();
  });

  function mockSession(userId: string, role: string = "MERCHANT") {
    (auth.api.getSession as any).mockResolvedValue({
      session: { id: "sess-1", userId, expiresAt: new Date(Date.now() + 10000) },
      user: { id: userId, email: "u@test.com", role }
    });
  }

  function mockHeaders() {
    return new Headers({
      "x-forwarded-for": "127.0.0.1",
      "user-agent": "test-agent"
    });
  }

  describe("AUTH & VALIDATION", () => {
    it("rejects unauthenticated requests", async () => {
      (auth.api.getSession as any).mockResolvedValue(null);
      const req = new NextRequest("http://localhost/api/v1/merchant/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: "Key 1", environment: "TEST" })
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("rejects restricted merchant requests (not active)", async () => {
      // Temporarily set to PENDING
      await db.merchantProfile.update({
        where: { id: mockMerchantId1 },
        data: { accountStatus: "PENDING" }
      });
      mockSession(mockUserId1);

      const req = new NextRequest("http://localhost/api/v1/merchant/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: "Key 1", environment: "TEST" })
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("rejects invalid request body (missing name)", async () => {
      mockSession(mockUserId1);
      const req = new NextRequest("http://localhost/api/v1/merchant/api-keys", {
        method: "POST",
        body: JSON.stringify({ environment: "TEST" })
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("GENERATION", () => {
    it("generates a valid LIVE key and persists securely", async () => {
      mockSession(mockUserId1);
      const req = new NextRequest("http://localhost/api/v1/merchant/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: "Prod Key", environment: "LIVE" })
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      
      expect(body.success).toBe(true);
      expect(body.rawSecret).toMatch(/^sk_live_[a-f0-9]{64}$/);
      expect(body.apiKey).toBeDefined();
      expect(body.apiKey.name).toBe("Prod Key");
      expect(body.apiKey.environment).toBe("LIVE");
      expect(body.apiKey.keyPrefix).toBe("sk_live_");
      expect(body.apiKey.keyHash).toBeUndefined(); // NEVER returned

      const dbKey = await db.apiKey.findUnique({ where: { id: body.apiKey.id } });
      expect(dbKey).not.toBeNull();
      expect(dbKey!.keyHash).toBeDefined();
      expect(dbKey!.lastFour).toBe(body.rawSecret.slice(-4));
      
      // Verify audit
      const audit = await db.auditLog.findFirst({
        where: { entityType: AuditEntity.API_KEY, entityId: body.apiKey.id }
      });
      expect(audit).not.toBeNull();
      expect(audit!.action).toBe(AuditAction.CREATE);
      expect((audit!.metadata as any).name).toBe("Prod Key");
      expect((audit!.metadata as any).rawSecret).toBeUndefined();
    });

    it("generates a valid TEST key", async () => {
      mockSession(mockUserId1);
      const req = new NextRequest("http://localhost/api/v1/merchant/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: "Test Key", environment: "TEST" })
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.rawSecret).toMatch(/^sk_test_[a-f0-9]{64}$/);
      expect(body.apiKey.environment).toBe("TEST");
    });
  });

  describe("COMPATIBILITY", () => {
    it("generated key authentically passes through existing api-auth.service.ts", async () => {
      mockSession(mockUserId1);
      const req = new NextRequest("http://localhost/api/v1/merchant/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: "Compat Key", environment: "LIVE" })
      });
      const res = await POST(req);
      const body = await res.json();

      // Ensure that api-auth.service.ts can authenticate this raw secret
      const authenticatedMerchantId = await authenticateApiKey(`Bearer ${body.rawSecret}`);
      expect(authenticatedMerchantId).toBe(mockMerchantId1);
    });
  });

  describe("LIST", () => {
    it("lists own keys and isolates cross-merchant", async () => {
      // Merch 1 generates 1 key
      mockSession(mockUserId1);
      let req = new NextRequest("http://localhost/api/v1/merchant/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: "M1 Key", environment: "LIVE" })
      });
      await POST(req);

      // Merch 2 generates 1 key
      mockSession(mockUserId2);
      req = new NextRequest("http://localhost/api/v1/merchant/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: "M2 Key", environment: "TEST" })
      });
      await POST(req);

      // Merch 1 lists
      mockSession(mockUserId1);
      const listReq = new NextRequest("http://localhost/api/v1/merchant/api-keys", { method: "GET" });
      const listRes = await GET(listReq);
      expect(listRes.status).toBe(200);
      const listBody = await listRes.json();

      expect(listBody.data.length).toBe(1);
      expect(listBody.data[0].name).toBe("M1 Key");
      expect(listBody.data[0].rawSecret).toBeUndefined(); // NEVER returned in list
      expect(listBody.data[0].keyHash).toBeUndefined(); // NEVER returned in list
    });
  });

  describe("REVOCATION", () => {
    it("revokes an active key and maintains idempotent success", async () => {
      mockSession(mockUserId1);
      const req = new NextRequest("http://localhost/api/v1/merchant/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: "Revoke Key", environment: "LIVE" })
      });
      const res = await POST(req);
      const keyId = (await res.json()).apiKey.id;

      // Revoke
      const delReq = new NextRequest(`http://localhost/api/v1/merchant/api-keys/${keyId}`, { method: "DELETE" });
      const delRes = await DELETE(delReq, { params: Promise.resolve({ id: keyId }) as any });
      expect(delRes.status).toBe(200);

      const dbKey = await db.apiKey.findUnique({ where: { id: keyId } });
      expect(dbKey!.isActive).toBe(false);
      expect(dbKey!.revokedAt).toBeDefined();

      // Verify audit
      const audit = await db.auditLog.findFirst({
        where: { entityType: AuditEntity.API_KEY, entityId: keyId, action: AuditAction.UPDATE }
      });
      expect(audit).not.toBeNull();
      expect((audit!.metadata as any).status).toBe("REVOKED");

      // Idempotent retry
      const delRes2 = await DELETE(delReq, { params: Promise.resolve({ id: keyId }) as any });
      expect(delRes2.status).toBe(200);
      
      const dbKey2 = await db.apiKey.findUnique({ where: { id: keyId } });
      expect(dbKey2!.revokedAt?.getTime()).toBe(dbKey!.revokedAt?.getTime()); // Time unchanged
    });

    it("returns 404 for nonexistent or foreign keys", async () => {
      // Merch 1 generates key
      mockSession(mockUserId1);
      const req = new NextRequest("http://localhost/api/v1/merchant/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: "M1 Key", environment: "LIVE" })
      });
      const res = await POST(req);
      const keyId = (await res.json()).apiKey.id;

      // Merch 2 tries to revoke it
      mockSession(mockUserId2);
      const delReq = new NextRequest(`http://localhost/api/v1/merchant/api-keys/${keyId}`, { method: "DELETE" });
      const delRes = await DELETE(delReq, { params: Promise.resolve({ id: keyId }) as any });
      expect(delRes.status).toBe(404);
    });
  });

  describe("LIMIT & CONCURRENCY", () => {
    it("enforces maximum 5 active keys per environment", async () => {
      mockSession(mockUserId1);
      
      for (let i = 0; i < 5; i++) {
        const req = new NextRequest("http://localhost/api/v1/merchant/api-keys", {
          method: "POST",
          body: JSON.stringify({ name: `Key ${i}`, environment: "LIVE" })
        });
        const res = await POST(req);
        expect(res.status).toBe(201);
      }

      // 6th key should fail
      const req6 = new NextRequest("http://localhost/api/v1/merchant/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: `Key 6`, environment: "LIVE" })
      });
      const res6 = await POST(req6);
      expect(res6.status).toBe(409);

      // But TEST environment still has room
      const reqTest = new NextRequest("http://localhost/api/v1/merchant/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: `Key Test`, environment: "TEST" })
      });
      const resTest = await POST(reqTest);
      expect(resTest.status).toBe(201);
    });

    it("prevents limit bypass under concurrent requests", async () => {
      mockSession(mockUserId2);
      
      // Make 10 concurrent requests for LIVE environment
      const reqs = Array.from({ length: 10 }).map((_, i) => {
        const req = new NextRequest("http://localhost/api/v1/merchant/api-keys", {
          method: "POST",
          body: JSON.stringify({ name: `Concurrent ${i}`, environment: "LIVE" })
        });
        return POST(req);
      });

      const responses = await Promise.all(reqs);
      
      const successful = responses.filter(r => r.status === 201);
      const conflicts = responses.filter(r => r.status === 409);

      // Exactly 5 should succeed, the rest should conflict due to locking
      expect(successful.length).toBe(5);
      expect(conflicts.length).toBe(5);
    });
  });
});
