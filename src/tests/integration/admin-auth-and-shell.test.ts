import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/infrastructure/database/db";
import { UserRole } from "@prisma/client";
import { requireAdmin, requireSuperAdmin, ForbiddenError, UnauthorizedError } from "@/modules/auth/application/session-auth.service";
import { resolveAuthDestination } from "@/modules/auth/application/destination.service";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));
import { auth } from "@/modules/auth/infrastructure/auth";

describe("Admin Console Foundation & Authorization Gates (Phase 1)", () => {
  const adminId = "admin-test-gate-1";
  const superAdminId = "super-admin-test-gate-1";
  const merchantId = "merchant-test-gate-1";

  beforeEach(async () => {
    // Seed users with respective roles
    await db.user.upsert({
      where: { id: adminId },
      update: { role: UserRole.ADMIN },
      create: { id: adminId, email: "admin-gate@test.com", name: "Gate Admin", role: UserRole.ADMIN },
    });

    await db.user.upsert({
      where: { id: superAdminId },
      update: { role: UserRole.SUPER_ADMIN },
      create: { id: superAdminId, email: "super-gate@test.com", name: "Gate Super Admin", role: UserRole.SUPER_ADMIN },
    });

    await db.user.upsert({
      where: { id: merchantId },
      update: { role: UserRole.MERCHANT },
      create: { id: merchantId, email: "merch-gate@test.com", name: "Gate Merchant", role: UserRole.MERCHANT },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function mockSession(userId: string | null) {
    if (userId) {
      (auth.api.getSession as any).mockResolvedValue({
        user: { id: userId },
        session: { id: `session-${userId}` },
      });
    } else {
      (auth.api.getSession as any).mockResolvedValue(null);
    }
  }

  describe("1. requireAdmin and requireSuperAdmin Gates", () => {
    it("should throw UnauthorizedError when no session exists", async () => {
      mockSession(null);
      const req = new NextRequest("http://localhost:3000/api/v1/admin/test");

      await expect(requireAdmin(req)).rejects.toThrow(UnauthorizedError);
      await expect(requireSuperAdmin(req)).rejects.toThrow(UnauthorizedError);
    });

    it("should reject MERCHANT role with ForbiddenError on both gates", async () => {
      mockSession(merchantId);
      const req = new NextRequest("http://localhost:3000/api/v1/admin/test");

      await expect(requireAdmin(req)).rejects.toThrow(ForbiddenError);
      await expect(requireSuperAdmin(req)).rejects.toThrow(ForbiddenError);
    });

    it("should allow ADMIN role on requireAdmin, but reject on requireSuperAdmin", async () => {
      mockSession(adminId);
      const req = new NextRequest("http://localhost:3000/api/v1/admin/test");

      const session = await requireAdmin(req);
      expect(session.user.id).toBe(adminId);

      await expect(requireSuperAdmin(req)).rejects.toThrow(ForbiddenError);
    });

    it("should allow SUPER_ADMIN role on BOTH requireAdmin and requireSuperAdmin", async () => {
      mockSession(superAdminId);
      const req = new NextRequest("http://localhost:3000/api/v1/admin/test");

      const adminSession = await requireAdmin(req);
      expect(adminSession.user.id).toBe(superAdminId);

      const superSession = await requireSuperAdmin(req);
      expect(superSession.user.id).toBe(superAdminId);
    });
  });

  describe("2. resolveAuthDestination Routing Matrix", () => {
    it("should route ADMIN users directly to /admin/dashboard bypassing merchant profile", () => {
      const dest = resolveAuthDestination({
        session: { user: { id: adminId, emailVerified: true, role: UserRole.ADMIN } },
        profile: null,
      });
      expect(dest).toBe("/admin/dashboard");
    });

    it("should route SUPER_ADMIN users directly to /admin/dashboard bypassing merchant profile", () => {
      const dest = resolveAuthDestination({
        session: { user: { id: superAdminId, emailVerified: true, role: UserRole.SUPER_ADMIN } },
        profile: null,
      });
      expect(dest).toBe("/admin/dashboard");
    });

    it("should route MERCHANT users with null profile to /onboarding", () => {
      const dest = resolveAuthDestination({
        session: { user: { id: merchantId, emailVerified: true, role: UserRole.MERCHANT } },
        profile: null,
      });
      expect(dest).toBe("/onboarding");
    });
  });

  describe("3. Edge Middleware Route Protection", () => {
    function createRequest(path: string, options: { cookie?: string; authHeader?: string } = {}) {
      const url = new URL(`http://localhost:3000${path}`);
      const headers = new Headers();
      if (options.authHeader) headers.set("authorization", options.authHeader);
      const req = new NextRequest(url, { headers });
      if (options.cookie) req.cookies.set("better-auth.session_token", options.cookie);
      return req;
    }

    it("should redirect unauthenticated access to /admin/dashboard to /admin/login with callbackUrl", () => {
      const req = createRequest("/admin/dashboard");
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/admin/login?callbackUrl=%2Fadmin%2Fdashboard");
    });

    it("should allow unauthenticated access to /admin/login without redirect", () => {
      const req = createRequest("/admin/login");
      const res = middleware(req);
      expect(res.status).not.toBe(307);
      expect(res.status).not.toBe(401);
    });

    it("should allow /admin/dashboard when session token cookie is present", () => {
      const req = createRequest("/admin/dashboard", { cookie: "mock-session-token" });
      const res = middleware(req);
      expect(res.status).not.toBe(307);
      expect(res.status).not.toBe(401);
    });

    it("should block unauthenticated access to /api/v1/admin/kyc/applications with 401", () => {
      const req = createRequest("/api/v1/admin/kyc/applications");
      const res = middleware(req);
      expect(res.status).toBe(401);
    });

    it("should allow access to /api/v1/admin/kyc/applications when session cookie exists", () => {
      const req = createRequest("/api/v1/admin/kyc/applications", { cookie: "mock-session-token" });
      const res = middleware(req);
      expect(res.status).not.toBe(401);
    });
  });
});
