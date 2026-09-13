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
});
