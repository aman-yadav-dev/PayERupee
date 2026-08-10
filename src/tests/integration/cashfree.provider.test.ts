import { describe, it, expect, vi, beforeEach } from "vitest";
import { CashfreePayoutProvider } from "@/modules/provider/adapters/cashfree.provider";
import { env } from "@/config/env";
import crypto from "crypto";

// Mock global fetch
global.fetch = vi.fn();

describe("CashfreePayoutProvider", () => {
  let provider: CashfreePayoutProvider;

  beforeEach(() => {
    vi.resetAllMocks();
    provider = new CashfreePayoutProvider();
    env.CASHFREE_CLIENT_ID = "test_client_id";
    env.CASHFREE_CLIENT_SECRET = "test_client_secret";
    env.CASHFREE_ENVIRONMENT = "TEST";
  });

  describe("dispatch", () => {
    it("should successfully dispatch payout and return ACCEPTED", async () => {
      // Mock Add Beneficiary (Success)
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ subCode: "200", message: "Beneficiary added successfully" }),
      });

      // Mock Transfer (Success)
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ reference_id: 123456789, status: "RECEIVED" }),
      });

      const result = await provider.dispatch(
        "pout_123",
        "100.00",
        "1234567890",
        "SBIN0000001",
        "IMPS",
        "John Doe",
        "9999999999"
      );

      expect(result.outcome).toBe("ACCEPTED");
      expect(result.providerReference).toBe("123456789");
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should proceed if Beneficiary already exists", async () => {
      // Mock Add Beneficiary (Already Exists)
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ code: "BENEFICIARY_ALREADY_EXISTS", message: "Beneficiary already exists" }),
      });

      // Mock Transfer (Success)
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ reference_id: 98765, status: "RECEIVED" }),
      });

      const result = await provider.dispatch(
        "pout_123",
        "100.00",
        "1234567890",
        "SBIN0000001",
        "IMPS",
        "John Doe"
      );

      expect(result.outcome).toBe("ACCEPTED");
      expect(result.providerReference).toBe("98765");
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should reject if Transfer API fails", async () => {
      // Mock Add Beneficiary (Success)
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ subCode: "200" }),
      });

      // Mock Transfer (Fails due to insufficient balance)
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: "Insufficient balance" }),
      });

      const result = await provider.dispatch(
        "pout_123",
        "100.00",
        "1234567890",
        "SBIN0000001",
        "IMPS",
        "John Doe"
      );

      expect(result.outcome).toBe("REJECTED");
      expect(result.failureReason).toBe("Insufficient balance");
    });
  });

  describe("webhook handling", () => {
    it("should normalize TRANSFER_SUCCESS event", () => {
      const rawBody = JSON.stringify({
        type: "TRANSFER_SUCCESS",
        data: {
          transfer: {
            reference_id: "cashfree_ref_123",
            transfer_id: "pout_123",
            status: "SUCCESS"
          }
        }
      });

      const normalized = provider.parseWebhook(rawBody);
      expect(normalized.status).toBe("SUCCESS");
      expect(normalized.providerReference).toBe("cashfree_ref_123");
    });

    it("should generate and verify valid webhook signature", () => {
      const secret = "my_secret_key";
      env.CASHFREE_WEBHOOK_SECRET = secret;
      const timestamp = "1629800000";
      const rawBody = JSON.stringify({ type: "TRANSFER_SUCCESS" });
      const signatureData = timestamp + rawBody;
      const computedSignature = crypto
        .createHmac("sha256", secret)
        .update(signatureData)
        .digest("base64");

      const headers = {
        "x-webhook-signature": computedSignature,
        "x-webhook-timestamp": timestamp
      };

      const isValid = provider.verifyWebhookSignature(rawBody, headers);
      expect(isValid).toBe(true);
    });

    it("should reject invalid webhook signature", () => {
      const secret = "my_secret_key";
      env.CASHFREE_WEBHOOK_SECRET = secret;
      const timestamp = "1629800000";
      const rawBody = JSON.stringify({ type: "TRANSFER_SUCCESS" });
      
      const headers = {
        "x-webhook-signature": "invalid_signature_here",
        "x-webhook-timestamp": timestamp
      };

      const isValid = provider.verifyWebhookSignature(rawBody, headers);
      expect(isValid).toBe(false);
    });
  });
});
