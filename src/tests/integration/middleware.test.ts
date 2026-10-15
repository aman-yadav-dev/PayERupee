import { describe, it, expect } from "vitest";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

describe("Edge Middleware Security", () => {
  function createMockRequest(path: string, authHeader?: string): NextRequest {
    const url = new URL(`http://localhost:3000${path}`);
    const headers = new Headers();
    if (authHeader !== undefined) {
      headers.set("authorization", authHeader);
    }
    return new NextRequest(url, { headers });
  }

  describe("Structural API-Key Pre-validation (/api/v1/payouts)", () => {
    it("should return 401 when Authorization header is missing", () => {
      const req = createMockRequest("/api/v1/payouts");
      const res = middleware(req);
      expect(res.status).toBe(401);
    });

    it("should return 401 when Authorization does not start with Bearer", () => {
      const req = createMockRequest("/api/v1/payouts", "Basic xyz");
      const res = middleware(req);
      expect(res.status).toBe(401);
    });

    it("should return 401 when Bearer value is just Bearer ", () => {
      const req = createMockRequest("/api/v1/payouts", "Bearer ");
      const res = middleware(req);
      expect(res.status).toBe(401);
    });

    it("should return 401 when Bearer value is missing", () => {
      const req = createMockRequest("/api/v1/payouts", "Bearer");
      const res = middleware(req);
      expect(res.status).toBe(401);
    });

    it("should pass when structurally valid Bearer token is provided", () => {
      const req = createMockRequest("/api/v1/payouts", "Bearer sk_test_12345");
      const res = middleware(req);
      expect(res.status).toBe(200); // NextResponse.next() defaults to 200/undefined, wait, .next() doesn't have 200 explicitly but it's not 401
      expect(res.headers.get("x-middleware-next")).toBe("1"); // Identifies it as NextResponse.next()
    });
  });

  describe("Routing Boundaries Bypasses", () => {
    it("should bypass structural validation for /api/webhooks/payouts", () => {
      const req = createMockRequest("/api/webhooks/payouts"); // missing auth header
      const res = middleware(req);
      expect(res.status).not.toBe(401);
      expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("should bypass structural validation for /api/v1/auth/login", () => {
      const req = createMockRequest("/api/v1/auth/login"); // missing auth header
      const res = middleware(req);
      expect(res.status).not.toBe(401);
      expect(res.headers.get("x-middleware-next")).toBe("1");
    });

    it("should bypass structural validation for frontend routes", () => {
      const req = createMockRequest("/dashboard");
      const res = middleware(req);
      expect(res.status).not.toBe(401);
    });
  });

  describe("Global Security Headers", () => {
    it("should apply security headers to rejected requests", () => {
      const req = createMockRequest("/api/v1/payouts");
      const res = middleware(req);
      expect(res.headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    });

    it("should apply security headers to passed requests", () => {
      const req = createMockRequest("/dashboard");
      const res = middleware(req);
      expect(res.headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    });
  });

  describe("Transient Verification Cookie Consumption (/verify-result)", () => {
    it("should delete payERupee_verification_fresh cookie if present on /verify-result", () => {
      const req = createMockRequest("/verify-result");
      req.cookies.set("payERupee_verification_fresh", "1");
      const res = middleware(req);

      const setCookieHeader = res.headers.get("set-cookie");
      expect(setCookieHeader).toBeTruthy();
      expect(setCookieHeader).toContain("payERupee_verification_fresh=;");
      expect(setCookieHeader).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    });

    it("should NOT delete payERupee_verification_fresh cookie if NOT on /verify-result", () => {
      const req = createMockRequest("/dashboard");
      req.cookies.set("payERupee_verification_fresh", "1");
      const res = middleware(req);

      const setCookieHeader = res.headers.get("set-cookie");
      expect(setCookieHeader).toBeNull();
    });

    it("should NOT throw or modify cookies if cookie is absent on /verify-result", () => {
      const req = createMockRequest("/verify-result");
      const res = middleware(req);

      const setCookieHeader = res.headers.get("set-cookie");
      expect(setCookieHeader).toBeNull();
    });
  });

  describe("Admin Route & API Protection", () => {
    it("should redirect unauthenticated /admin/dashboard to /admin/login", () => {
      const req = createMockRequest("/admin/dashboard");
      const res = middleware(req);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/admin/login?callbackUrl=%2Fadmin%2Fdashboard");
    });

    it("should allow unauthenticated access to /admin/login", () => {
      const req = createMockRequest("/admin/login");
      const res = middleware(req);
      expect(res.status).not.toBe(307);
      expect(res.status).not.toBe(401);
    });

    it("should allow /admin/dashboard when better-auth.session_token is present", () => {
      const req = createMockRequest("/admin/dashboard");
      req.cookies.set("better-auth.session_token", "valid-token");
      const res = middleware(req);
      expect(res.status).not.toBe(307);
      expect(res.status).not.toBe(401);
    });

    it("should return 401 for /api/v1/admin/merchants without session or auth header", () => {
      const req = createMockRequest("/api/v1/admin/merchants");
      const res = middleware(req);
      expect(res.status).toBe(401);
    });

    it("should allow /api/v1/admin/merchants when better-auth.session_token is present", () => {
      const req = createMockRequest("/api/v1/admin/merchants");
      req.cookies.set("better-auth.session_token", "valid-token");
      const res = middleware(req);
      expect(res.status).not.toBe(401);
    });

    it("should allow /api/v1/admin/merchants when Authorization header is present", () => {
      const req = createMockRequest("/api/v1/admin/merchants", "Bearer test-admin-token");
      const res = middleware(req);
      expect(res.status).not.toBe(401);
    });
  });
});
