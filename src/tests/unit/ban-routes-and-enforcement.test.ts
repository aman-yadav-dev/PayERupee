import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  BanService,
  BanValidationError,
  BanNotFoundError,
  DuplicateBanError,
  InvalidBanStateError,
  BanAuthorizationError,
} from "@/modules/ban/domain/ban.service";
import {
  requireFullMerchantAccess,
  requireAdmin,
  UnauthorizedError,
  ForbiddenError,
} from "@/modules/auth/application/session-auth.service";
import { DestinationBannedError } from "@/modules/payout/domain/payout.service";
import { PayoutController } from "@/modules/payout/controllers/payout.controller";
import { WithdrawalService } from "@/modules/wallet/application/withdrawal.service";
import { db } from "@/infrastructure/database/db";
import { Prisma, PaymentMode } from "@prisma/client";

// Import route handlers
import * as MerchantBansRoute from "@/app/api/v1/merchant/bans/route";
import * as MerchantUnbanRoute from "@/app/api/v1/merchant/bans/[id]/unban/route";
import * as MerchantBanRequestsRoute from "@/app/api/v1/merchant/bans/requests/route";
import * as AdminBanRequestsRoute from "@/app/api/v1/admin/bans/requests/route";
import * as AdminApproveBanRoute from "@/app/api/v1/admin/bans/requests/[id]/approve/route";
import * as AdminRejectBanRoute from "@/app/api/v1/admin/bans/requests/[id]/reject/route";
import * as AdminBansRoute from "@/app/api/v1/admin/bans/route";
import * as AdminRemoveBanRoute from "@/app/api/v1/admin/bans/[id]/route";

vi.mock("@/modules/auth/application/session-auth.service", () => ({
  requireFullMerchantAccess: vi.fn(),
  requireAdmin: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(msg = "Unauthorized") {
      super(msg);
      this.name = "UnauthorizedError";
    }
  },
  ForbiddenError: class ForbiddenError extends Error {
    constructor(msg = "Forbidden") {
      super(msg);
      this.name = "ForbiddenError";
    }
  },
}));

vi.mock("@/modules/auth/application/api-auth.service", () => ({
  authenticateApiKey: vi.fn().mockResolvedValue({
    merchantProfileId: "mp_123",
    environment: "TEST",
  }),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(msg = "Unauthorized") {
      super(msg);
      this.name = "UnauthorizedError";
    }
  },
}));

vi.mock("@/modules/ban/domain/ban.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/ban/domain/ban.service")>();
  return {
    ...actual,
    BanService: {
      listMerchantBans: vi.fn(),
      createMerchantBan: vi.fn(),
      unbanMerchantBan: vi.fn(),
      listMerchantGlobalBanRequests: vi.fn(),
      createGlobalBanRequest: vi.fn(),
      listGlobalBanRequests: vi.fn(),
      approveGlobalBanRequest: vi.fn(),
      rejectGlobalBanRequest: vi.fn(),
      listGlobalBans: vi.fn(),
      removeGlobalBan: vi.fn(),
      checkDestinationBan: vi.fn(),
    },
  };
});

