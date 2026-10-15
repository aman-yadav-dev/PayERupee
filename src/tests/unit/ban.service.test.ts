import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  BanService,
  DuplicateBanError,
  BanNotFoundError,
  InvalidBanStateError,
  BanAuthorizationError,
  BanValidationError,
} from "@/modules/ban/domain/ban.service";
import {
  BanStatus,
  BanRequestStatus,
  GlobalBanStatus,
  MerchantBan,
  GlobalBanRequest,
  GlobalBan,
  UserRole,
  Prisma,
} from "@prisma/client";
import { AuthenticatedMerchantContext } from "@/modules/auth/application/session-auth.service";
import { BanCryptoConfigurationError } from "@/modules/ban/application/ban-crypto.service";

// Mock the audit logging module
vi.mock("@/modules/audit/domain/audit.service", () => ({
  logAction: vi.fn().mockResolvedValue({ id: "mock_audit_id" }),
}));

// In-memory mock database state
const mockDb = {
  users: [] as { id: string; role: UserRole }[],
  merchantBans: [] as MerchantBan[],
  globalBanRequests: [] as GlobalBanRequest[],
  globalBans: [] as GlobalBan[],
  auditLogs: [] as Record<string, unknown>[],
};

// Mock prisma client and transaction client
vi.mock("@/infrastructure/database/db", () => {
  const createTxMock = () => ({
    $executeRaw: vi.fn().mockResolvedValue(1),
    user: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(mockDb.users.find((u) => u.id === where.id) || null);
      }),
    },
    merchantBan: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          mockDb.merchantBans.find((b) => {
            if (where.merchantProfileId && b.merchantProfileId !== where.merchantProfileId) return false;
            if (where.destinationType && b.destinationType !== where.destinationType) return false;
            if (where.identifierHash) {
              if (where.identifierHash.in) {
                if (!where.identifierHash.in.includes(b.identifierHash)) return false;
              } else if (b.identifierHash !== where.identifierHash) {
                return false;
              }
            }
            if (where.status && b.status !== where.status) return false;
            return true;
          }) || null
        );
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(mockDb.merchantBans.find((b) => b.id === where.id) || null);
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        const item = {
          id: `mban_${Date.now()}_${Math.random()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDb.merchantBans.push(item);
        return Promise.resolve(item);
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const idx = mockDb.merchantBans.findIndex(
          (b) => b.id === where.id && (!where.status || b.status === where.status)
        );
        if (idx === -1) {
          const err = new Error("Record not found");
          (err as { code?: string }).code = "P2025";
          throw err;
        }
        mockDb.merchantBans[idx] = { ...mockDb.merchantBans[idx], ...data, updatedAt: new Date() };
        return Promise.resolve(mockDb.merchantBans[idx]);
      }),
      findMany: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          mockDb.merchantBans.filter((b) => {
            if (where.merchantProfileId && b.merchantProfileId !== where.merchantProfileId) return false;
            if (where.status && b.status !== where.status) return false;
            return true;
          })
        );
      }),
    },
    globalBanRequest: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          mockDb.globalBanRequests.find((r) => {
            if (where.merchantProfileId && r.merchantProfileId !== where.merchantProfileId) return false;
            if (where.destinationType && r.destinationType !== where.destinationType) return false;
            if (where.identifierHash) {
              if (where.identifierHash.in) {
                if (!where.identifierHash.in.includes(r.identifierHash)) return false;
              } else if (r.identifierHash !== where.identifierHash) {
                return false;
              }
            }
            if (where.status && r.status !== where.status) return false;
            return true;
          }) || null
        );
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(mockDb.globalBanRequests.find((r) => r.id === where.id) || null);
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        const item = {
          id: `greq_${Date.now()}_${Math.random()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDb.globalBanRequests.push(item);
        return Promise.resolve(item);
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const idx = mockDb.globalBanRequests.findIndex(
          (r) => r.id === where.id && (!where.status || r.status === where.status)
        );
        if (idx === -1) {
          const err = new Error("Record not found");
          (err as { code?: string }).code = "P2025";
          throw err;
        }
        mockDb.globalBanRequests[idx] = { ...mockDb.globalBanRequests[idx], ...data, updatedAt: new Date() };
        return Promise.resolve(mockDb.globalBanRequests[idx]);
      }),
      findMany: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          mockDb.globalBanRequests.filter((r) => {
            if (where?.merchantProfileId && r.merchantProfileId !== where.merchantProfileId) return false;
            if (where?.destinationType && r.destinationType !== where.destinationType) return false;
            if (where?.identifierHash) {
              if (where.identifierHash.in) {
                if (!where.identifierHash.in.includes(r.identifierHash)) return false;
              } else if (r.identifierHash !== where.identifierHash) {
                return false;
              }
            }
            if (where?.status && r.status !== where.status) return false;
            return true;
          })
        );
      }),
    },
    globalBan: {
      findFirst: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          mockDb.globalBans.find((gb) => {
            if (where.destinationType && gb.destinationType !== where.destinationType) return false;
            if (where.identifierHash) {
              if (where.identifierHash.in) {
                if (!where.identifierHash.in.includes(gb.identifierHash)) return false;
              } else if (gb.identifierHash !== where.identifierHash) {
                return false;
              }
            }
            if (where.status && gb.status !== where.status) return false;
            return true;
          }) || null
        );
      }),
      findUnique: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(mockDb.globalBans.find((gb) => gb.id === where.id) || null);
      }),
      create: vi.fn().mockImplementation(({ data }) => {
        const item = {
          id: `gban_${Date.now()}_${Math.random()}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDb.globalBans.push(item);
        return Promise.resolve(item);
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        const idx = mockDb.globalBans.findIndex(
          (gb) => gb.id === where.id && (!where.status || gb.status === where.status)
        );
        if (idx === -1) {
          const err = new Error("Record not found");
          (err as { code?: string }).code = "P2025";
          throw err;
        }
        mockDb.globalBans[idx] = { ...mockDb.globalBans[idx], ...data, updatedAt: new Date() };
        return Promise.resolve(mockDb.globalBans[idx]);
      }),
      findMany: vi.fn().mockImplementation(({ where }) => {
        return Promise.resolve(
          mockDb.globalBans.filter((gb) => {
            if (where?.status && gb.status !== where.status) return false;
            return true;
          })
        );
      }),
    },
  });

  const txMock = createTxMock();

  return {
    pool: {
      end: vi.fn().mockResolvedValue(undefined),
    },
    db: {
      $disconnect: vi.fn().mockResolvedValue(undefined),
      ...txMock,
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(txMock);
      }),
    },
  };
});

describe("BanService Unit Tests", () => {
  const merchant1: AuthenticatedMerchantContext = {
    userId: "user_merchant_1",
    merchantProfileId: "mp_100",
  };

  const merchant2: AuthenticatedMerchantContext = {
    userId: "user_merchant_2",
    merchantProfileId: "mp_200",
  };

  const adminUserId = "user_admin_999";

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.users = [
      { id: adminUserId, role: UserRole.ADMIN },
      { id: merchant1.userId, role: UserRole.MERCHANT },
      { id: merchant2.userId, role: UserRole.MERCHANT },
    ];
    mockDb.merchantBans = [];
    mockDb.globalBanRequests = [];
    mockDb.globalBans = [];
    mockDb.auditLogs = [];

    process.env.BAN_HASH_SECRET =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env.BAN_ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  // =========================================================================
  // 1. MERCHANT-LOCAL BAN CREATION
  // =========================================================================
  describe("Merchant-Local Ban Creation", () => {
    it("creates a merchant-local ban with masked destination and encrypted fields", async () => {
      const result = await BanService.createMerchantBan(merchant1, {
        destination: { type: "UPI", vpa: "Fraudster.123@OkAxis" },
        reason: "Suspected phishing attack",
      });

      expect(result.id).toBeDefined();
      expect(result.merchantProfileId).toBe("mp_100");
      expect(result.destinationType).toBe("UPI");
      expect(result.maskedDestination).toBe("f***@okaxis");
      expect(result.status).toBe(BanStatus.ACTIVE);
      expect(result.reason).toBe("Suspected phishing attack");

      // Verify DB storage
      const stored = mockDb.merchantBans[0];
      expect(stored.identifierHash).toMatch(/^[0-9a-f]{64}$/);
      expect(stored.encryptedDestination).toBeDefined();
      expect(stored.hashKeyVersion).toBe(1);
      expect(stored.encryptionKeyVersion).toBe(1);
    });

    it("rejects duplicate active ban for the same merchant", async () => {
      await BanService.createMerchantBan(merchant1, {
        destination: { type: "UPI", vpa: "test@upi" },
        reason: "First ban",
      });

      await expect(
        BanService.createMerchantBan(merchant1, {
          destination: { type: "UPI", vpa: "TEST@UPI" }, // case-insensitive duplicate
          reason: "Second ban attempt",
        })
      ).rejects.toThrow(DuplicateBanError);
    });

    it("permits different merchants to independently ban the same destination", async () => {
      const ban1 = await BanService.createMerchantBan(merchant1, {
        destination: { type: "UPI", vpa: "shared_fraudster@upi" },
        reason: "Merchant 1 fraud",
      });

      const ban2 = await BanService.createMerchantBan(merchant2, {
        destination: { type: "UPI", vpa: "shared_fraudster@upi" },
        reason: "Merchant 2 fraud",
      });

      expect(ban1.merchantProfileId).toBe("mp_100");
      expect(ban2.merchantProfileId).toBe("mp_200");
      expect(mockDb.merchantBans).toHaveLength(2);
    });

    it("creates merchant-local ban with uppercase bank account normalization and prevents casing bypass", async () => {
      const ban = await BanService.createMerchantBan(merchant1, {
        destination: { type: "BANK_ACCOUNT", accountNumber: " acc12345678 ", ifsc: " hdfc0001234 " },
        reason: "Bank fraud report",
      });

      expect(ban.maskedDestination).toBe("******5678 (HDFC0001234)");

      // Attempt duplicate ban with different casing
      await expect(
        BanService.createMerchantBan(merchant1, {
          destination: { type: "BANK_ACCOUNT", accountNumber: "ACC12345678", ifsc: "HDFC0001234" },
          reason: "Duplicate uppercase bank attempt",
        })
      ).rejects.toThrow(DuplicateBanError);
    });

    it("maps Prisma P2002 unique constraint error to DuplicateBanError", async () => {
      const { db } = await import("@/infrastructure/database/db");
      const p2002Error = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "5.0.0",
      });

      vi.spyOn(db.merchantBan, "create").mockRejectedValueOnce(p2002Error);

      await expect(
        BanService.createMerchantBan(merchant1, {
          destination: { type: "UPI", vpa: "p2002_collision@upi" },
          reason: "Race condition test",
        })
      ).rejects.toThrow(DuplicateBanError);
    });

    it("rejects invalid input reason (< 3 chars or empty)", async () => {
      await expect(
        BanService.createMerchantBan(merchant1, {
          destination: { type: "UPI", vpa: "test@upi" },
          reason: "",
        })
      ).rejects.toThrow(BanValidationError);

      await expect(
        BanService.createMerchantBan(merchant1, {
          destination: { type: "UPI", vpa: "test@upi" },
          reason: "  ",
        })
      ).rejects.toThrow(BanValidationError);
    });
  });

  // =========================================================================
  // 2. MERCHANT-LOCAL BAN LISTING & OWNERSHIP ISOLATION
  // =========================================================================
  describe("Merchant-Local Ban Listing & Isolation", () => {
    it("lists bans scoped strictly to the authenticated merchant", async () => {
      await BanService.createMerchantBan(merchant1, {
        destination: { type: "UPI", vpa: "m1_victim@upi" },
        reason: "Fraud on store 1",
      });

      await BanService.createMerchantBan(merchant2, {
        destination: { type: "UPI", vpa: "m2_victim@upi" },
        reason: "Fraud on store 2",
      });

      const list1 = await BanService.listMerchantBans(merchant1);
      const list2 = await BanService.listMerchantBans(merchant2);

      expect(list1).toHaveLength(1);
      expect(list1[0].merchantProfileId).toBe("mp_100");

      expect(list2).toHaveLength(1);
      expect(list2[0].merchantProfileId).toBe("mp_200");
    });

    it("enforces merchant context requirement on listing", async () => {
      await expect(
        BanService.listMerchantBans({ userId: "u", merchantProfileId: "" })
      ).rejects.toThrow(BanAuthorizationError);
    });

    it("lists merchant global ban requests scoped strictly to authenticated merchant", async () => {
      await BanService.createGlobalBanRequest(merchant1, {
        destination: { type: "UPI", vpa: "m1_global_req@upi" },
        reason: "Request from store 1",
        applyImmediateLocalBan: false,
      });

      await BanService.createGlobalBanRequest(merchant2, {
        destination: { type: "UPI", vpa: "m2_global_req@upi" },
        reason: "Request from store 2",
        applyImmediateLocalBan: false,
      });

      const listM1 = await BanService.listMerchantGlobalBanRequests(merchant1);
      const listM2 = await BanService.listMerchantGlobalBanRequests(merchant2);

      expect(listM1).toHaveLength(1);
      expect(listM1[0].merchantProfileId).toBe("mp_100");
      expect(listM1[0].maskedDestination).toBe("m***@upi");

      expect(listM2).toHaveLength(1);
      expect(listM2[0].merchantProfileId).toBe("mp_200");

      await expect(
        BanService.listMerchantGlobalBanRequests({ userId: "u", merchantProfileId: "" })
      ).rejects.toThrow(BanAuthorizationError);
    });
  });

  // =========================================================================
  // 3. MERCHANT-LOCAL UNBAN
  // =========================================================================
  describe("Merchant-Local Unban", () => {
    it("unbans an active local ban with mandatory unban reason", async () => {
      const created = await BanService.createMerchantBan(merchant1, {
        destination: { type: "UPI", vpa: "unban_target@upi" },
        reason: "Initial ban",
      });

      const unbanned = await BanService.unbanMerchantBan(
        merchant1,
        created.id,
        "Customer verified identity via KYC documentation"
      );

      expect(unbanned.status).toBe(BanStatus.UNBANNED);
      expect(unbanned.unbanReason).toBe(
        "Customer verified identity via KYC documentation"
      );
    });

    it("enforces strict ownership isolation: merchant cannot unban another merchant's ban", async () => {
      const created = await BanService.createMerchantBan(merchant1, {
        destination: { type: "UPI", vpa: "victim@upi" },
        reason: "Merchant 1 ban",
      });

      // Merchant 2 attempts to unban Merchant 1's ban
      await expect(
        BanService.unbanMerchantBan(merchant2, created.id, "Malicious unban attempt")
      ).rejects.toThrow(BanNotFoundError);
    });

    it("rejects unbanning when reason is missing or empty", async () => {
      const created = await BanService.createMerchantBan(merchant1, {
        destination: { type: "UPI", vpa: "victim2@upi" },
        reason: "Initial ban",
      });

      await expect(
        BanService.unbanMerchantBan(merchant1, created.id, "")
      ).rejects.toThrow(BanValidationError);

      await expect(
        BanService.unbanMerchantBan(merchant1, created.id, "   ")
      ).rejects.toThrow(BanValidationError);
    });

    it("rejects unbanning an already unbanned record", async () => {
      const created = await BanService.createMerchantBan(merchant1, {
        destination: { type: "UPI", vpa: "already_unbanned@upi" },
        reason: "Initial ban",
      });

      await BanService.unbanMerchantBan(merchant1, created.id, "First unban");

      await expect(
        BanService.unbanMerchantBan(merchant1, created.id, "Second unban attempt")
      ).rejects.toThrow(InvalidBanStateError);
    });
  });

  // =========================================================================
  // 4. GLOBAL BAN REQUESTS & IMMEDIATE LOCAL BAN OPTION
  // =========================================================================
  describe("Global Ban Request Creation", () => {
    it("creates a global ban request and applies immediate local ban by default", async () => {
      const result = await BanService.createGlobalBanRequest(merchant1, {
        destination: {
          type: "BANK_ACCOUNT",
          accountNumber: "123456789012",
          ifsc: "HDFC0001234",
        },
        reason: "Syndicate mule bank account",
      });

      expect(result.request.status).toBe(BanRequestStatus.PENDING);
      expect(result.request.maskedDestination).toBe("******9012 (HDFC0001234)");

      // Immediate local ban was applied
      expect(result.localBan).toBeDefined();
      expect(result.localBan?.status).toBe(BanStatus.ACTIVE);
      expect(mockDb.merchantBans).toHaveLength(1);
    });

    it("supports opting out of immediate local ban", async () => {
      const result = await BanService.createGlobalBanRequest(merchant1, {
        destination: {
          type: "BANK_ACCOUNT",
          accountNumber: "987654321098",
          ifsc: "SBIN0001234",
        },
        reason: "Platform fraud only",
        applyImmediateLocalBan: false, // Opt-out
      });

      expect(result.request.status).toBe(BanRequestStatus.PENDING);
      expect(result.localBan).toBeUndefined();
      expect(mockDb.merchantBans).toHaveLength(0);
    });

    it("rejects duplicate pending global ban request from same merchant", async () => {
      await BanService.createGlobalBanRequest(merchant1, {
        destination: { type: "UPI", vpa: "pending_dup@upi" },
        reason: "First request",
      });

      await expect(
        BanService.createGlobalBanRequest(merchant1, {
          destination: { type: "UPI", vpa: "pending_dup@upi" },
          reason: "Second request",
        })
      ).rejects.toThrow(DuplicateBanError);
    });

    it("rejects request if destination is already actively banned globally", async () => {
      // Simulate existing active global ban
      mockDb.globalBans.push({
        id: "gban_existing",
        destinationType: "UPI",
        identifierHash:
          "927f9cb3ef39c3e981da759546059c3f0b2f704179377484dfc949e29a99f1fa", // mock hash
        encryptedDestination: "enc_mock_dest",
        maskedDestination: "b***@upi",
        reason: "Platform fraud",
        status: GlobalBanStatus.ACTIVE,
        hashKeyVersion: 1,
        encryptionKeyVersion: 1,
        sourceRequestId: null,
        approvedById: adminUserId,
        removedById: null,
        removalReason: null,
        removedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Stub findFirst to return the active global ban
      const { db } = await import("@/infrastructure/database/db");
      vi.spyOn(db.globalBan, "findFirst").mockResolvedValueOnce(
        mockDb.globalBans[0]!
      );

      await expect(
        BanService.createGlobalBanRequest(merchant1, {
          destination: { type: "UPI", vpa: "banned@upi" },
          reason: "Request for already banned user",
        })
      ).rejects.toThrow(DuplicateBanError);
    });

    it("returns existing sanitized local ban if active local ban already exists when creating global ban request", async () => {
      const localBan = await BanService.createMerchantBan(merchant1, {
        destination: { type: "UPI", vpa: "preexisting@upi" },
        reason: "Pre-existing ban",
      });

      const result = await BanService.createGlobalBanRequest(merchant1, {
        destination: { type: "UPI", vpa: "preexisting@upi" },
        reason: "Escalating to global",
        applyImmediateLocalBan: true,
      });

      expect(result.localBan).toBeDefined();
      expect(result.localBan?.id).toBe(localBan.id);
      expect(result.localBan?.status).toBe(BanStatus.ACTIVE);
    });
  });

  // =========================================================================
  // 5. GLOBAL BAN APPROVAL & REJECTION (ADMIN AUTHORIZATION)
  // =========================================================================
  describe("Admin Review: Approval & Rejection", () => {
    it("approves a pending request and creates active GlobalBan row", async () => {
      const { request } = await BanService.createGlobalBanRequest(merchant1, {
        destination: { type: "UPI", vpa: "mule@upi" },
        reason: "Confirmed syndicate account",
        applyImmediateLocalBan: false,
      });

      const approved = await BanService.approveGlobalBanRequest(
        adminUserId,
        request.id,
        "Evidence verified with cybercrime cell"
      );

      expect(approved.status).toBe(GlobalBanStatus.ACTIVE);
      expect(approved.sourceRequestId).toBe(request.id);
      expect(approved.maskedDestination).toBe("m***@upi");

      // Verify request status transitioned to APPROVED
      const updatedReq = mockDb.globalBanRequests.find((r) => r.id === request.id);
      expect(updatedReq).toBeDefined();
      expect(updatedReq!.status).toBe(BanRequestStatus.APPROVED);
      expect(updatedReq!.reviewedById).toBe(adminUserId);
    });

    it("includes review notes in audit log metadata when approving and rejecting", async () => {
      const { request } = await BanService.createGlobalBanRequest(merchant1, {
        destination: { type: "UPI", vpa: "audit_notes@upi" },
        reason: "Audit test",
        applyImmediateLocalBan: false,
      });

      await BanService.approveGlobalBanRequest(adminUserId, request.id, "Verified by security");
      const { logAction } = await import("@/modules/audit/domain/audit.service");
      expect(logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "APPROVE",
          metadata: expect.objectContaining({
            reviewNotes: "Verified by security",
          }),
        }),
        expect.anything()
      );
    });

    it("auto-resolves other pending requests across merchants for the same destination upon approval", async () => {
      const req1 = await BanService.createGlobalBanRequest(merchant1, {
        destination: { type: "UPI", vpa: "cross_merchant@upi" },
        reason: "Merchant 1 report",
        applyImmediateLocalBan: false,
      });
      const req2 = await BanService.createGlobalBanRequest(merchant2, {
        destination: { type: "UPI", vpa: "cross_merchant@upi" },
        reason: "Merchant 2 report",
        applyImmediateLocalBan: false,
      });

      expect(mockDb.globalBanRequests.find((r) => r.id === req2.request.id)?.status).toBe(
        BanRequestStatus.PENDING
      );

      await BanService.approveGlobalBanRequest(adminUserId, req1.request.id, "Admin verified");

      const updatedReq2 = mockDb.globalBanRequests.find((r) => r.id === req2.request.id);
      expect(updatedReq2?.status).toBe(BanRequestStatus.APPROVED);
      expect(updatedReq2?.reviewedById).toBe(adminUserId);
      expect(updatedReq2?.reviewNotes).toContain("Auto-resolved");
    });

    it("rejects an already approved or rejected request", async () => {
      const { request } = await BanService.createGlobalBanRequest(merchant1, {
        destination: { type: "UPI", vpa: "test_review@upi" },
        reason: "Test reason",
        applyImmediateLocalBan: false,
      });

      await BanService.approveGlobalBanRequest(adminUserId, request.id);

      // Attempt second approval
      await expect(
        BanService.approveGlobalBanRequest(adminUserId, request.id)
      ).rejects.toThrow(InvalidBanStateError);

      // Attempt rejection after approval
      await expect(
        BanService.rejectGlobalBanRequest(
          adminUserId,
          request.id,
          "Late rejection"
        )
      ).rejects.toThrow(InvalidBanStateError);
    });

    it("rejects a pending request with mandatory rejection reason", async () => {
      const { request } = await BanService.createGlobalBanRequest(merchant1, {
        destination: { type: "UPI", vpa: "innocent@upi" },
        reason: "Merchant dispute",
        applyImmediateLocalBan: false,
      });

      const rejected = await BanService.rejectGlobalBanRequest(
        adminUserId,
        request.id,
        "Dispute is commercial; insufficient evidence for platform ban"
      );

      expect(rejected.status).toBe(BanRequestStatus.REJECTED);
      expect(rejected.rejectionReason).toBe(
        "Dispute is commercial; insufficient evidence for platform ban"
      );
    });

    it("enforces admin authorization requirement", async () => {
      const { request } = await BanService.createGlobalBanRequest(merchant1, {
        destination: { type: "UPI", vpa: "auth_test@upi" },
        reason: "Auth test",
      });

      // Empty admin ID
      await expect(
        BanService.approveGlobalBanRequest("", request.id)
      ).rejects.toThrow(BanAuthorizationError);

      await expect(
        BanService.rejectGlobalBanRequest("", request.id, "Reason")
      ).rejects.toThrow(BanAuthorizationError);

      // Non-admin user (MERCHANT role)
      await expect(
        BanService.approveGlobalBanRequest(merchant1.userId, request.id)
      ).rejects.toThrow(BanAuthorizationError);

      await expect(
        BanService.rejectGlobalBanRequest(merchant1.userId, request.id, "Reason")
      ).rejects.toThrow(BanAuthorizationError);
    });
  });

  // =========================================================================
  // 6. GLOBAL BAN REMOVAL (ADMIN ONLY)
  // =========================================================================
  describe("Admin Global Ban Removal", () => {
    it("removes an active global ban with mandatory removal reason", async () => {
      const { request } = await BanService.createGlobalBanRequest(merchant1, {
        destination: { type: "UPI", vpa: "remove_target@upi" },
        reason: "Suspicious activity",
        applyImmediateLocalBan: false,
      });

      const globalBan = await BanService.approveGlobalBanRequest(
        adminUserId,
        request.id
      );

      const removed = await BanService.removeGlobalBan(
        adminUserId,
        globalBan.id,
        "Legal court clearance provided"
      );

      expect(removed.status).toBe(GlobalBanStatus.REMOVED);
      expect(removed.removalReason).toBe("Legal court clearance provided");
    });

    it("rejects global ban removal without valid reason", async () => {
      const { request } = await BanService.createGlobalBanRequest(merchant1, {
        destination: { type: "UPI", vpa: "remove_target2@upi" },
        reason: "Fraud",
        applyImmediateLocalBan: false,
      });

      const globalBan = await BanService.approveGlobalBanRequest(
        adminUserId,
        request.id
      );

      await expect(
        BanService.removeGlobalBan(adminUserId, globalBan.id, "")
      ).rejects.toThrow(BanValidationError);

      await expect(
        BanService.removeGlobalBan(adminUserId, globalBan.id, "  ")
      ).rejects.toThrow(BanValidationError);
    });

    it("rejects removing an already removed global ban", async () => {
      const { request } = await BanService.createGlobalBanRequest(merchant1, {
        destination: { type: "UPI", vpa: "remove_target3@upi" },
        reason: "Fraud",
        applyImmediateLocalBan: false,
      });

      const globalBan = await BanService.approveGlobalBanRequest(
        adminUserId,
        request.id
      );

      await BanService.removeGlobalBan(adminUserId, globalBan.id, "First removal");

      await expect(
        BanService.removeGlobalBan(adminUserId, globalBan.id, "Second removal")
      ).rejects.toThrow(InvalidBanStateError);
    });

    it("enforces admin authorization on removal and listing", async () => {
      const { request } = await BanService.createGlobalBanRequest(merchant1, {
        destination: { type: "UPI", vpa: "remove_auth_test@upi" },
        reason: "Auth test",
        applyImmediateLocalBan: false,
      });

      const globalBan = await BanService.approveGlobalBanRequest(
        adminUserId,
        request.id
      );

      await expect(
        BanService.removeGlobalBan(merchant1.userId, globalBan.id, "Unauthorized reason")
      ).rejects.toThrow(BanAuthorizationError);

      await expect(
        BanService.listGlobalBanRequests(merchant1.userId)
      ).rejects.toThrow(BanAuthorizationError);

      await expect(
        BanService.listGlobalBans(merchant1.userId)
      ).rejects.toThrow(BanAuthorizationError);

      // Admin succeeds
      const requests = await BanService.listGlobalBanRequests(adminUserId);
      const bans = await BanService.listGlobalBans(adminUserId);
      expect(Array.isArray(requests)).toBe(true);
      expect(Array.isArray(bans)).toBe(true);

      // Super Admin also succeeds
      const superAdminUserId = "user_super_admin_888";
      mockDb.users.push({ id: superAdminUserId, role: UserRole.SUPER_ADMIN });
      const superRequests = await BanService.listGlobalBanRequests(superAdminUserId);
      const superBans = await BanService.listGlobalBans(superAdminUserId);
      expect(Array.isArray(superRequests)).toBe(true);
      expect(Array.isArray(superBans)).toBe(true);
    });
  });

  // =========================================================================
  // 7. AUTHORITATIVE DESTINATION BAN CHECK
  // =========================================================================
  describe("Authoritative Destination Ban Check", () => {
    it("detects active global ban across any merchant", async () => {
      const { request } = await BanService.createGlobalBanRequest(merchant1, {
        destination: { type: "UPI", vpa: "global_banned_user@upi" },
        reason: "Platform fraud",
        applyImmediateLocalBan: false,
      });

      await BanService.approveGlobalBanRequest(adminUserId, request.id);

      // Check for merchant 2
      const check = await BanService.checkDestinationBan(
        { type: "UPI", vpa: "global_banned_user@upi" },
        merchant2.merchantProfileId
      );

      expect(check.isBanned).toBe(true);
      expect(check.banScope).toBe("GLOBAL");
      expect(check.maskedDestination).toBe("g***@upi");
    });

    it("detects merchant-local ban only for that specific merchant", async () => {
      await BanService.createMerchantBan(merchant1, {
        destination: { type: "UPI", vpa: "local_only@upi" },
        reason: "Local chargeback",
      });

      // Merchant 1 is banned
      const checkM1 = await BanService.checkDestinationBan(
        { type: "UPI", vpa: "local_only@upi" },
        merchant1.merchantProfileId
      );
      expect(checkM1.isBanned).toBe(true);
      expect(checkM1.banScope).toBe("MERCHANT");

      // Merchant 2 is NOT banned
      const checkM2 = await BanService.checkDestinationBan(
        { type: "UPI", vpa: "local_only@upi" },
        merchant2.merchantProfileId
      );
      expect(checkM2.isBanned).toBe(false);
    });

    it("reports not banned for unbanned destinations", async () => {
      const ban = await BanService.createMerchantBan(merchant1, {
        destination: { type: "UPI", vpa: "rehabilitated@upi" },
        reason: "Temporary ban",
      });

      await BanService.unbanMerchantBan(merchant1, ban.id, "Resolved");

      const check = await BanService.checkDestinationBan(
        { type: "UPI", vpa: "rehabilitated@upi" },
        merchant1.merchantProfileId
      );
      expect(check.isBanned).toBe(false);
    });

    it("fails closed and throws BanCryptoConfigurationError if HMAC secret is missing", async () => {
      const savedSecret = process.env.BAN_HASH_SECRET;
      delete process.env.BAN_HASH_SECRET;
      try {
        await expect(
          BanService.checkDestinationBan({ type: "UPI", vpa: "fail_closed_dest@upi" })
        ).rejects.toThrow(BanCryptoConfigurationError);
      } finally {
        if (savedSecret) process.env.BAN_HASH_SECRET = savedSecret;
      }
    });
  });
});
