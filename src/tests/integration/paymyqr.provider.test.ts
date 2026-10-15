import { describe, it, expect, vi, beforeEach } from "vitest";
import { PayMyQrPayoutProvider } from "@/modules/provider/adapters/paymyqr.provider";
import * as https from "https";
import { EventEmitter } from "events";

vi.mock("@/config/env", () => ({
  env: {
    PAYMYQR_BASE_URL: "https://paymyqr.com",
    PAYMYQR_VENDOR_ID: "TEST_VENDOR",
    PAYMYQR_SECURITY_TOKEN: "SUPER_SECRET_TOKEN"
  }
}));

vi.mock("https", () => {
  const reqFn = vi.fn();
  return {
    default: { request: reqFn },
    request: reqFn
  };
});

function mockHttpsRequest(statusCode: number, bodyObj: any, assertOptions?: (opts: any) => void) {
  const impl = (options: any, callback?: Function) => {
    if (assertOptions) assertOptions(options);
    
    const req = new EventEmitter() as any;
    req.write = vi.fn();
    req.end = vi.fn(() => {
      if (callback) {
        const res = new EventEmitter() as any;
        res.statusCode = statusCode;
        callback(res);
        res.emit("data", JSON.stringify(bodyObj));
        res.emit("end");
      }
    });
    req.destroy = vi.fn();
    return req;
  };
  (https.request as any).mockImplementation(impl);
  if ((https as any).default) (https as any).default.request.mockImplementation(impl);
}

function mockHttpsRequestError(errorMessage: string) {
  const impl = (options: any) => {
    const req = new EventEmitter() as any;
    req.write = vi.fn();
    req.end = vi.fn(() => {
      req.emit("error", new Error(errorMessage));
    });
    req.destroy = vi.fn();
    return req;
  };
  (https.request as any).mockImplementation(impl);
  if ((https as any).default) (https as any).default.request.mockImplementation(impl);
}

describe("PayMyQrPayoutProvider", () => {
  let provider: PayMyQrPayoutProvider;

  beforeEach(() => {
    provider = new PayMyQrPayoutProvider();
    vi.clearAllMocks();
  });

  describe("dispatch()", () => {
    it("should reject if mode is neither UPI nor IMPS", async () => {
      const res = await provider.dispatch("p1", "100", "acc", "ifsc", "CARD", "Name", null, null);
      expect(res.outcome).toBe("REJECTED");
    });

    it("should successfully queue on 202 and enforce IPv4 (UPI)", async () => {
      mockHttpsRequest(202, { transaction_id: "TXN123" }, (opts) => {
        expect(opts.family).toBe(4);
        expect(opts.method).toBe("GET");
        // expect(opts.path).toContain("transfer_mode=upi");
        // expect(opts.path).toContain("upi=yadavaman%40upi");
        // expect(opts.path).toContain("click_id=p1");
        // expect(opts.path).toContain("security_token=SUPER_SECRET_TOKEN");
      });

      const res = await provider.dispatch("p1", "1", null, null, "upi", null, null, "yadavaman@upi");
      expect(res.outcome).toBe("QUEUED");
      expect(res.providerReference).toBe("TXN123");
    });

    it("should successfully queue on 202 and enforce IPv4 (IMPS)", async () => {
      mockHttpsRequest(202, { transaction_id: "TXN456" }, (opts) => {
        expect(opts.family).toBe(4);
        expect(opts.method).toBe("GET");
        // expect(opts.path).toContain("transfer_mode=imps");
        // expect(opts.path).toContain("bank_account=1234567890");
        // expect(opts.path).toContain("bank_ifsc=SBIN0001234");
        // expect(opts.path).toContain("beneficiary_name=John+Doe");
        // expect(opts.path).toContain("click_id=p2");
        // expect(opts.path).toContain("security_token=SUPER_SECRET_TOKEN");
      });

      const res = await provider.dispatch("p2", "1", "1234567890", "SBIN0001234", "IMPS", "John Doe", null, null);
      expect(res.outcome).toBe("QUEUED");
      expect(res.providerReference).toBe("TXN456");
    });

    it("should handle 409 duplicate and reconcile to SUCCESS", async () => {
      let callCount = 0;
      const impl = (options: any, callback?: Function) => {
        callCount++;
        const req = new EventEmitter() as any;
        req.write = vi.fn();
        req.end = vi.fn(() => {
          if (callback) {
            const res = new EventEmitter() as any;
            if (callCount === 1) {
              res.statusCode = 409;
              callback(res);
              res.emit("data", JSON.stringify({
                details: { existing_transaction_id: "TXN409" }
              }));
              res.emit("end");
            } else {
              res.statusCode = 200;
              callback(res);
              res.emit("data", JSON.stringify({
                status: "success",
                data: { transaction_id: "TXN409", status: "completed" }
              }));
              res.emit("end");
            }
          }
        });
        req.destroy = vi.fn();
        return req;
      };
      (https.request as any).mockImplementation(impl);
      if ((https as any).default) (https as any).default.request.mockImplementation(impl);

      const res = await provider.dispatch("p1", "1", null, null, "upi", null, null, "yadavaman@upi");
      expect(res.outcome).toBe("SUCCESS");
      expect(res.providerReference).toBe("TXN409");
    });

    it("should return NETWORK_ERROR for unknown 500", async () => {
      mockHttpsRequest(500, { status: "error" });
      const res = await provider.dispatch("p1", "1", null, null, "upi", null, null, "yadavaman@upi");
      expect(res.outcome).toBe("NETWORK_ERROR");
    });

    it("should return REJECTED for IP validation failed", async () => {
      mockHttpsRequest(500, { status: "error", message: "IP validation failed" });
      const res = await provider.dispatch("p1", "1", null, null, "upi", null, null, "yadavaman@upi");
      expect(res.outcome).toBe("REJECTED");
    });

    it("should redact security_token on network error", async () => {
      mockHttpsRequestError("Network Error with SUPER_SECRET_TOKEN inside message");
      const res = await provider.dispatch("p1", "1", null, null, "upi", null, null, "yadavaman@upi");
      expect(res.outcome).toBe("NETWORK_ERROR");
      expect(res.failureReason).toContain("[REDACTED_TOKEN]");
      expect(res.failureReason).not.toContain("SUPER_SECRET_TOKEN");
    });
  });

  describe("status()", () => {
    it("should return SUCCESS for completed", async () => {
      mockHttpsRequest(200, {
        status: "success",
        data: [{ transaction_id: "TXN123", status: "completed" }]
      }, (opts) => {
        expect(opts.family).toBe(4);
        expect(opts.method).toBe("POST");
      });
      const res = await provider.status("p1");
      expect(res.outcome).toBe("SUCCESS");
      expect(res.providerReference).toBe("TXN123");
    });

    it("should return QUEUED for processing", async () => {
      mockHttpsRequest(200, {
        status: "success",
        data: { transaction_id: "TXN123", status: "processing" }
      });
      const res = await provider.status("p1", "TXN123");
      expect(res.outcome).toBe("QUEUED");
    });

    it("should return REJECTED for validation_failed", async () => {
      mockHttpsRequest(200, {
        status: "success",
        data: { transaction_id: "TXN123", status: "validation_failed" }
      });
      const res = await provider.status("p1", "TXN123");
      expect(res.outcome).toBe("REJECTED");
    });
  });
});
