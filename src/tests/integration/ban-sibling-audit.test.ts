import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/infrastructure/database/db";
import {
  Prisma,
  UserRole,
  BanRequestStatus,
  GlobalBanStatus,
  AuditActorType,
  AuditEntity,
  AuditAction,
} from "@prisma/client";
import { onboardMerchant } from "@/modules/merchant/domain/merchant.service";
import {
  BanService,
  DuplicateBanError,
} from "@/modules/ban/domain/ban.service";
import { banCryptoService } from "@/modules/ban/application/ban-crypto.service";
import { AuthenticatedMerchantContext } from "@/modules/auth/application/session-auth.service";

describe("Sibling Global Ban Request Audit Events & Atomic Rollback Integration Tests", () => {
  let adminUserId: string;

  let actorA: AuthenticatedMerchantContext;
  let actorB: AuthenticatedMerchantContext;
  let actorC: AuthenticatedMerchantContext;

  const testVpa = "fraud_ring@upi";
  const rollbackVpa = "fraud_rollback@upi";

  const cleanDestinations = async (vpas: string[]) => {
    for (const vpa of vpas) {
      const canonical = banCryptoService.canonicalizeDestination({
        type: "UPI",
        vpa,
      });
      const hashPayload = banCryptoService.hashIdentifier(canonical);
      const candidateHashes = Array.from(
        new Set([
          hashPayload.identifierHash,
          ...((BanService as any).computeNonEmptyCandidateHashes(canonical) as string[]),
        ])
      );

      // Remove any existing active or removed global bans and requests for this hash
      await db.globalBan.deleteMany({
        where: {
          destinationType: "UPI",
          identifierHash: { in: candidateHashes },
        },
      });

      await db.globalBanRequest.deleteMany({
        where: {
          destinationType: "UPI",
          identifierHash: { in: candidateHashes },
        },
      });

      await db.merchantBan.deleteMany({
        where: {
          destinationType: "UPI",
          identifierHash: { in: candidateHashes },
        },
      });
    }
  };

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
        email: `admin-sibling-${Date.now()}@example.com`,
        name: "Admin Sibling Auditor",
        role: UserRole.ADMIN,
      },
    });
    adminUserId = adminUser.id;

    // 3. Setup Merchant A
    const userA = await db.user.create({
      data: {
        email: `merchant-a-${Date.now()}@example.com`,
        name: "Merchant A User",
      },
    });
    const profileA = await onboardMerchant({
      userId: userA.id,
      businessName: "Merchant A Business",
    });
    actorA = {
      userId: userA.id,
      merchantProfileId: profileA.merchantProfile.id,
    };

    // 4. Setup Merchant B
    const userB = await db.user.create({
      data: {
        email: `merchant-b-${Date.now()}@example.com`,
        name: "Merchant B User",
      },
    });
    const profileB = await onboardMerchant({
      userId: userB.id,
      businessName: "Merchant B Business",
    });
    actorB = {
      userId: userB.id,
      merchantProfileId: profileB.merchantProfile.id,
    };

    // 5. Setup Merchant C
    const userC = await db.user.create({
      data: {
        email: `merchant-c-${Date.now()}@example.com`,
        name: "Merchant C User",
      },
    });
    const profileC = await onboardMerchant({
      userId: userC.id,
      businessName: "Merchant C Business",
    });
    actorC = {
      userId: userC.id,
      merchantProfileId: profileC.merchantProfile.id,
    };

    // Clean up test destinations
    await cleanDestinations([testVpa, rollbackVpa]);
  });

  afterAll(async () => {
    await cleanDestinations([testVpa, rollbackVpa]);
  });

  it("approves primary request and atomically auto-resolves sibling requests with audit events for all merchants", async () => {
    // 1. Merchant A submits a global ban request on UPI:fraud_ring@upi
    const { request: requestA } = await BanService.createGlobalBanRequest(actorA, {
      destination: { type: "UPI", vpa: testVpa },
      reason: "Merchant A fraud report: Syndicate mule account",
      applyImmediateLocalBan: false,
    });
    expect(requestA.status).toBe(BanRequestStatus.PENDING);

    // 2. Merchant B submits a global ban request on UPI:fraud_ring@upi
    const { request: requestB } = await BanService.createGlobalBanRequest(actorB, {
      destination: { type: "UPI", vpa: testVpa },
      reason: "Merchant B fraud report: Multiple chargebacks",
      applyImmediateLocalBan: false,
    });
    expect(requestB.status).toBe(BanRequestStatus.PENDING);

    // 3. Merchant C submits a global ban request on UPI:fraud_ring@upi
    const { request: requestC } = await BanService.createGlobalBanRequest(actorC, {
      destination: { type: "UPI", vpa: testVpa },
      reason: "Merchant C fraud report: Unauthorized access detected",
      applyImmediateLocalBan: false,
    });
    expect(requestC.status).toBe(BanRequestStatus.PENDING);

    // 4. Admin approves Merchant A's request
    const reviewNotes = "Verified by platform fraud investigation";
    const approvedGlobalBan = await BanService.approveGlobalBanRequest(
      adminUserId,
      requestA.id,
      reviewNotes,
      { ipAddress: "192.168.1.50", userAgent: "AdminOps/1.0" }
    );
    expect(approvedGlobalBan.status).toBe(GlobalBanStatus.ACTIVE);

    // 5. Verification 1: Merchant A's request status is APPROVED
    const freshReqA = await db.globalBanRequest.findUnique({
      where: { id: requestA.id },
    });
    expect(freshReqA?.status).toBe(BanRequestStatus.APPROVED);
    expect(freshReqA?.reviewedById).toBe(adminUserId);
    expect(freshReqA?.reviewNotes).toBe(reviewNotes);

    // 6. Verification 2: Merchant B's request status is APPROVED with auto-resolved review notes
    const freshReqB = await db.globalBanRequest.findUnique({
      where: { id: requestB.id },
    });
    expect(freshReqB?.status).toBe(BanRequestStatus.APPROVED);
    expect(freshReqB?.reviewedById).toBe(adminUserId);
    expect(freshReqB?.reviewNotes).toContain("Auto-resolved via primary request " + requestA.id);

    // 7. Verification 3: Merchant C's request status is APPROVED with auto-resolved review notes
    const freshReqC = await db.globalBanRequest.findUnique({
      where: { id: requestC.id },
    });
    expect(freshReqC?.status).toBe(BanRequestStatus.APPROVED);
    expect(freshReqC?.reviewedById).toBe(adminUserId);
    expect(freshReqC?.reviewNotes).toContain("Auto-resolved via primary request " + requestA.id);

    // 8. Verification 4: Audit logs contain an APPROVE entry for Merchant A's profile
    const auditA = await db.auditLog.findFirst({
      where: {
        entityType: AuditEntity.MERCHANT_PROFILE,
        entityId: actorA.merchantProfileId,
        action: AuditAction.APPROVE,
      },
    });
    expect(auditA).toBeDefined();
    expect(auditA?.actorType).toBe(AuditActorType.ADMIN);
    expect(auditA?.actorId).toBe(adminUserId);
    expect(auditA?.ipAddress).toBe("192.168.1.50");
    expect(auditA?.userAgent).toBe("AdminOps/1.0");
    const metaA = auditA?.metadata as Record<string, unknown>;
    expect(metaA?.requestId).toBe(requestA.id);
    expect(metaA?.merchantProfileId).toBe(actorA.merchantProfileId);
    expect(metaA?.scope).toBe("GLOBAL");
    expect(metaA?.reviewNotes).toBe(reviewNotes);

    // 9. Verification 5: Audit logs contain individual APPROVE entries for Merchant B & C
    // with autoResolved: true and primaryRequestId: requestA.id
    const auditB = await db.auditLog.findFirst({
      where: {
        entityType: AuditEntity.MERCHANT_PROFILE,
        entityId: actorB.merchantProfileId,
        action: AuditAction.APPROVE,
      },
    });
    expect(auditB).toBeDefined();
    expect(auditB?.actorType).toBe(AuditActorType.ADMIN);
    expect(auditB?.actorId).toBe(adminUserId);
    expect(auditB?.ipAddress).toBe("192.168.1.50");
    expect(auditB?.userAgent).toBe("AdminOps/1.0");
    const metaB = auditB?.metadata as Record<string, unknown>;
    expect(metaB?.requestId).toBe(requestB.id);
    expect(metaB?.merchantProfileId).toBe(actorB.merchantProfileId);
    expect(metaB?.destinationType).toBe("UPI");
    expect(metaB?.reason).toBe(requestB.reason);
    expect(metaB?.reviewNotes).toContain("Auto-resolved via primary request " + requestA.id);
    expect(metaB?.primaryRequestId).toBe(requestA.id);
    expect(metaB?.autoResolved).toBe(true);
    expect(metaB?.scope).toBe("GLOBAL");

    const auditC = await db.auditLog.findFirst({
      where: {
        entityType: AuditEntity.MERCHANT_PROFILE,
        entityId: actorC.merchantProfileId,
        action: AuditAction.APPROVE,
      },
    });
    expect(auditC).toBeDefined();
    expect(auditC?.actorType).toBe(AuditActorType.ADMIN);
    expect(auditC?.actorId).toBe(adminUserId);
    expect(auditC?.ipAddress).toBe("192.168.1.50");
    expect(auditC?.userAgent).toBe("AdminOps/1.0");
    const metaC = auditC?.metadata as Record<string, unknown>;
    expect(metaC?.requestId).toBe(requestC.id);
    expect(metaC?.merchantProfileId).toBe(actorC.merchantProfileId);
    expect(metaC?.destinationType).toBe("UPI");
    expect(metaC?.reason).toBe(requestC.reason);
    expect(metaC?.reviewNotes).toContain("Auto-resolved via primary request " + requestA.id);
    expect(metaC?.primaryRequestId).toBe(requestA.id);
    expect(metaC?.autoResolved).toBe(true);
    expect(metaC?.scope).toBe("GLOBAL");
  });

  it("verifies transaction rollback: when a constraint violation occurs, none of the requests are updated to APPROVED and no audit logs are persisted", async () => {
    // 1. Submit 3 requests for rollback destination
    const { request: rbReqA } = await BanService.createGlobalBanRequest(actorA, {
      destination: { type: "UPI", vpa: rollbackVpa },
      reason: "Merchant A rollback check",
      applyImmediateLocalBan: false,
    });
    const { request: rbReqB } = await BanService.createGlobalBanRequest(actorB, {
      destination: { type: "UPI", vpa: rollbackVpa },
      reason: "Merchant B rollback check",
      applyImmediateLocalBan: false,
    });
    const { request: rbReqC } = await BanService.createGlobalBanRequest(actorC, {
      destination: { type: "UPI", vpa: rollbackVpa },
      reason: "Merchant C rollback check",
      applyImmediateLocalBan: false,
    });

    // 2. Pre-create a REMOVED GlobalBan with sourceRequestId pointing to rbReqA.id
    // This will pass the step 4 findFirst check (which checks status: ACTIVE),
    // and will execute step 5 (updating rbReqA to APPROVED) and step 6-7 (updating siblings and logging audits),
    // but at step 8 (tx.globalBan.create), Postgres will raise a unique constraint error (P2002 on sourceRequestId).
    await db.globalBan.create({
      data: {
        approvedById: adminUserId,
        sourceRequestId: rbReqA.id,
        destinationType: "UPI",
        identifierHash: "dummy_preexisting_hash_for_collision",
        encryptedDestination: "dummy_enc",
        maskedDestination: "dummy_masked@upi",
        reason: "Dummy pre-existing ban occupying sourceRequestId unique constraint",
        status: GlobalBanStatus.REMOVED,
        hashKeyVersion: 1,
        encryptionKeyVersion: 1,
        removedById: adminUserId,
        removedAt: new Date(),
        removalReason: "Testing unique constraint conflict",
      },
    });

    // 3. Attempt approval of rbReqA. Must reject with DuplicateBanError due to unique constraint violation
    await expect(
      BanService.approveGlobalBanRequest(
        adminUserId,
        rbReqA.id,
        "This approval should fail and rollback"
      )
    ).rejects.toThrow(DuplicateBanError);

    // 4. Verify transaction rollback: ALL 3 requests MUST remain in PENDING status
    const freshRbA = await db.globalBanRequest.findUnique({
      where: { id: rbReqA.id },
    });
    expect(freshRbA?.status).toBe(BanRequestStatus.PENDING);
    expect(freshRbA?.reviewedById).toBeNull();
    expect(freshRbA?.reviewedAt).toBeNull();

    const freshRbB = await db.globalBanRequest.findUnique({
      where: { id: rbReqB.id },
    });
    expect(freshRbB?.status).toBe(BanRequestStatus.PENDING);
    expect(freshRbB?.reviewedById).toBeNull();
    expect(freshRbB?.reviewedAt).toBeNull();

    const freshRbC = await db.globalBanRequest.findUnique({
      where: { id: rbReqC.id },
    });
    expect(freshRbC?.status).toBe(BanRequestStatus.PENDING);
    expect(freshRbC?.reviewedById).toBeNull();
    expect(freshRbC?.reviewedAt).toBeNull();

    // 5. Verify NO approval audit logs exist for any of rbReqA, rbReqB, rbReqC
    const allAuditLogs = await db.auditLog.findMany({
      where: {
        action: AuditAction.APPROVE,
        entityType: AuditEntity.MERCHANT_PROFILE,
        entityId: {
          in: [
            actorA.merchantProfileId,
            actorB.merchantProfileId,
            actorC.merchantProfileId,
          ],
        },
      },
    });

    const rollbackAuditLogs = allAuditLogs.filter((log) => {
      const meta = log.metadata as Record<string, unknown> | null;
      return [rbReqA.id, rbReqB.id, rbReqC.id].includes(meta?.requestId as string);
    });

    expect(rollbackAuditLogs).toHaveLength(0);
  });
});
