import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/infrastructure/database/db";
import {
  Prisma,
  UserRole,
  BanStatus,
  BanRequestStatus,
  GlobalBanStatus,
} from "@prisma/client";
import { onboardMerchant } from "@/modules/merchant/domain/merchant.service";
import {
  BanService,
  DuplicateBanError,
  BanNotFoundError,
  InvalidBanStateError,
  BanAuthorizationError,
} from "@/modules/ban/domain/ban.service";
import { AuthenticatedMerchantContext } from "@/modules/auth/application/session-auth.service";
import crypto from "crypto";

const uuidv4 = () => crypto.randomUUID();

describe("Ban Security, Tenant Isolation, and Concurrency Integration Test", () => {
  let adminUserId: string;

  let merchant1UserId: string;
  let merchant1ProfileId: string;
  let actor1: AuthenticatedMerchantContext;

  let merchant2UserId: string;
  let merchant2ProfileId: string;
  let actor2: AuthenticatedMerchantContext;

  beforeAll(async () => {
    // 1. Ensure system settings exist
    await db.systemSetting.upsert({
      where: { id: "GLOBAL_SETTINGS" },
      update: {
        minPayoutAmount: 1,
        maxPayoutAmount: 10000000,
        minWithdrawAmount: 500,
        taxPercentage: 18,
      },
      create: {
        id: "GLOBAL_SETTINGS",
        upiPayoutFee: new Prisma.Decimal(0),
        impsPayoutFee: new Prisma.Decimal(5),
        neftPayoutFee: new Prisma.Decimal(3),
        rtgsPayoutFee: new Prisma.Decimal(10),
        taxPercentage: new Prisma.Decimal(18),
        minPayoutAmount: 1,
        maxPayoutAmount: 10000000,
        minWithdrawAmount: 500,
      },
    });

    // 2. Create Admin user
    const adminUser = await db.user.create({
      data: {
        email: `admin-sec-${Date.now()}@example.com`,
        name: "Security Admin Auditor",
        role: UserRole.ADMIN,
      },
    });
    adminUserId = adminUser.id;

    // 3. Create Merchant 1
    const user1 = await db.user.create({
      data: {
        email: `m1-sec-${Date.now()}@example.com`,
        name: "Merchant 1 Security Test",
      },
    });
    const m1 = await onboardMerchant({
      userId: user1.id,
      businessName: "M1 Security Systems",
    });
    merchant1UserId = user1.id;
    merchant1ProfileId = m1.merchantProfile.id;
    actor1 = {
      userId: user1.id,
      merchantProfileId: m1.merchantProfile.id,
    };

    // 4. Create Merchant 2
    const user2 = await db.user.create({
      data: {
        email: `m2-sec-${Date.now()}@example.com`,
        name: "Merchant 2 Security Test",
      },
    });
    const m2 = await onboardMerchant({
      userId: user2.id,
      businessName: "M2 Security Systems",
    });
    merchant2UserId = user2.id;
    merchant2ProfileId = m2.merchantProfile.id;
    actor2 = {
      userId: user2.id,
      merchantProfileId: m2.merchantProfile.id,
    };
  });

  describe("1. Tenant Isolation & Cross-Merchant Security", () => {
    it("prevents Merchant 2 from unbanning Merchant 1's ban (throws BanNotFoundError)", async () => {
      // Merchant 1 creates a local ban
      const m1Ban = await BanService.createMerchantBan(actor1, {
        destination: { type: "UPI", vpa: "tenant_isolation_unban@upi" },
        reason: "Merchant 1 fraud detection",
      });
      expect(m1Ban.id).toBeDefined();

      // Merchant 2 attempts to unban Merchant 1's ban -> Throws BanNotFoundError
      let caughtError: any;
      try {
        await BanService.unbanMerchantBan(
          actor2,
          m1Ban.id,
          "Unauthorized unban attempt by Merchant 2"
        );
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(BanNotFoundError);
      expect(caughtError.message).toMatch(/not found or access denied/i);

      // Verify the ban remains ACTIVE in the database
      const banInDb = await db.merchantBan.findUnique({ where: { id: m1Ban.id } });
      expect(banInDb?.status).toBe(BanStatus.ACTIVE);
    });

    it("prevents Merchant 2 from viewing Merchant 1's bans (returns empty array for Merchant 2)", async () => {
      // Query bans for Merchant 2 who has created no bans
      const m2Bans = await BanService.listMerchantBans(actor2);
      expect(m2Bans).toEqual([]);

      // Merchant 1 creates another ban
      const m1Ban2 = await BanService.createMerchantBan(actor1, {
        destination: {
          type: "BANK_ACCOUNT",
          accountNumber: "5566778899",
          ifsc: "SBIN0001234",
        },
        reason: "Merchant 1 second private ban",
      });

      // Merchant 1 can view their bans
      const m1Bans = await BanService.listMerchantBans(actor1);
      const foundInM1 = m1Bans.find((b) => b.id === m1Ban2.id);
      expect(foundInM1).toBeDefined();

      // Merchant 2 still cannot see Merchant 1's bans
      const m2BansAfter = await BanService.listMerchantBans(actor2);
      expect(m2BansAfter).toEqual([]);
      expect(m2BansAfter.find((b) => b.id === m1Ban2.id)).toBeUndefined();

      // Also verify global ban requests isolation
      const { request: m1Req } = await BanService.createGlobalBanRequest(actor1, {
        destination: { type: "UPI", vpa: "tenant_isolated_req@upi" },
        reason: "Merchant 1 private global request",
        applyImmediateLocalBan: false,
      });

      const m2Reqs = await BanService.listMerchantGlobalBanRequests(actor2);
      expect(m2Reqs).toEqual([]);
      expect(m2Reqs.find((r) => r.id === m1Req.id)).toBeUndefined();
    });
  });

  describe("2. Admin Authorization Guard", () => {
    it("throws BanAuthorizationError when merchant userId attempts administrative ban operations", async () => {
      const dummyId = uuidv4();

      // 2a. approveGlobalBanRequest
      await expect(
        BanService.approveGlobalBanRequest(
          merchant1UserId,
          dummyId,
          "Unauthorized merchant approval"
        )
      ).rejects.toThrow(BanAuthorizationError);

      // 2b. rejectGlobalBanRequest
      await expect(
        BanService.rejectGlobalBanRequest(
          merchant1UserId,
          dummyId,
          "Unauthorized rejection reason",
          "Unauthorized rejection notes"
        )
      ).rejects.toThrow(BanAuthorizationError);

      // 2c. removeGlobalBan
      await expect(
        BanService.removeGlobalBan(
          merchant1UserId,
          dummyId,
          "Unauthorized removal reason"
        )
      ).rejects.toThrow(BanAuthorizationError);

      // 2d. listGlobalBanRequests
      await expect(
        BanService.listGlobalBanRequests(merchant1UserId)
      ).rejects.toThrow(BanAuthorizationError);

      // 2e. listGlobalBans
      await expect(
        BanService.listGlobalBans(merchant1UserId)
      ).rejects.toThrow(BanAuthorizationError);
    });

    it("throws BanAuthorizationError when non-existent userId or empty string is provided", async () => {
      const nonExistentUserId = "non_existent_user_" + uuidv4();

      await expect(
        BanService.listGlobalBans(nonExistentUserId)
      ).rejects.toThrow(BanAuthorizationError);

      await expect(
        BanService.listGlobalBanRequests("")
      ).rejects.toThrow(BanAuthorizationError);
    });
  });

  describe("3. Zero Leaks", () => {
    it("verifies sanitized outputs and audit log metadata never leak plaintext destinations or HMAC secrets", async () => {
      const sensitiveVpa = "ultra_confidential_leak_target@okhdfcbank";
      const sensitiveAccount = "88990011223344";
      const sensitiveIfsc = "KKBK0000123";

      const configuredHashSecret = process.env.BAN_HASH_SECRET || "";
      const configuredEncryptionKey = process.env.BAN_ENCRYPTION_KEY || "";

      // 3a. Create Merchant Ban with sensitive destination
      const sanitizedMerchantBan = await BanService.createMerchantBan(actor1, {
        destination: { type: "UPI", vpa: sensitiveVpa },
        reason: "Confidential zero leaks compliance check",
      });

      const mBanJson = JSON.stringify(sanitizedMerchantBan);
      expect(mBanJson).not.toContain(sensitiveVpa);
      expect(mBanJson).not.toContain("ultra_confidential_leak_target");
      if (configuredHashSecret) {
        expect(mBanJson).not.toContain(configuredHashSecret);
      }
      if (configuredEncryptionKey) {
        expect(mBanJson).not.toContain(configuredEncryptionKey);
      }
      expect((sanitizedMerchantBan as any).identifierHash).toBeUndefined();
      expect((sanitizedMerchantBan as any).encryptedDestination).toBeUndefined();
      expect((sanitizedMerchantBan as any).hashKeyVersion).toBeUndefined();
      expect((sanitizedMerchantBan as any).encryptionKeyVersion).toBeUndefined();
      expect(sanitizedMerchantBan.maskedDestination).toBe("u***@okhdfcbank");

      // 3b. Create Global Ban Request with sensitive bank account
      const { request: sanitizedGlobalBanRequest } =
        await BanService.createGlobalBanRequest(actor1, {
          destination: {
            type: "BANK_ACCOUNT",
            accountNumber: sensitiveAccount,
            ifsc: sensitiveIfsc,
          },
          reason: "Confidential bank leak audit",
          applyImmediateLocalBan: false,
        });

      const gReqJson = JSON.stringify(sanitizedGlobalBanRequest);
      expect(gReqJson).not.toContain(sensitiveAccount);
      if (configuredHashSecret) {
        expect(gReqJson).not.toContain(configuredHashSecret);
      }
      if (configuredEncryptionKey) {
        expect(gReqJson).not.toContain(configuredEncryptionKey);
      }
      expect((sanitizedGlobalBanRequest as any).identifierHash).toBeUndefined();
      expect((sanitizedGlobalBanRequest as any).encryptedDestination).toBeUndefined();
      expect((sanitizedGlobalBanRequest as any).hashKeyVersion).toBeUndefined();
      expect((sanitizedGlobalBanRequest as any).encryptionKeyVersion).toBeUndefined();
      expect(sanitizedGlobalBanRequest.maskedDestination).toBe("******3344 (KKBK0000123)");

      // 3c. Approve Global Ban and verify SanitizedGlobalBan
      const sanitizedGlobalBan = await BanService.approveGlobalBanRequest(
        adminUserId,
        sanitizedGlobalBanRequest.id,
        "Zero leak verified approval"
      );

      const gBanJson = JSON.stringify(sanitizedGlobalBan);
      expect(gBanJson).not.toContain(sensitiveAccount);
      if (configuredHashSecret) {
        expect(gBanJson).not.toContain(configuredHashSecret);
      }
      if (configuredEncryptionKey) {
        expect(gBanJson).not.toContain(configuredEncryptionKey);
      }
      expect((sanitizedGlobalBan as any).identifierHash).toBeUndefined();
      expect((sanitizedGlobalBan as any).encryptedDestination).toBeUndefined();
      expect((sanitizedGlobalBan as any).hashKeyVersion).toBeUndefined();
      expect((sanitizedGlobalBan as any).encryptionKeyVersion).toBeUndefined();
      expect(sanitizedGlobalBan.maskedDestination).toBe("******3344 (KKBK0000123)");

      // 3d. Inspect all AuditLog records associated with these entities
      const auditLogs = await db.auditLog.findMany({
        where: {
          OR: [
            { entityId: actor1.merchantProfileId },
            { entityId: sanitizedGlobalBan.id },
          ],
        },
      });

      expect(auditLogs.length).toBeGreaterThanOrEqual(3);
      for (const log of auditLogs) {
        const metadataJson = JSON.stringify(log.metadata);
        expect(metadataJson).not.toContain(sensitiveVpa);
        expect(metadataJson).not.toContain(sensitiveAccount);
        if (configuredHashSecret) {
          expect(metadataJson).not.toContain(configuredHashSecret);
        }
        if (configuredEncryptionKey) {
          expect(metadataJson).not.toContain(configuredEncryptionKey);
        }
      }
    });
  });

  describe("4. Concurrency & Advisory Lock Safety", () => {
    it("handles concurrent approveGlobalBanRequest and rejectGlobalBanRequest: exactly one succeeds, one fails with InvalidBanStateError, state is preserved", async () => {
      // Seed a pending global ban request
      const { request: raceRequest } = await BanService.createGlobalBanRequest(
        actor1,
        {
          destination: { type: "UPI", vpa: "race_review_destination@upi" },
          reason: "Request submitted for race validation",
          applyImmediateLocalBan: false,
        }
      );
      expect(raceRequest.status).toBe(BanRequestStatus.PENDING);

      // Concurrently execute approve and reject using Promise.allSettled
      const [resApprove, resReject] = await Promise.allSettled([
        BanService.approveGlobalBanRequest(
          adminUserId,
          raceRequest.id,
          "Concurrent administrative approval"
        ),
        BanService.rejectGlobalBanRequest(
          adminUserId,
          raceRequest.id,
          "Concurrent administrative rejection reason",
          "Concurrent review notes"
        ),
      ]);

      const fulfilled = [resApprove, resReject].filter((r) => r.status === "fulfilled");
      const rejected = [resApprove, resReject].filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const rejectedResult = rejected[0] as PromiseRejectedResult;
      expect(rejectedResult.reason).toBeInstanceOf(InvalidBanStateError);

      // Verify database state is consistent and not corrupted
      const finalRequestState = await db.globalBanRequest.findUniqueOrThrow({
        where: { id: raceRequest.id },
      });

      if (resApprove.status === "fulfilled") {
        expect(finalRequestState.status).toBe(BanRequestStatus.APPROVED);
        const globalBanCreated = await db.globalBan.findFirst({
          where: { sourceRequestId: raceRequest.id },
        });
        expect(globalBanCreated).not.toBeNull();
        expect(globalBanCreated?.status).toBe(GlobalBanStatus.ACTIVE);
      } else {
        expect(finalRequestState.status).toBe(BanRequestStatus.REJECTED);
        const globalBanCreated = await db.globalBan.findFirst({
          where: { sourceRequestId: raceRequest.id },
        });
        expect(globalBanCreated).toBeNull();
      }
    });

    it("handles concurrent duplicate createMerchantBan: exactly one succeeds, one fails with DuplicateBanError", async () => {
      const duplicateDestination = {
        type: "UPI" as const,
        vpa: "race_merchant_dup@upi",
      };

      // Execute concurrent createMerchantBan on identical destination
      const [dup1, dup2] = await Promise.allSettled([
        BanService.createMerchantBan(actor1, {
          destination: duplicateDestination,
          reason: "Concurrent duplicate attempt 1",
        }),
        BanService.createMerchantBan(actor1, {
          destination: duplicateDestination,
          reason: "Concurrent duplicate attempt 2",
        }),
      ]);

      const fulfilled = [dup1, dup2].filter((r) => r.status === "fulfilled");
      const rejected = [dup1, dup2].filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const rejectedResult = rejected[0] as PromiseRejectedResult;
      expect(rejectedResult.reason).toBeInstanceOf(DuplicateBanError);

      // Verify that exactly 1 active ban exists in the database
      const createdBan = (fulfilled[0] as PromiseFulfilledResult<any>).value;
      const activeBansInDb = await db.merchantBan.findMany({
        where: {
          merchantProfileId: actor1.merchantProfileId,
          destinationType: "UPI",
          status: BanStatus.ACTIVE,
        },
      });

      const matchingBan = activeBansInDb.filter((b) => b.id === createdBan.id);
      expect(matchingBan).toHaveLength(1);
      expect(createdBan.maskedDestination).toBe("r***@upi");
    });
  });
});
