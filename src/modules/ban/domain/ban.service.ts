import { db } from "@/infrastructure/database/db";
import {
  Prisma,
  BanDestinationType,
  BanStatus,
  BanRequestStatus,
  GlobalBanStatus,
  AuditActorType,
  AuditEntity,
  AuditAction,
  UserRole,
} from "@prisma/client";
import {
  banCryptoService,
  BanDestinationInput,
  BanCryptoConfigurationError,
} from "@/modules/ban/application/ban-crypto.service";
import { logAction } from "@/modules/audit/domain/audit.service";
import { AuthenticatedMerchantContext } from "@/modules/auth/application/session-auth.service";

export class DuplicateBanError extends Error {
  constructor(message = "A ban or ban request already exists for this destination.") {
    super(message);
    this.name = "DuplicateBanError";
  }
}

export class BanNotFoundError extends Error {
  constructor(message = "Ban or ban request not found.") {
    super(message);
    this.name = "BanNotFoundError";
  }
}

export class InvalidBanStateError extends Error {
  constructor(message = "Invalid ban state transition.") {
    super(message);
    this.name = "InvalidBanStateError";
  }
}

export class BanAuthorizationError extends Error {
  constructor(message = "Unauthorized ban operation.") {
    super(message);
    this.name = "BanAuthorizationError";
  }
}

export class BanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BanValidationError";
  }
}

export interface CreateMerchantBanInput {
  destination: BanDestinationInput;
  reason: string;
}

export interface CreateGlobalBanRequestInput {
  destination: BanDestinationInput;
  reason: string;
  applyImmediateLocalBan?: boolean; // Defaults to true
}

export interface BanAuditContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface SanitizedMerchantBan {
  id: string;
  merchantProfileId: string;
  destinationType: BanDestinationType;
  maskedDestination: string;
  reason: string;
  status: BanStatus;
  createdAt: Date;
  updatedAt: Date;
  unbannedAt?: Date | null;
  unbanReason?: string | null;
}

export interface SanitizedGlobalBanRequest {
  id: string;
  merchantProfileId: string;
  destinationType: BanDestinationType;
  maskedDestination: string;
  reason: string;
  status: BanRequestStatus;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
}

export interface SanitizedGlobalBan {
  id: string;
  destinationType: BanDestinationType;
  maskedDestination: string;
  reason: string;
  status: GlobalBanStatus;
  createdAt: Date;
  updatedAt: Date;
  removedAt?: Date | null;
  removalReason?: string | null;
  sourceRequestId?: string | null;
}

export interface DestinationBanCheckResult {
  isBanned: boolean;
  banScope?: "GLOBAL" | "MERCHANT";
  reason?: string;
  maskedDestination?: string;
}

function parseVersionToInt(version: string | number): number {
  if (typeof version === "number" && Number.isInteger(version) && version > 0) {
    return version;
  }
  const match = String(version).match(/(\d+)/);
  const parsed = match ? Number.parseInt(match[1], 10) : 1;
  return Number.isNaN(parsed) || parsed <= 0 ? 1 : parsed;
}

function formatVersionFromInt(version?: number | null): string | undefined {
  if (typeof version === "number" && Number.isInteger(version) && version > 0) {
    return `v${version}`;
  }
  return undefined;
}

