import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as outboxGET } from "@/app/api/cron/outbox/route";
import { GET as reconcilerGET } from "@/app/api/cron/reconciler/route";
import * as outboxProcessor from "@/modules/payout/application/outbox.processor";
import { PayoutReconciler } from "@/modules/payout/application/payout.reconciler";
import { NextRequest } from "next/server";
import { env } from "@/config/env";

vi.mock("@/config/env", () => ({
  env: {
    CRON_SECRET: "TEST_SECRET",
    PROVIDER_NAME: "MOCK"
  }
}));

vi.mock("@/modules/payout/application/outbox.processor", () => ({
  processOutbox: vi.fn()
}));

vi.mock("@/modules/payout/application/payout.reconciler", () => ({
  PayoutReconciler: {
    reconcileStalePayouts: vi.fn()
  }
}));

function createMockRequest(authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  
  return {
    headers
  } as unknown as NextRequest;
}

describe("Cron Bridge Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("/api/cron/outbox", () => {
    it("should return 401 when Authorization header is missing", async () => {
      const req = createMockRequest();
      const res = await outboxGET(req);
      
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
      expect(outboxProcessor.processOutbox).not.toHaveBeenCalled();
    });

    it("should return 401 when Authorization header is incorrect", async () => {
      const req = createMockRequest("Bearer WRONG_SECRET");
      const res = await outboxGET(req);
      
      expect(res.status).toBe(401);
      expect(outboxProcessor.processOutbox).not.toHaveBeenCalled();
    });

    it("should process outbox and return 200 when secret is correct", async () => {
      const req = createMockRequest("Bearer TEST_SECRET");
      const res = await outboxGET(req);
      
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.workerId).toContain("cron-outbox-");
      
      expect(outboxProcessor.processOutbox).toHaveBeenCalledTimes(1);
      expect(outboxProcessor.processOutbox).toHaveBeenCalledWith(
        expect.stringContaining("cron-outbox-")
      );
    });

    it("should catch errors and return 500 without leaking secrets", async () => {
      (outboxProcessor.processOutbox as any).mockRejectedValueOnce(new Error("SECRET_DATABASE_ERROR"));
      
      const req = createMockRequest("Bearer TEST_SECRET");
      const res = await outboxGET(req);
      
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Internal Server Error");
      expect(JSON.stringify(body)).not.toContain("SECRET_DATABASE_ERROR");
    });
  });

  describe("/api/cron/reconciler", () => {
    it("should return 401 when Authorization header is missing", async () => {
      const req = createMockRequest();
      const res = await reconcilerGET(req);
      
      expect(res.status).toBe(401);
      expect(PayoutReconciler.reconcileStalePayouts).not.toHaveBeenCalled();
    });

    it("should return 401 when Authorization header is incorrect", async () => {
      const req = createMockRequest("Bearer WRONG_SECRET");
      const res = await reconcilerGET(req);
      
      expect(res.status).toBe(401);
      expect(PayoutReconciler.reconcileStalePayouts).not.toHaveBeenCalled();
    });

    it("should process reconciliation and return 200 when secret is correct", async () => {
      const req = createMockRequest("Bearer TEST_SECRET");
      const res = await reconcilerGET(req);
      
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.workerId).toContain("cron-reconciler-");
      
      expect(PayoutReconciler.reconcileStalePayouts).toHaveBeenCalledTimes(1);
      expect(PayoutReconciler.reconcileStalePayouts).toHaveBeenCalledWith(
        expect.stringContaining("cron-reconciler-")
      );
    });
  });
});
