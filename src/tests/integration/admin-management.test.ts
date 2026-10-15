import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { NextRequest } from "next/server";
import { UserRole, AuditActorType, AuditEntity, AuditAction } from "@prisma/client";

// Import route handlers
import { GET as getAdmins, POST as createAdmin } from "@/app/api/v1/admin/admins/route";
import { PATCH as updateAdminRole, DELETE as deleteAdmin } from "@/app/api/v1/admin/admins/[id]/route";
import { DELETE as revokeAdminSessions } from "@/app/api/v1/admin/admins/[id]/sessions/route";

// Mock Better Auth
vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      signUpEmail: vi.fn(),
    },
  },
}));
import { auth } from "@/modules/auth/infrastructure/auth";

describe("Administrator Governance Integration Tests (SUPER_ADMIN Controls)", () => {
  const superAdminId = "test-super-admin-gov";
  const ordinaryAdminId = "test-admin-gov";
  const merchantId = "test-merchant-gov";
  let targetAdminId = "test-target-admin-gov";

  function mockSession(userId: string) {
    (auth.api.getSession as any).mockResolvedValue({
      user: { id: userId },
      session: { id: `session-${userId}` },
    });
  }

  function mockUnauthenticated() {
    (auth.api.getSession as any).mockResolvedValue(null);
  }

  beforeEach(async () => {
    // 1. Seed Super Admin
    await db.user.upsert({
      where: { id: superAdminId },
      update: { role: UserRole.SUPER_ADMIN, emailVerified: true },
      create: {
        id: superAdminId,
        email: "superadmin-gov@payerupee.test",
        name: "Test Super Admin",
        role: UserRole.SUPER_ADMIN,
        emailVerified: true,
      },
    });

    // 2. Seed Ordinary Admin
    await db.user.upsert({
      where: { id: ordinaryAdminId },
      update: { role: UserRole.ADMIN, emailVerified: true },
      create: {
        id: ordinaryAdminId,
        email: "admin-gov@payerupee.test",
        name: "Test Admin",
        role: UserRole.ADMIN,
        emailVerified: true,
      },
    });

    // 3. Seed Merchant
    await db.user.upsert({
      where: { id: merchantId },
      update: { role: UserRole.MERCHANT, emailVerified: true },
      create: {
        id: merchantId,
        email: "merchant-gov@payerupee.test",
        name: "Test Merchant",
        role: UserRole.MERCHANT,
        emailVerified: true,
      },
    });

    // 4. Seed Target Admin for modifications
    await db.user.upsert({
      where: { id: targetAdminId },
      update: { role: UserRole.ADMIN, emailVerified: true },
      create: {
        id: targetAdminId,
        email: "target-admin-gov@payerupee.test",
        name: "Target Admin",
        role: UserRole.ADMIN,
        emailVerified: true,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/v1/admin/admins", () => {
    it("rejects unauthenticated request with 401", async () => {
      mockUnauthenticated();
      const req = new NextRequest("http://localhost/api/v1/admin/admins");
      const res = await getAdmins(req);
      expect(res.status).toBe(401);
    });

    it("rejects merchant request with 403", async () => {
      mockSession(merchantId);
      const req = new NextRequest("http://localhost/api/v1/admin/admins");
      const res = await getAdmins(req);
      expect(res.status).toBe(403);
    });

    it("rejects ordinary ADMIN request with 403 (SUPER_ADMIN required)", async () => {
      mockSession(ordinaryAdminId);
      const req = new NextRequest("http://localhost/api/v1/admin/admins");
      const res = await getAdmins(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Super Admin access required");
    });

    it("allows SUPER_ADMIN and returns list with active session count", async () => {
      mockSession(superAdminId);

      // Create a test session for targetAdmin
      await db.session.create({
        data: {
          id: "session-target-1",
          userId: targetAdminId,
          token: "token-target-1",
          expiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const req = new NextRequest("http://localhost/api/v1/admin/admins");
      const res = await getAdmins(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);

      const foundTarget = json.data.find((a: any) => a.id === targetAdminId);
      expect(foundTarget).toBeDefined();
      expect(foundTarget.role).toBe("ADMIN");
      expect(foundTarget.activeSessionsCount).toBeGreaterThanOrEqual(1);

      // Clean up session
      await db.session.deleteMany({ where: { userId: targetAdminId } });
    });
  });

  describe("POST /api/v1/admin/admins", () => {
    it("rejects ordinary ADMIN with 403 (SUPER_ADMIN required)", async () => {
      mockSession(ordinaryAdminId);
      const req = new NextRequest("http://localhost/api/v1/admin/admins", {
        method: "POST",
        body: JSON.stringify({
          name: "New Admin",
          email: "newadmin@payerupee.test",
          role: "ADMIN",
          password: "SecurePassword123!",
        }),
      });

      const res = await createAdmin(req);
      expect(res.status).toBe(403);
    });

    it("rejects invalid input with 400", async () => {
      mockSession(superAdminId);
      const req = new NextRequest("http://localhost/api/v1/admin/admins", {
        method: "POST",
        body: JSON.stringify({
          name: "A", // too short
          email: "invalid-email",
          role: "UNKNOWN",
          password: "short", // < 10 chars
        }),
      });

      const res = await createAdmin(req);
      expect(res.status).toBe(400);
    });

    it("rejects email conflict with merchant with 409", async () => {
      mockSession(superAdminId);
      const req = new NextRequest("http://localhost/api/v1/admin/admins", {
        method: "POST",
        body: JSON.stringify({
          name: "Merchant Hijack",
          email: "merchant-gov@payerupee.test",
          role: "ADMIN",
          password: "SecurePassword123!",
        }),
      });

      const res = await createAdmin(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toContain("Merchant");
    });

    it("rejects email conflict with existing admin with 409", async () => {
      mockSession(superAdminId);
      const req = new NextRequest("http://localhost/api/v1/admin/admins", {
        method: "POST",
        body: JSON.stringify({
          name: "Duplicate Admin",
          email: "admin-gov@payerupee.test",
          role: "ADMIN",
          password: "SecurePassword123!",
        }),
      });

      const res = await createAdmin(req);
      expect(res.status).toBe(409);
    });

    it("provisions new admin via Better Auth, sets role, and creates audit log", async () => {
      mockSession(superAdminId);

      const newAdminEmail = "brand-new-admin@payerupee.test";
      const provisionedUserId = "prov-user-" + Date.now();

      // Mock auth.api.signUpEmail to create the user during signup call
      (auth.api.signUpEmail as any).mockImplementation(async ({ body }: any) => {
        const u = await db.user.create({
          data: {
            id: provisionedUserId,
            email: body.email,
            name: body.name,
            role: UserRole.MERCHANT, // initial before role elevation
            emailVerified: false,
          },
        });
        return { user: u };
      });

      const req = new NextRequest("http://localhost/api/v1/admin/admins", {
        method: "POST",
        body: JSON.stringify({
          name: "Brand New Admin",
          email: newAdminEmail,
          role: "ADMIN",
          password: "SecurePassword123!",
        }),
      });

      const res = await createAdmin(req);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.email).toBe(newAdminEmail);
      expect(json.data.role).toBe("ADMIN");

      // Verify database role was updated
      const updatedInDb = await db.user.findUnique({ where: { id: provisionedUserId } });
      expect(updatedInDb!.role).toBe(UserRole.ADMIN);
      expect(updatedInDb!.emailVerified).toBe(true);

      // Verify audit log
      const log = await db.auditLog.findFirst({
        where: {
          entityType: AuditEntity.USER,
          entityId: provisionedUserId,
          action: AuditAction.CREATE,
        },
      });
      expect(log).toBeDefined();
      expect(log!.actorId).toBe(superAdminId);

      // Clean up
      await db.user.delete({ where: { id: provisionedUserId } });
    });
  });

  describe("PATCH /api/v1/admin/admins/[id]", () => {
    it("rejects ordinary ADMIN with 403", async () => {
      mockSession(ordinaryAdminId);
      const req = new NextRequest(`http://localhost/api/v1/admin/admins/${targetAdminId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: "SUPER_ADMIN" }),
      });

      const res = await updateAdminRole(req, {
        params: Promise.resolve({ id: targetAdminId }),
      });
      expect(res.status).toBe(403);
    });

    it("successfully promotes an ADMIN to SUPER_ADMIN", async () => {
      mockSession(superAdminId);
      const req = new NextRequest(`http://localhost/api/v1/admin/admins/${targetAdminId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: "SUPER_ADMIN" }),
      });

      const res = await updateAdminRole(req, {
        params: Promise.resolve({ id: targetAdminId }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.role).toBe("SUPER_ADMIN");

      const dbUser = await db.user.findUnique({ where: { id: targetAdminId } });
      expect(dbUser!.role).toBe(UserRole.SUPER_ADMIN);

      // Verify audit log
      const log = await db.auditLog.findFirst({
        where: {
          entityType: AuditEntity.USER,
          entityId: targetAdminId,
          action: AuditAction.UPDATE,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(log).toBeDefined();
      expect((log!.metadata as any).newRole).toBe("SUPER_ADMIN");
    });

    it("prevents demoting the last SUPER_ADMIN with 403", async () => {
      mockSession(superAdminId);

      // Ensure targetAdmin is ADMIN, so superAdminId is the ONLY SUPER_ADMIN
      await db.user.update({
        where: { id: targetAdminId },
        data: { role: UserRole.ADMIN },
      });

      // Attempt to demote superAdminId to ADMIN
      const req = new NextRequest(`http://localhost/api/v1/admin/admins/${superAdminId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: "ADMIN" }),
      });

      const res = await updateAdminRole(req, {
        params: Promise.resolve({ id: superAdminId }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Cannot demote the only remaining SUPER_ADMIN");
    });
  });

  describe("DELETE /api/v1/admin/admins/[id]", () => {
    it("rejects ordinary ADMIN with 403", async () => {
      mockSession(ordinaryAdminId);
      const req = new NextRequest(`http://localhost/api/v1/admin/admins/${targetAdminId}`, {
        method: "DELETE",
      });

      const res = await deleteAdmin(req, {
        params: Promise.resolve({ id: targetAdminId }),
      });
      expect(res.status).toBe(403);
    });

    it("rejects self-deletion with 403", async () => {
      mockSession(superAdminId);
      const req = new NextRequest(`http://localhost/api/v1/admin/admins/${superAdminId}`, {
        method: "DELETE",
      });

      const res = await deleteAdmin(req, {
        params: Promise.resolve({ id: superAdminId }),
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Self-deletion prohibited");
    });

    it("revokes admin access, demotes to MERCHANT, evicts sessions, and logs DELETE", async () => {
      mockSession(superAdminId);

      // Create a session for targetAdmin
      await db.session.create({
        data: {
          id: "session-target-revoke-1",
          userId: targetAdminId,
          token: "token-target-revoke-1",
          expiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const req = new NextRequest(`http://localhost/api/v1/admin/admins/${targetAdminId}`, {
        method: "DELETE",
      });

      const res = await deleteAdmin(req, {
        params: Promise.resolve({ id: targetAdminId }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);

      // Verify demoted to MERCHANT
      const updatedUser = await db.user.findUnique({ where: { id: targetAdminId } });
      expect(updatedUser!.role).toBe(UserRole.MERCHANT);

      // Verify all sessions evicted
      const remainingSessions = await db.session.count({ where: { userId: targetAdminId } });
      expect(remainingSessions).toBe(0);

      // Verify audit log
      const log = await db.auditLog.findFirst({
        where: {
          entityType: AuditEntity.USER,
          entityId: targetAdminId,
          action: AuditAction.DELETE,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(log).toBeDefined();
      expect((log!.metadata as any).sessionsRevoked).toBe(true);
    });
  });

  describe("DELETE /api/v1/admin/admins/[id]/sessions", () => {
    it("rejects ordinary ADMIN with 403", async () => {
      mockSession(ordinaryAdminId);
      const req = new NextRequest(`http://localhost/api/v1/admin/admins/${targetAdminId}/sessions`, {
        method: "DELETE",
      });

      const res = await revokeAdminSessions(req, {
        params: Promise.resolve({ id: targetAdminId }),
      });
      expect(res.status).toBe(403);
    });

    it("hard-revokes active sessions for target admin and logs PROCESS audit event", async () => {
      mockSession(superAdminId);

      // Restore targetAdmin role to ADMIN for this test
      await db.user.update({
        where: { id: targetAdminId },
        data: { role: UserRole.ADMIN },
      });

      // Create 2 test sessions
      await db.session.createMany({
        data: [
          {
            id: "session-sess-1",
            userId: targetAdminId,
            token: "token-sess-1",
            expiresAt: new Date(Date.now() + 86400000),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "session-sess-2",
            userId: targetAdminId,
            token: "token-sess-2",
            expiresAt: new Date(Date.now() + 86400000),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });

      expect(await db.session.count({ where: { userId: targetAdminId } })).toBe(2);

      const req = new NextRequest(`http://localhost/api/v1/admin/admins/${targetAdminId}/sessions`, {
        method: "DELETE",
      });

      const res = await revokeAdminSessions(req, {
        params: Promise.resolve({ id: targetAdminId }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.revokedCount).toBe(2);

      // Verify sessions are gone
      expect(await db.session.count({ where: { userId: targetAdminId } })).toBe(0);

      // Verify audit log
      const log = await db.auditLog.findFirst({
        where: {
          entityType: AuditEntity.USER,
          entityId: targetAdminId,
          action: AuditAction.PROCESS,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(log).toBeDefined();
      expect((log!.metadata as any).operation).toBe("REVOKE_ALL_SESSIONS");
      expect((log!.metadata as any).revokedSessionCount).toBe(2);
    });
  });
});