describe("Merchant & Admin Ban Routes and Enforcement Suite", () => {
  const mockMerchant = { userId: "user_merchant_1", merchantProfileId: "mp_1" };
  const mockAdminSession = { user: { id: "user_admin_1", role: "ADMIN" } };

  beforeEach(() => {
    vi.clearAllMocks();
    (requireFullMerchantAccess as any).mockResolvedValue(mockMerchant);
    (requireAdmin as any).mockResolvedValue(mockAdminSession);
  });

  // ---------------------------------------------------------------------------
  // 1. Merchant Bans Route: GET & POST /api/v1/merchant/bans
  // ---------------------------------------------------------------------------
  describe("GET & POST /api/v1/merchant/bans", () => {
    it("GET: lists merchant bans without filter", async () => {
      (BanService.listMerchantBans as any).mockResolvedValue([{ id: "ban_1", reason: "fraud" }]);

      const req = new NextRequest("http://localhost/api/v1/merchant/bans");
      const res = await MerchantBansRoute.GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({
        success: true,
        data: [{ id: "ban_1", reason: "fraud" }],
      });
      expect(BanService.listMerchantBans).toHaveBeenCalledWith(mockMerchant, undefined);
    });

    it("GET: lists merchant bans with status filter", async () => {
      (BanService.listMerchantBans as any).mockResolvedValue([]);

      const req = new NextRequest("http://localhost/api/v1/merchant/bans?status=ACTIVE");
      const res = await MerchantBansRoute.GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(BanService.listMerchantBans).toHaveBeenCalledWith(mockMerchant, { status: "ACTIVE" });
    });

    it("GET: returns 400 on invalid status parameter", async () => {
      const req = new NextRequest("http://localhost/api/v1/merchant/bans?status=INVALID_STATUS");
      const res = await MerchantBansRoute.GET(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain("Invalid status parameter");
    });

    it("POST: creates a merchant ban and extracts audit context", async () => {
      const mockCreated = { id: "ban_new", reason: "chargeback" };
      (BanService.createMerchantBan as any).mockResolvedValue(mockCreated);

      const req = new NextRequest("http://localhost/api/v1/merchant/bans", {
        method: "POST",
        headers: {
          "x-forwarded-for": "203.0.113.195, 10.0.0.1",
          "user-agent": "CustomAgent/1.0",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          destination: { type: "UPI", vpa: "baduser@okaxis" },
          reason: "Repeated chargebacks",
        }),
      });

      const res = await MerchantBansRoute.POST(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json).toEqual({ success: true, data: mockCreated });
      expect(BanService.createMerchantBan).toHaveBeenCalledWith(
        mockMerchant,
        {
          destination: { type: "UPI", vpa: "baduser@okaxis" },
          reason: "Repeated chargebacks",
        },
        { ipAddress: "203.0.113.195", userAgent: "CustomAgent/1.0" }
      );
    });

    it("POST: maps DuplicateBanError to 409", async () => {
      (BanService.createMerchantBan as any).mockRejectedValue(
        new DuplicateBanError("Ban already exists")
      );

      const req = new NextRequest("http://localhost/api/v1/merchant/bans", {
        method: "POST",
        body: JSON.stringify({
          destination: { type: "UPI", vpa: "baduser@okaxis" },
          reason: "Repeated chargebacks",
        }),
      });

      const res = await MerchantBansRoute.POST(req);
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json).toEqual({ success: false, error: "Ban already exists" });
    });

    it("POST: returns 400 on malformed JSON body", async () => {
      const req = new NextRequest("http://localhost/api/v1/merchant/bans", {
        method: "POST",
        body: "invalid-json",
      });

      const res = await MerchantBansRoute.POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json).toEqual({ success: false, error: "Invalid JSON body" });
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Merchant Unban Route: POST /api/v1/merchant/bans/[id]/unban
  // ---------------------------------------------------------------------------
  describe("POST /api/v1/merchant/bans/[id]/unban", () => {
    it("unbans merchant ban successfully", async () => {
      const mockUpdated = { id: "ban_1", status: "UNBANNED" };
      (BanService.unbanMerchantBan as any).mockResolvedValue(mockUpdated);

      const req = new NextRequest("http://localhost/api/v1/merchant/bans/ban_1/unban", {
        method: "POST",
        headers: { "x-real-ip": "198.51.100.5" },
        body: JSON.stringify({ reason: "Mistakenly banned user" }),
      });

      const res = await MerchantUnbanRoute.POST(req, { params: Promise.resolve({ id: "ban_1" }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ success: true, data: mockUpdated });
      expect(BanService.unbanMerchantBan).toHaveBeenCalledWith(
        mockMerchant,
        "ban_1",
        "Mistakenly banned user",
        { ipAddress: "198.51.100.5", userAgent: undefined }
      );
    });

    it("maps BanNotFoundError to 404", async () => {
      (BanService.unbanMerchantBan as any).mockRejectedValue(
        new BanNotFoundError("Ban not found")
      );

      const req = new NextRequest("http://localhost/api/v1/merchant/bans/missing/unban", {
        method: "POST",
        body: JSON.stringify({ reason: "Mistaken ban" }),
      });

      const res = await MerchantUnbanRoute.POST(req, { params: Promise.resolve({ id: "missing" }) });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json).toEqual({ success: false, error: "Ban not found" });
    });

    it("maps InvalidBanStateError to 409", async () => {
      (BanService.unbanMerchantBan as any).mockRejectedValue(
        new InvalidBanStateError("Ban is already unbanned")
      );

      const req = new NextRequest("http://localhost/api/v1/merchant/bans/ban_1/unban", {
        method: "POST",
        body: JSON.stringify({ reason: "Mistaken ban" }),
      });

      const res = await MerchantUnbanRoute.POST(req, { params: Promise.resolve({ id: "ban_1" }) });
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json).toEqual({ success: false, error: "Ban is already unbanned" });
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Merchant Ban Requests: GET & POST /api/v1/merchant/bans/requests
  // ---------------------------------------------------------------------------
  describe("GET & POST /api/v1/merchant/bans/requests", () => {
    it("GET: lists merchant global ban requests", async () => {
      (BanService.listMerchantGlobalBanRequests as any).mockResolvedValue([{ id: "req_1" }]);

      const req = new NextRequest("http://localhost/api/v1/merchant/bans/requests");
      const res = await MerchantBanRequestsRoute.GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ success: true, data: [{ id: "req_1" }] });
    });

    it("POST: creates global ban request and returns 201 with { request, localBan }", async () => {
      const mockResult = {
        request: { id: "req_10", status: "PENDING" },
        localBan: { id: "ban_10", status: "ACTIVE" },
      };
      (BanService.createGlobalBanRequest as any).mockResolvedValue(mockResult);

      const req = new NextRequest("http://localhost/api/v1/merchant/bans/requests", {
        method: "POST",
        body: JSON.stringify({
          destination: { type: "BANK_ACCOUNT", accountNumber: "1234567890", ifsc: "HDFC0001234" },
          reason: "Platform fraud syndicate",
          applyImmediateLocalBan: true,
        }),
      });

      const res = await MerchantBanRequestsRoute.POST(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json).toEqual({ success: true, data: mockResult });
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Admin Ban Requests: GET /api/v1/admin/bans/requests
  // ---------------------------------------------------------------------------
  describe("GET /api/v1/admin/bans/requests", () => {
    it("lists all requests for admin", async () => {
      (BanService.listGlobalBanRequests as any).mockResolvedValue([{ id: "req_1" }]);

      const req = new NextRequest("http://localhost/api/v1/admin/bans/requests?status=PENDING");
      const res = await AdminBanRequestsRoute.GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ success: true, data: [{ id: "req_1" }] });
      expect(BanService.listGlobalBanRequests).toHaveBeenCalledWith("user_admin_1", {
        status: "PENDING",
      });
    });

    it("returns 403 if user is not admin", async () => {
      (requireAdmin as any).mockRejectedValue(new ForbiddenError("Admin access required"));

      const req = new NextRequest("http://localhost/api/v1/admin/bans/requests");
      const res = await AdminBanRequestsRoute.GET(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Admin Approve Request: POST /api/v1/admin/bans/requests/[id]/approve
  // ---------------------------------------------------------------------------
  describe("POST /api/v1/admin/bans/requests/[id]/approve", () => {
    it("approves global ban request", async () => {
      const mockGlobalBan = { id: "gban_1", status: "ACTIVE" };
      (BanService.approveGlobalBanRequest as any).mockResolvedValue(mockGlobalBan);

      const req = new NextRequest("http://localhost/api/v1/admin/bans/requests/req_1/approve", {
        method: "POST",
        body: JSON.stringify({ reviewNotes: "Evidence verified by risk operations" }),
      });

      const res = await AdminApproveBanRoute.POST(req, {
        params: Promise.resolve({ id: "req_1" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ success: true, data: mockGlobalBan });
      expect(BanService.approveGlobalBanRequest).toHaveBeenCalledWith(
        "user_admin_1",
        "req_1",
        "Evidence verified by risk operations",
        expect.anything()
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Admin Reject Request: POST /api/v1/admin/bans/requests/[id]/reject
  // ---------------------------------------------------------------------------
  describe("POST /api/v1/admin/bans/requests/[id]/reject", () => {
    it("rejects global ban request with rejectionReason", async () => {
      const mockRejected = { id: "req_1", status: "REJECTED" };
      (BanService.rejectGlobalBanRequest as any).mockResolvedValue(mockRejected);

      const req = new NextRequest("http://localhost/api/v1/admin/bans/requests/req_1/reject", {
        method: "POST",
        body: JSON.stringify({
          rejectionReason: "Insufficient proof of unauthorized transactions",
          reviewNotes: "Referred to compliance",
        }),
      });

      const res = await AdminRejectBanRoute.POST(req, {
        params: Promise.resolve({ id: "req_1" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ success: true, data: mockRejected });
      expect(BanService.rejectGlobalBanRequest).toHaveBeenCalledWith(
        "user_admin_1",
        "req_1",
        "Insufficient proof of unauthorized transactions",
        "Referred to compliance",
        expect.anything()
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Admin List Global Bans: GET /api/v1/admin/bans
  // ---------------------------------------------------------------------------
  describe("GET /api/v1/admin/bans", () => {
    it("lists global bans", async () => {
      (BanService.listGlobalBans as any).mockResolvedValue([{ id: "gban_1" }]);

      const req = new NextRequest("http://localhost/api/v1/admin/bans?status=ACTIVE");
      const res = await AdminBansRoute.GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ success: true, data: [{ id: "gban_1" }] });
    });
  });

  // ---------------------------------------------------------------------------
  // 8. Admin Remove Global Ban: DELETE & POST /api/v1/admin/bans/[id]
  // ---------------------------------------------------------------------------
  describe("DELETE & POST /api/v1/admin/bans/[id]", () => {
    it("removes global ban via DELETE", async () => {
      const mockRemoved = { id: "gban_1", status: "REMOVED" };
      (BanService.removeGlobalBan as any).mockResolvedValue(mockRemoved);

      const req = new NextRequest("http://localhost/api/v1/admin/bans/gban_1", {
        method: "DELETE",
        body: JSON.stringify({ removalReason: "Court order reversed penalty" }),
      });

      const res = await AdminRemoveBanRoute.DELETE(req, {
        params: Promise.resolve({ id: "gban_1" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ success: true, data: mockRemoved });
      expect(BanService.removeGlobalBan).toHaveBeenCalledWith(
        "user_admin_1",
        "gban_1",
        "Court order reversed penalty",
        expect.anything()
      );
    });

    it("removes global ban via POST", async () => {
      const mockRemoved = { id: "gban_1", status: "REMOVED" };
      (BanService.removeGlobalBan as any).mockResolvedValue(mockRemoved);

      const req = new NextRequest("http://localhost/api/v1/admin/bans/gban_1", {
        method: "POST",
        body: JSON.stringify({ reason: "Unbanned by operations supervisor" }),
      });

      const res = await AdminRemoveBanRoute.POST(req, {
        params: Promise.resolve({ id: "gban_1" }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({ success: true, data: mockRemoved });
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Payout Controller Destination Ban Handling (403 Format)
  // ---------------------------------------------------------------------------
  describe("PayoutController Destination Ban Handling", () => {
    it("returns 403 DESTINATION_BANNED on DestinationBannedError", async () => {
      const banError = new DestinationBannedError("Payout destination is restricted by ban policy.", {
        banScope: "GLOBAL",
        banReason: "Suspicious fraudulent activity",
        maskedDestination: "pay***@upi",
      });

      // Spy on createPayout or simulate controller catching DestinationBannedError
      const req = new NextRequest("http://localhost/api/v1/payouts", {
        method: "POST",
        headers: {
          Authorization: "Bearer sec_test_123",
          "Idempotency-Key": "idemp_test_1",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount: "100.00",
          paymentMode: "UPI",
          vpa: "paybad@upi",
        }),
      });

      // Mock createPayout to throw DestinationBannedError
      const payoutServiceModule = await import("@/modules/payout/domain/payout.service");
      vi.spyOn(payoutServiceModule, "createPayout").mockRejectedValue(banError);

      const res = await PayoutController.create(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json).toEqual({
        success: false,
        error: {
          code: "DESTINATION_BANNED",
          message: "Payout destination is restricted by ban policy.",
          scope: "GLOBAL",
          reason: "Suspicious fraudulent activity",
          maskedDestination: "pay***@upi",
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 10. WithdrawalService Destination Ban Check
  // ---------------------------------------------------------------------------
  describe("WithdrawalService Destination Ban Enforcement", () => {
    it("throws DestinationBannedError and halts before wallet debit or ledger mutation", async () => {
      (BanService.checkDestinationBan as any).mockResolvedValue({
        isBanned: true,
        banScope: "MERCHANT",
        reason: "Blocked account number",
        maskedDestination: "BANK:******1234:HDFC0001234",
      });

      // Mock db.$transaction to simulate bank lookup
      const mockTx = {
        systemSetting: {
          findUnique: vi.fn().mockResolvedValue({ minWithdrawAmount: new Prisma.Decimal(10) }),
        },
        withdrawal: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
        merchantBank: {
          findFirst: vi.fn().mockResolvedValue({
            id: "mbank_1",
            accountNumber: "987654321234",
            ifscCode: "HDFC0001234",
          }),
        },
        wallet: {
          findUnique: vi.fn(),
        },
      };

      vi.spyOn(db, "$transaction").mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await expect(
        WithdrawalService.createWithdrawal("mp_1", {
          merchantBankId: "mbank_1",
          amount: new Prisma.Decimal("50.00"),
          idempotencyKey: "with_idemp_1",
        })
      ).rejects.toThrow(DestinationBannedError);

      // Verify no withdrawal was created and wallet was not accessed
      expect(mockTx.withdrawal.create).not.toHaveBeenCalled();
      expect(mockTx.wallet.findUnique).not.toHaveBeenCalled();
    });
  });
});
