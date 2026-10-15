import { describe, it, expect } from "vitest";
import { PayoutRequestSchema } from "@/modules/payout/domain/payout.service";
import { PaymentMode } from "@prisma/client";

describe("PayoutRequestSchema Validation", () => {
  describe("BANK (IMPS/NEFT/RTGS)", () => {
    it("should accept valid Bank request", () => {
      const data = {
        idempotencyKey: "b1",
        amount: "1000.00",
        paymentMode: PaymentMode.IMPS,
        accountNumber: "1234567890",
        ifscCode: "HDFC0001234",
        accountHolderName: "Rahul Sharma"
      };
      expect(() => PayoutRequestSchema.parse(data)).not.toThrow();
    });

    it("should reject if missing accountNumber", () => {
      const data = {
        idempotencyKey: "b2",
        amount: "1000.00",
        paymentMode: PaymentMode.IMPS,
        ifscCode: "HDFC0001234",
        accountHolderName: "Rahul Sharma"
      };
      expect(() => PayoutRequestSchema.parse(data)).toThrow("Invalid destination");
    });

    it("should reject if missing IFSC", () => {
      const data = {
        idempotencyKey: "b3",
        amount: "1000.00",
        paymentMode: PaymentMode.IMPS,
        accountNumber: "1234567890",
        accountHolderName: "Rahul Sharma"
      };
      expect(() => PayoutRequestSchema.parse(data)).toThrow("Invalid destination");
    });

    it("should reject if missing accountHolderName", () => {
      const data = {
        idempotencyKey: "b4",
        amount: "1000.00",
        paymentMode: PaymentMode.IMPS,
        accountNumber: "1234567890",
        ifscCode: "HDFC0001234"
      };
      expect(() => PayoutRequestSchema.parse(data)).toThrow("Invalid destination");
    });

    it("should fail if only VPA provided for Bank mode", () => {
      const data = {
        idempotencyKey: "b5",
        amount: "1000.00",
        paymentMode: PaymentMode.IMPS,
        vpa: "user@upi"
      };
      expect(() => PayoutRequestSchema.parse(data)).toThrow("Invalid destination");
    });
  });

  describe("UPI", () => {
    it("should accept valid UPI request (VPA only)", () => {
      const data = {
        idempotencyKey: "u1",
        amount: "1000.00",
        paymentMode: PaymentMode.UPI,
        vpa: "merchant@upi"
      };
      expect(() => PayoutRequestSchema.parse(data)).not.toThrow();
    });

    it("should reject if VPA is missing for UPI", () => {
      const data = {
        idempotencyKey: "u2",
        amount: "1000.00",
        paymentMode: PaymentMode.UPI,
        accountNumber: "1234567890",
        ifscCode: "HDFC0001234",
        accountHolderName: "Rahul Sharma"
      };
      expect(() => PayoutRequestSchema.parse(data)).toThrow("Invalid destination");
    });

    it("should reject invalid VPA format", () => {
      const data = {
        idempotencyKey: "u3",
        amount: "1000.00",
        paymentMode: PaymentMode.UPI,
        vpa: "not-a-vpa"
      };
      expect(() => PayoutRequestSchema.parse(data)).toThrow("Invalid VPA format");
    });
    
    it("should default to IMPS if paymentMode is omitted and fail if missing bank details", () => {
      const data = {
        idempotencyKey: "u4",
        amount: "1000.00"
      };
      expect(() => PayoutRequestSchema.parse(data)).toThrow("Invalid destination");
    });
  });
});