export class BanService {
  private static isUniqueConstraintError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return true;
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      return true;
    }
    return false;
  }

  private static isRecordNotFoundError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return true;
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2025"
    ) {
      return true;
    }
    return false;
  }

  private static async assertAdminAuthorized(
    adminUserId: string,
    tx: Prisma.TransactionClient = db
  ): Promise<void> {
    if (!adminUserId || typeof adminUserId !== "string" || !adminUserId.trim()) {
      throw new BanAuthorizationError("Admin authorization is required.");
    }

    const adminUser = await tx.user.findUnique({
      where: { id: adminUserId },
      select: { id: true, role: true },
    });

    if (
      !adminUser ||
      (adminUser.role !== UserRole.ADMIN && adminUser.role !== UserRole.SUPER_ADMIN)
    ) {
      throw new BanAuthorizationError("Admin privileges are required for this operation.");
    }
  }

  private static computeNonEmptyCandidateHashes(canonicalDestination: string): string[] {
    const candidateHashes = banCryptoService
      .computeCandidateHashes(canonicalDestination)
      .map((h) => h.identifierHash)
      .filter((hash): hash is string => Boolean(hash && hash.length > 0));

    if (candidateHashes.length === 0) {
      throw new BanCryptoConfigurationError(
        "Failed to compute destination candidate hashes. Halting ban check closed."
      );
    }

    return candidateHashes;
  }

  /**
   * 1. Create a merchant-local ban.
   * Scoped strictly to the authenticated merchant.
   * Acquires PostgreSQL advisory transaction lock on canonical destination.
   * Transactionally records ban and audit log.
   */
  public static async createMerchantBan(
    actor: AuthenticatedMerchantContext,
    input: CreateMerchantBanInput,
    auditContext?: BanAuditContext
  ): Promise<SanitizedMerchantBan> {
    if (!actor?.merchantProfileId || !actor?.userId) {
      throw new BanAuthorizationError("Authenticated merchant context is required.");
    }

    const trimmedReason = input?.reason?.trim();
    if (!trimmedReason || trimmedReason.length < 3 || trimmedReason.length > 255) {
      throw new BanValidationError("Ban reason is mandatory and must be between 3 and 255 characters.");
    }

    // Canonicalize destination and acquire lock identity
    const canonicalDestination = banCryptoService.canonicalizeDestination(input.destination);
    const lockKey = banCryptoService.getAdvisoryLockKey(canonicalDestination);

    const hashPayload = banCryptoService.hashIdentifier(canonicalDestination);
    const candidateHashes = Array.from(
      new Set([
        hashPayload.identifierHash,
        ...BanService.computeNonEmptyCandidateHashes(canonicalDestination),
      ])
    );
    const encPayload = banCryptoService.encryptDestination(canonicalDestination);
    const masked = banCryptoService.maskDestination(input.destination);

    const hashVersionInt = parseVersionToInt(hashPayload.hashKeyVersion);
    const encVersionInt = parseVersionToInt(encPayload.encryptionKeyVersion);

    return db.$transaction(async (tx) => {
      // Advisory transaction lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      // Concurrency & rotation check: prevent duplicate active ban across all candidate hashes
      const existing = await tx.merchantBan.findFirst({
        where: {
          merchantProfileId: actor.merchantProfileId,
          destinationType: input.destination.type,
          identifierHash: { in: candidateHashes },
          status: BanStatus.ACTIVE,
        },
      });

      if (existing) {
        throw new DuplicateBanError("This destination is already actively banned for your account.");
      }

      let created;
      try {
        created = await tx.merchantBan.create({
          data: {
            merchantProfileId: actor.merchantProfileId,
            createdById: actor.userId,
            destinationType: input.destination.type,
            identifierHash: hashPayload.identifierHash,
            encryptedDestination: encPayload.encryptedDestination,
            maskedDestination: masked,
            reason: trimmedReason,
            status: BanStatus.ACTIVE,
            hashKeyVersion: hashVersionInt,
            encryptionKeyVersion: encVersionInt,
          },
        });
      } catch (err) {
        if (BanService.isUniqueConstraintError(err)) {
          throw new DuplicateBanError("This destination is already actively banned for your account.");
        }
        throw err;
      }

      await logAction(
        {
          actorType: AuditActorType.MERCHANT,
          actorId: actor.userId,
          entityType: AuditEntity.MERCHANT_PROFILE,
          entityId: actor.merchantProfileId,
          action: AuditAction.BAN,
          ipAddress: auditContext?.ipAddress,
          userAgent: auditContext?.userAgent,
          metadata: {
            banId: created.id,
            destinationType: created.destinationType,
            maskedDestination: created.maskedDestination,
            reason: created.reason,
            scope: "MERCHANT",
          },
        },
        tx
      );

      return {
        id: created.id,
        merchantProfileId: created.merchantProfileId,
        destinationType: created.destinationType,
        maskedDestination: created.maskedDestination,
        reason: created.reason,
        status: created.status,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
    });
  }

  /**
   * 2. List merchant-local bans strictly scoped to authenticated merchant.
   */
  public static async listMerchantBans(
    actor: AuthenticatedMerchantContext,
    options?: { status?: BanStatus }
  ): Promise<SanitizedMerchantBan[]> {
    if (!actor?.merchantProfileId) {
      throw new BanAuthorizationError("Authenticated merchant context is required.");
    }

    const bans = await db.merchantBan.findMany({
      where: {
        merchantProfileId: actor.merchantProfileId,
        ...(options?.status ? { status: options.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        merchantProfileId: true,
        destinationType: true,
        maskedDestination: true,
        reason: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        unbannedAt: true,
        unbanReason: true,
      },
    });

    return bans;
  }

  /**
   * List global ban requests submitted by the authenticated merchant.
   */
  public static async listMerchantGlobalBanRequests(
    actor: AuthenticatedMerchantContext,
    options?: { status?: BanRequestStatus }
  ): Promise<SanitizedGlobalBanRequest[]> {
    if (!actor?.merchantProfileId) {
      throw new BanAuthorizationError("Authenticated merchant context is required.");
    }

    const requests = await db.globalBanRequest.findMany({
      where: {
        merchantProfileId: actor.merchantProfileId,
        ...(options?.status ? { status: options.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        merchantProfileId: true,
        destinationType: true,
        maskedDestination: true,
        reason: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        reviewedAt: true,
        reviewNotes: true,
        rejectionReason: true,
      },
    });

    return requests;
  }

  /**
   * 3. Unban a merchant-local ban.
   * Enforces strict merchant ownership, advisory lock, and mandatory unban reason.
   */
  public static async unbanMerchantBan(
    actor: AuthenticatedMerchantContext,
    banId: string,
    reason: string,
    auditContext?: BanAuditContext
  ): Promise<SanitizedMerchantBan> {
    if (!actor?.merchantProfileId || !actor?.userId) {
      throw new BanAuthorizationError("Authenticated merchant context is required.");
    }
    if (!banId) {
      throw new BanValidationError("Ban ID is required.");
    }
    const trimmedReason = reason?.trim();
    if (!trimmedReason || trimmedReason.length < 3 || trimmedReason.length > 255) {
      throw new BanValidationError("Unban reason is mandatory and must be between 3 and 255 characters.");
    }

    return db.$transaction(async (tx) => {
      const initialBan = await tx.merchantBan.findUnique({
        where: { id: banId },
      });

      if (!initialBan || initialBan.merchantProfileId !== actor.merchantProfileId) {
        throw new BanNotFoundError("Merchant ban not found or access denied.");
      }

      const canonicalDestination = banCryptoService.decryptDestination(
        initialBan.encryptedDestination,
        { keyVersion: formatVersionFromInt(initialBan.encryptionKeyVersion) }
      );
      const lockKey = banCryptoService.getAdvisoryLockKey(canonicalDestination);

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      const ban = await tx.merchantBan.findUnique({
        where: { id: banId },
      });

      if (!ban || ban.merchantProfileId !== actor.merchantProfileId) {
        throw new BanNotFoundError("Merchant ban not found or access denied.");
      }

      if (ban.status !== BanStatus.ACTIVE) {
        throw new InvalidBanStateError("Ban is not in an active state.");
      }

      let updated;
      try {
        updated = await tx.merchantBan.update({
          where: { id: banId, status: BanStatus.ACTIVE },
          data: {
            status: BanStatus.UNBANNED,
            unbannedById: actor.userId,
            unbannedAt: new Date(),
            unbanReason: trimmedReason,
          },
        });
      } catch (err) {
        if (BanService.isRecordNotFoundError(err)) {
          throw new InvalidBanStateError("Ban is not in an active state.");
        }
        throw err;
      }

      await logAction(
        {
          actorType: AuditActorType.MERCHANT,
          actorId: actor.userId,
          entityType: AuditEntity.MERCHANT_PROFILE,
          entityId: actor.merchantProfileId,
          action: AuditAction.UNBAN,
          ipAddress: auditContext?.ipAddress,
          userAgent: auditContext?.userAgent,
          metadata: {
            banId: updated.id,
            destinationType: updated.destinationType,
            maskedDestination: updated.maskedDestination,
            unbanReason: updated.unbanReason,
            scope: "MERCHANT",
          },
        },
        tx
      );

      return {
        id: updated.id,
        merchantProfileId: updated.merchantProfileId,
        destinationType: updated.destinationType,
        maskedDestination: updated.maskedDestination,
        reason: updated.reason,
        status: updated.status,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        unbannedAt: updated.unbannedAt,
        unbanReason: updated.unbanReason,
      };
    });
  }

  /**
   * 4. Submit a platform-wide global ban request.
   * Product Decision 1: Offers immediate local ban, checked by default with opt-out.
   */
  public static async createGlobalBanRequest(
    actor: AuthenticatedMerchantContext,
    input: CreateGlobalBanRequestInput,
    auditContext?: BanAuditContext
  ): Promise<{ request: SanitizedGlobalBanRequest; localBan?: SanitizedMerchantBan }> {
    if (!actor?.merchantProfileId || !actor?.userId) {
      throw new BanAuthorizationError("Authenticated merchant context is required.");
    }

    const trimmedReason = input?.reason?.trim();
    if (!trimmedReason || trimmedReason.length < 3 || trimmedReason.length > 255) {
      throw new BanValidationError(
        "Global ban request reason is mandatory and must be between 3 and 255 characters."
      );
    }

    const canonicalDestination = banCryptoService.canonicalizeDestination(input.destination);
    const lockKey = banCryptoService.getAdvisoryLockKey(canonicalDestination);

    const hashPayload = banCryptoService.hashIdentifier(canonicalDestination);
    const candidateHashes = Array.from(
      new Set([
        hashPayload.identifierHash,
        ...BanService.computeNonEmptyCandidateHashes(canonicalDestination),
      ])
    );
    const requestEncPayload = banCryptoService.encryptDestination(canonicalDestination);
    const masked = banCryptoService.maskDestination(input.destination);

    const hashVersionInt = parseVersionToInt(hashPayload.hashKeyVersion);
    const requestEncVersionInt = parseVersionToInt(requestEncPayload.encryptionKeyVersion);

    const shouldApplyLocal = input.applyImmediateLocalBan ?? true;

    return db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      // 1. Prevent duplicate pending global ban requests from this merchant across candidate hashes
      const existingPending = await tx.globalBanRequest.findFirst({
        where: {
          merchantProfileId: actor.merchantProfileId,
          destinationType: input.destination.type,
          identifierHash: { in: candidateHashes },
          status: BanRequestStatus.PENDING,
        },
      });

      if (existingPending) {
        throw new DuplicateBanError(
          "A global ban request for this destination is already pending administrative review."
        );
      }

      // 2. Prevent request if already actively banned globally across candidate hashes
      const existingGlobal = await tx.globalBan.findFirst({
        where: {
          destinationType: input.destination.type,
          identifierHash: { in: candidateHashes },
          status: GlobalBanStatus.ACTIVE,
        },
      });

      if (existingGlobal) {
        throw new DuplicateBanError("This destination is already actively banned platform-wide.");
      }

      let request;
      try {
        request = await tx.globalBanRequest.create({
          data: {
            merchantProfileId: actor.merchantProfileId,
            createdById: actor.userId,
            destinationType: input.destination.type,
            identifierHash: hashPayload.identifierHash,
            encryptedDestination: requestEncPayload.encryptedDestination,
            maskedDestination: masked,
            reason: trimmedReason,
            status: BanRequestStatus.PENDING,
            hashKeyVersion: hashVersionInt,
            encryptionKeyVersion: requestEncVersionInt,
          },
        });
      } catch (err) {
        if (BanService.isUniqueConstraintError(err)) {
          throw new DuplicateBanError(
            "A global ban request for this destination is already pending administrative review."
          );
        }
        throw err;
      }

      await logAction(
        {
          actorType: AuditActorType.MERCHANT,
          actorId: actor.userId,
          entityType: AuditEntity.MERCHANT_PROFILE,
          entityId: actor.merchantProfileId,
          action: AuditAction.CREATE,
          ipAddress: auditContext?.ipAddress,
          userAgent: auditContext?.userAgent,
          metadata: {
            requestId: request.id,
            destinationType: request.destinationType,
            maskedDestination: request.maskedDestination,
            reason: request.reason,
            scope: "GLOBAL_REQUEST",
          },
        },
        tx
      );

      let createdLocalBan: SanitizedMerchantBan | undefined;

      // 3. Apply immediate local ban if opted in (default: true)
      if (shouldApplyLocal) {
        const existingLocal = await tx.merchantBan.findFirst({
          where: {
            merchantProfileId: actor.merchantProfileId,
            destinationType: input.destination.type,
            identifierHash: { in: candidateHashes },
            status: BanStatus.ACTIVE,
          },
        });

        if (existingLocal) {
          createdLocalBan = {
            id: existingLocal.id,
            merchantProfileId: existingLocal.merchantProfileId,
            destinationType: existingLocal.destinationType,
            maskedDestination: existingLocal.maskedDestination,
            reason: existingLocal.reason,
            status: existingLocal.status,
            createdAt: existingLocal.createdAt,
            updatedAt: existingLocal.updatedAt,
            unbannedAt: existingLocal.unbannedAt,
            unbanReason: existingLocal.unbanReason,
          };
        } else {
          // Fresh encryption payload with independent random IV
          const localEncPayload = banCryptoService.encryptDestination(canonicalDestination);
          const localEncVersionInt = parseVersionToInt(localEncPayload.encryptionKeyVersion);

          let local;
          try {
            local = await tx.merchantBan.create({
              data: {
                merchantProfileId: actor.merchantProfileId,
                createdById: actor.userId,
                destinationType: input.destination.type,
                identifierHash: hashPayload.identifierHash,
                encryptedDestination: localEncPayload.encryptedDestination,
                maskedDestination: masked,
                reason: trimmedReason,
                status: BanStatus.ACTIVE,
                hashKeyVersion: hashVersionInt,
                encryptionKeyVersion: localEncVersionInt,
              },
            });
          } catch (err) {
            if (BanService.isUniqueConstraintError(err)) {
              throw new DuplicateBanError(
                "This destination is already actively banned for your account."
              );
            }
            throw err;
          }

          await logAction(
            {
              actorType: AuditActorType.MERCHANT,
              actorId: actor.userId,
              entityType: AuditEntity.MERCHANT_PROFILE,
              entityId: actor.merchantProfileId,
              action: AuditAction.BAN,
              ipAddress: auditContext?.ipAddress,
              userAgent: auditContext?.userAgent,
              metadata: {
                banId: local.id,
                destinationType: local.destinationType,
                maskedDestination: local.maskedDestination,
                reason: local.reason,
                scope: "LOCAL_AUTO_BAN",
              },
            },
            tx
          );

          createdLocalBan = {
            id: local.id,
            merchantProfileId: local.merchantProfileId,
            destinationType: local.destinationType,
            maskedDestination: local.maskedDestination,
            reason: local.reason,
            status: local.status,
            createdAt: local.createdAt,
            updatedAt: local.updatedAt,
          };
        }
      }

      return {
        request: {
          id: request.id,
          merchantProfileId: request.merchantProfileId,
          destinationType: request.destinationType,
          maskedDestination: request.maskedDestination,
          reason: request.reason,
          status: request.status,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
        },
        localBan: createdLocalBan,
      };
    });
  }

  /**
   * 5. Approve global ban request (Admin Authorization required).
   * Atomically acquires advisory lock, verifies PENDING status, marks request and sibling pending requests APPROVED, and creates global_bans row.
   */
  public static async approveGlobalBanRequest(
    adminUserId: string,
    requestId: string,
    reviewNotes?: string,
    auditContext?: BanAuditContext
  ): Promise<SanitizedGlobalBan> {
    if (!adminUserId || typeof adminUserId !== "string" || !adminUserId.trim()) {
      throw new BanAuthorizationError("Admin authorization is required.");
    }
    if (!requestId) {
      throw new BanValidationError("Request ID is required.");
    }

    const trimmedReviewNotes = reviewNotes?.trim() || null;

    return db.$transaction(async (tx) => {
      await BanService.assertAdminAuthorized(adminUserId, tx);

      const initialRequest = await tx.globalBanRequest.findUnique({
        where: { id: requestId },
      });

      if (!initialRequest) {
        throw new BanNotFoundError("Global ban request not found.");
      }

      // Recover canonical destination and acquire advisory lock FIRST before status checks
      const canonicalDestination = banCryptoService.decryptDestination(
        initialRequest.encryptedDestination,
        { keyVersion: formatVersionFromInt(initialRequest.encryptionKeyVersion) }
      );
      const lockKey = banCryptoService.getAdvisoryLockKey(canonicalDestination);

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      // Re-read request under advisory lock
      const request = await tx.globalBanRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new BanNotFoundError("Global ban request not found.");
      }

      if (request.status !== BanRequestStatus.PENDING) {
        throw new InvalidBanStateError("Global ban request is not in PENDING status.");
      }

      const candidateHashes = Array.from(
        new Set([
          request.identifierHash,
          ...BanService.computeNonEmptyCandidateHashes(canonicalDestination),
        ])
      );

      // Prevent concurrent duplicate active global bans across all candidate hashes
      const existingActiveGlobal = await tx.globalBan.findFirst({
        where: {
          destinationType: request.destinationType,
          identifierHash: { in: candidateHashes },
          status: GlobalBanStatus.ACTIVE,
        },
      });

      if (existingActiveGlobal) {
        throw new DuplicateBanError(
          "An active platform-wide ban already exists for this destination."
        );
      }

      const now = new Date();

      // Update primary request status to APPROVED with optimistic status guard
      try {
        await tx.globalBanRequest.update({
          where: { id: requestId, status: BanRequestStatus.PENDING },
          data: {
            status: BanRequestStatus.APPROVED,
            reviewedById: adminUserId,
            reviewedAt: now,
            reviewNotes: trimmedReviewNotes,
          },
        });
      } catch (err) {
        if (BanService.isRecordNotFoundError(err)) {
          throw new InvalidBanStateError("Global ban request is not in PENDING status.");
        }
        throw err;
      }

      // Auto-resolve any other PENDING requests across merchants for the same destination
      const otherPendingRequests = await tx.globalBanRequest.findMany({
        where: {
          destinationType: request.destinationType,
          identifierHash: { in: candidateHashes },
          status: BanRequestStatus.PENDING,
        },
      });

      const autoResolvedNotes = trimmedReviewNotes
        ? `${trimmedReviewNotes} (Auto-resolved via primary request ${request.id})`
        : `Auto-resolved via approval of primary request ${request.id}`;

      for (const sibling of otherPendingRequests) {
        if (sibling.id === request.id) continue;
        const siblingNotes = sibling.reviewNotes || autoResolvedNotes;
        await tx.globalBanRequest.update({
          where: { id: sibling.id, status: BanRequestStatus.PENDING },
          data: {
            status: BanRequestStatus.APPROVED,
            reviewedById: adminUserId,
            reviewedAt: now,
            reviewNotes: siblingNotes,
          },
        });

        await logAction(
          {
            actorType: AuditActorType.ADMIN,
            actorId: adminUserId,
            entityType: AuditEntity.MERCHANT_PROFILE,
            entityId: sibling.merchantProfileId,
            action: AuditAction.APPROVE,
            ipAddress: auditContext?.ipAddress,
            userAgent: auditContext?.userAgent,
            metadata: {
              requestId: sibling.id,
              merchantProfileId: sibling.merchantProfileId,
              destinationType: sibling.destinationType,
              maskedDestination: sibling.maskedDestination,
              reason: sibling.reason,
              reviewNotes: siblingNotes,
              primaryRequestId: request.id,
              autoResolved: true,
              scope: "GLOBAL",
            },
          },
          tx
        );
      }

      // Create authoritative GlobalBan
      let globalBan;
      try {
        globalBan = await tx.globalBan.create({
          data: {
            approvedById: adminUserId,
            sourceRequestId: request.id,
            destinationType: request.destinationType,
            identifierHash: request.identifierHash,
            encryptedDestination: request.encryptedDestination,
            maskedDestination: request.maskedDestination,
            reason: request.reason,
            status: GlobalBanStatus.ACTIVE,
            hashKeyVersion: request.hashKeyVersion,
            encryptionKeyVersion: request.encryptionKeyVersion,
          },
        });
      } catch (err) {
        if (BanService.isUniqueConstraintError(err)) {
          throw new DuplicateBanError(
            "An active platform-wide ban already exists for this destination."
          );
        }
        throw err;
      }

      await logAction(
        {
          actorType: AuditActorType.ADMIN,
          actorId: adminUserId,
          entityType: AuditEntity.MERCHANT_PROFILE,
          entityId: request.merchantProfileId,
          action: AuditAction.APPROVE,
          ipAddress: auditContext?.ipAddress,
          userAgent: auditContext?.userAgent,
          metadata: {
            requestId: request.id,
            merchantProfileId: request.merchantProfileId,
            destinationType: request.destinationType,
            maskedDestination: request.maskedDestination,
            reason: request.reason,
            ...(trimmedReviewNotes ? { reviewNotes: trimmedReviewNotes } : {}),
            scope: "GLOBAL",
          },
        },
        tx
      );

      await logAction(
        {
          actorType: AuditActorType.ADMIN,
          actorId: adminUserId,
          entityType: AuditEntity.SYSTEM,
          entityId: globalBan.id,
          action: AuditAction.APPROVE,
          ipAddress: auditContext?.ipAddress,
          userAgent: auditContext?.userAgent,
          metadata: {
            globalBanId: globalBan.id,
            sourceRequestId: request.id,
            destinationType: globalBan.destinationType,
            maskedDestination: globalBan.maskedDestination,
            reason: globalBan.reason,
            ...(trimmedReviewNotes ? { reviewNotes: trimmedReviewNotes } : {}),
            scope: "GLOBAL",
          },
        },
        tx
      );

      return {
        id: globalBan.id,
        destinationType: globalBan.destinationType,
        maskedDestination: globalBan.maskedDestination,
        reason: globalBan.reason,
        status: globalBan.status,
        createdAt: globalBan.createdAt,
        updatedAt: globalBan.updatedAt,
        sourceRequestId: globalBan.sourceRequestId,
      };
    });
  }

  /**
   * 6. Reject global ban request (Admin Authorization required).
   * Requires mandatory rejectionReason and acquires advisory lock.
   */
  public static async rejectGlobalBanRequest(
    adminUserId: string,
    requestId: string,
    rejectionReason: string,
    reviewNotes?: string,
    auditContext?: BanAuditContext
  ): Promise<SanitizedGlobalBanRequest> {
    if (!adminUserId || typeof adminUserId !== "string" || !adminUserId.trim()) {
      throw new BanAuthorizationError("Admin authorization is required.");
    }
    if (!requestId) {
      throw new BanValidationError("Request ID is required.");
    }
    const trimmedReason = rejectionReason?.trim();
    if (!trimmedReason || trimmedReason.length < 3 || trimmedReason.length > 255) {
      throw new BanValidationError(
        "Rejection reason is mandatory and must be between 3 and 255 characters."
      );
    }

    const trimmedReviewNotes = reviewNotes?.trim() || null;

    return db.$transaction(async (tx) => {
      await BanService.assertAdminAuthorized(adminUserId, tx);

      const initialRequest = await tx.globalBanRequest.findUnique({
        where: { id: requestId },
      });

      if (!initialRequest) {
        throw new BanNotFoundError("Global ban request not found.");
      }

      const canonicalDestination = banCryptoService.decryptDestination(
        initialRequest.encryptedDestination,
        { keyVersion: formatVersionFromInt(initialRequest.encryptionKeyVersion) }
      );
      const lockKey = banCryptoService.getAdvisoryLockKey(canonicalDestination);

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      const request = await tx.globalBanRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) {
        throw new BanNotFoundError("Global ban request not found.");
      }

      if (request.status !== BanRequestStatus.PENDING) {
        throw new InvalidBanStateError("Global ban request is not in PENDING status.");
      }

      let updated;
      try {
        updated = await tx.globalBanRequest.update({
          where: { id: requestId, status: BanRequestStatus.PENDING },
          data: {
            status: BanRequestStatus.REJECTED,
            reviewedById: adminUserId,
            reviewedAt: new Date(),
            rejectionReason: trimmedReason,
            reviewNotes: trimmedReviewNotes,
          },
        });
      } catch (err) {
        if (BanService.isRecordNotFoundError(err)) {
          throw new InvalidBanStateError("Global ban request is not in PENDING status.");
        }
        throw err;
      }

      await logAction(
        {
          actorType: AuditActorType.ADMIN,
          actorId: adminUserId,
          entityType: AuditEntity.SYSTEM,
          entityId: updated.id,
          action: AuditAction.REJECT,
          ipAddress: auditContext?.ipAddress,
          userAgent: auditContext?.userAgent,
          metadata: {
            requestId: updated.id,
            destinationType: updated.destinationType,
            maskedDestination: updated.maskedDestination,
            rejectionReason: updated.rejectionReason,
            ...(trimmedReviewNotes ? { reviewNotes: trimmedReviewNotes } : {}),
            scope: "GLOBAL_REQUEST",
          },
        },
        tx
      );

      return {
        id: updated.id,
        merchantProfileId: updated.merchantProfileId,
        destinationType: updated.destinationType,
        maskedDestination: updated.maskedDestination,
        reason: updated.reason,
        status: updated.status,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        reviewedAt: updated.reviewedAt,
        reviewNotes: updated.reviewNotes,
        rejectionReason: updated.rejectionReason,
      };
    });
  }

  /**
   * 7. Remove an active global ban (Admin Authorization required).
   * Requires mandatory removalReason and acquires advisory lock.
   */
  public static async removeGlobalBan(
    adminUserId: string,
    globalBanId: string,
    removalReason: string,
    auditContext?: BanAuditContext
  ): Promise<SanitizedGlobalBan> {
    if (!adminUserId || typeof adminUserId !== "string" || !adminUserId.trim()) {
      throw new BanAuthorizationError("Admin authorization is required.");
    }
    if (!globalBanId) {
      throw new BanValidationError("Global ban ID is required.");
    }
    const trimmedReason = removalReason?.trim();
    if (!trimmedReason || trimmedReason.length < 3 || trimmedReason.length > 255) {
      throw new BanValidationError(
        "Removal reason is mandatory and must be between 3 and 255 characters."
      );
    }

    return db.$transaction(async (tx) => {
      await BanService.assertAdminAuthorized(adminUserId, tx);

      const initialBan = await tx.globalBan.findUnique({
        where: { id: globalBanId },
      });

      if (!initialBan) {
        throw new BanNotFoundError("Global ban not found.");
      }

      const canonicalDestination = banCryptoService.decryptDestination(
        initialBan.encryptedDestination,
        { keyVersion: formatVersionFromInt(initialBan.encryptionKeyVersion) }
      );
      const lockKey = banCryptoService.getAdvisoryLockKey(canonicalDestination);

      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      const ban = await tx.globalBan.findUnique({
        where: { id: globalBanId },
      });

      if (!ban) {
        throw new BanNotFoundError("Global ban not found.");
      }

      if (ban.status !== GlobalBanStatus.ACTIVE) {
        throw new InvalidBanStateError("Global ban is not in an active state.");
      }

      let updated;
      try {
        updated = await tx.globalBan.update({
          where: { id: globalBanId, status: GlobalBanStatus.ACTIVE },
          data: {
            status: GlobalBanStatus.REMOVED,
            removedById: adminUserId,
            removedAt: new Date(),
            removalReason: trimmedReason,
          },
        });
      } catch (err) {
        if (BanService.isRecordNotFoundError(err)) {
          throw new InvalidBanStateError("Global ban is not in an active state.");
        }
        throw err;
      }

      await logAction(
        {
          actorType: AuditActorType.ADMIN,
          actorId: adminUserId,
          entityType: AuditEntity.SYSTEM,
          entityId: updated.id,
          action: AuditAction.UNBAN,
          ipAddress: auditContext?.ipAddress,
          userAgent: auditContext?.userAgent,
          metadata: {
            globalBanId: updated.id,
            destinationType: updated.destinationType,
            maskedDestination: updated.maskedDestination,
            removalReason: updated.removalReason,
            scope: "GLOBAL",
          },
        },
        tx
      );

      return {
        id: updated.id,
        destinationType: updated.destinationType,
        maskedDestination: updated.maskedDestination,
        reason: updated.reason,
        status: updated.status,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        removedAt: updated.removedAt,
        removalReason: updated.removalReason,
        sourceRequestId: updated.sourceRequestId,
      };
    });
  }

  /**
   * 8. Authoritative Destination Ban Check.
   * Checks both Global bans and Merchant-local bans.
   * Multi-key rotation aware: checks candidate hashes across registered HMAC secrets.
   * Fail closed: any error thrown or empty candidate hashes halts execution.
   */
  public static async checkDestinationBan(
    destination: BanDestinationInput,
    merchantProfileId?: string,
    tx: Prisma.TransactionClient = db
  ): Promise<DestinationBanCheckResult> {
    const canonical = banCryptoService.canonicalizeDestination(destination);
    const candidateHashes = BanService.computeNonEmptyCandidateHashes(canonical);

    // 1. Authoritative check on platform-wide Global Bans
    const globalBan = await tx.globalBan.findFirst({
      where: {
        destinationType: destination.type,
        identifierHash: { in: candidateHashes },
        status: GlobalBanStatus.ACTIVE,
      },
    });

    if (globalBan) {
      return {
        isBanned: true,
        banScope: "GLOBAL",
        reason: globalBan.reason,
        maskedDestination: globalBan.maskedDestination,
      };
    }

    // 2. Authoritative check on Merchant-local Bans if merchantProfileId is supplied
    if (merchantProfileId) {
      const localBan = await tx.merchantBan.findFirst({
        where: {
          merchantProfileId,
          destinationType: destination.type,
          identifierHash: { in: candidateHashes },
          status: BanStatus.ACTIVE,
        },
      });

      if (localBan) {
        return {
          isBanned: true,
          banScope: "MERCHANT",
          reason: localBan.reason,
          maskedDestination: localBan.maskedDestination,
        };
      }
    }

    return { isBanned: false };
  }

  /**
   * List global ban requests (Admin only).
   */
  public static async listGlobalBanRequests(
    adminUserId: string,
    options?: {
      status?: BanRequestStatus;
    }
  ): Promise<SanitizedGlobalBanRequest[]> {
    await BanService.assertAdminAuthorized(adminUserId);

    const requests = await db.globalBanRequest.findMany({
      where: {
        ...(options?.status ? { status: options.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        merchantProfileId: true,
        destinationType: true,
        maskedDestination: true,
        reason: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        reviewedAt: true,
        reviewNotes: true,
        rejectionReason: true,
      },
    });

    return requests;
  }

  /**
   * List platform-wide global bans (Admin only).
   */
  public static async listGlobalBans(
    adminUserId: string,
    options?: {
      status?: GlobalBanStatus;
    }
  ): Promise<SanitizedGlobalBan[]> {
    await BanService.assertAdminAuthorized(adminUserId);

    const bans = await db.globalBan.findMany({
      where: {
        ...(options?.status ? { status: options.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        destinationType: true,
        maskedDestination: true,
        reason: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        removedAt: true,
        removalReason: true,
        sourceRequestId: true,
      },
    });

    return bans;
  }
}
