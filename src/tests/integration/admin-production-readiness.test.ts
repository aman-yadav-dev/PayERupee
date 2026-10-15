import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { NextRequest } from "next/server";
import {
  UserRole,
  AccountStatus,
  KycStatus,
  WithdrawalStatus,
  FundRequestStatus,
  AuditActorType,
  AuditEntity,
  AuditAction,
  Prisma,
} from "@prisma/client";

// Import API Route Handlers
import { GET as getWithdrawals } from "@/app/api/v1/admin/withdrawals/route";
import { GET as getFundRequests } from "@/app/api/v1/admin/fund-requests/route";
import { GET as getKycApplications } from "@/app/api/v1/admin/kyc/applications/route";
import { GET as getAuditLogs } from "@/app/api/v1/admin/audit-logs/route";
import { GET as downloadKycDocument } from "@/app/api/v1/admin/kyc/applications/[applicationId]/documents/[documentId]/download/route";
import { POST as suspendMerchant } from "@/app/api/v1/admin/merchants/[id]/suspend/route";

// Mock Better-Auth session lookup
vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));
import { auth } from "@/modules/auth/infrastructure/auth";

// Mock LocalDiskStorageAdapter for document download
vi.mock("@/infrastructure/storage/local-disk.adapter", () => {
  return {
    LocalDiskStorageAdapter: class {
      put = vi.fn().mockResolvedValue(undefined);
      get = vi.fn().mockResolvedValue(Buffer.from("mock-pdf-content-for-readiness"));
      delete = vi.fn().mockResolvedValue(undefined);
    },
  };
});

describe("Admin Production Readiness Integration Tests", () => {
  const adminUserId = "admin-prod-readiness";
  const merchantUserId = "merchant-prod-readiness";
  let counter = 0;

  function uniqueId(prefix: string) {
    counter++;
    return `${prefix}-${Date.now()}-${counter}-${Math.random().toString(36).substring(7)}`;
  }

  beforeEach(async () => {
    // Seed base admin and merchant users
    await db.user.upsert({
      where: { id: adminUserId },
      update: { role: UserRole.ADMIN },
      create: {
        id: adminUserId,
        email: "admin-readiness@payerupee.test",
        name: "Admin Readiness",
        role: UserRole.ADMIN,
      },
    });

    await db.user.upsert({
      where: { id: merchantUserId },
      update: { role: UserRole.MERCHANT },
      create: {
        id: merchantUserId,
        email: "merchant-readiness@payerupee.test",
        name: "Merchant Readiness",
        role: UserRole.MERCHANT,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function mockAdminSession() {
    (auth.api.getSession as any).mockResolvedValue({
      user: { id: adminUserId },
      session: { id: `session-${adminUserId}` },
    });
  }

  function mockMerchantSession() {
    (auth.api.getSession as any).mockResolvedValue({
      user: { id: merchantUserId },
      session: { id: `session-${merchantUserId}` },
    });
  }

  function mockUnauthenticated() {
    (auth.api.getSession as any).mockResolvedValue(null);
  }

  // ============================================================================
  // Scenario 1: Withdrawals Pagination & Filtering API
  // ============================================================================
  describe("1. Withdrawals Pagination & Filtering API", () => {
    it("returns paginated and filtered withdrawals with deterministic sorting and auth gates", async () => {
      // Create dedicated merchant and bank for isolation
      const uId = uniqueId("user-w");
      const pId = uniqueId("prof-w");
      const bId = uniqueId("bank-w");

      await db.user.create({
        data: { id: uId, email: `${uId}@test.com`, name: "Withdrawal Merchant", role: UserRole.MERCHANT },
      });
      await db.merchantProfile.create({
        data: { id: pId, userId: uId, businessName: "Withdrawal Corp", accountStatus: AccountStatus.ACTIVE },
      });
      await db.merchantBank.create({
        data: {
          id: bId,
          merchantProfileId: pId,
          accountNumber: "1234567890",
          ifscCode: "HDFC0001234",
          accountHolderName: "Withdrawal Corp",
          isVerified: true,
          isActive: true,
        },
      });

      // Seed withdrawals with different statuses and distinct createdAt timestamps
      // Note: In Prisma schema, WithdrawalStatus enum values are PENDING, PROCESSING, SUCCESS, FAILED, REVERSED
      const w1 = await db.withdrawal.create({
        data: {
          merchantProfileId: pId,
          merchantBankId: bId,
          idempotencyKey: uniqueId("idemp-w1"),
          amount: new Prisma.Decimal(100),
          totalDebitAmount: new Prisma.Decimal(100),
          status: WithdrawalStatus.PENDING,
          createdAt: new Date("2026-06-01T10:00:00.000Z"),
        },
      });

      const w2 = await db.withdrawal.create({
        data: {
          merchantProfileId: pId,
          merchantBankId: bId,
          idempotencyKey: uniqueId("idemp-w2"),
          amount: new Prisma.Decimal(200),
          totalDebitAmount: new Prisma.Decimal(200),
          status: WithdrawalStatus.SUCCESS,
          createdAt: new Date("2026-06-02T10:00:00.000Z"),
        },
      });

      const w3 = await db.withdrawal.create({
        data: {
          merchantProfileId: pId,
          merchantBankId: bId,
          idempotencyKey: uniqueId("idemp-w3"),
          amount: new Prisma.Decimal(300),
          totalDebitAmount: new Prisma.Decimal(300),
          status: WithdrawalStatus.FAILED,
          createdAt: new Date("2026-06-03T10:00:00.000Z"),
        },
      });

      // 1. Pagination: GET ?page=1&limit=2&merchantProfileId=...
      mockAdminSession();
      const pageReq = new NextRequest(
        `http://localhost:3000/api/v1/admin/withdrawals?page=1&limit=2&merchantProfileId=${pId}`
      );
      const pageRes = await getWithdrawals(pageReq);
      expect(pageRes.status).toBe(200);

      const pageJson = await pageRes.json();
      expect(pageJson.success).toBe(true);
      expect(pageJson.data.length).toBe(2);
      expect(pageJson.meta.total).toBe(3);
      expect(pageJson.meta.totalPages).toBe(2);
      expect(pageJson.meta.page).toBe(1);
      expect(pageJson.meta.limit).toBe(2);

      // Verify deterministic sorting: desc by createdAt (w3 created June 3, w2 created June 2)
      const firstTime = new Date(pageJson.data[0].createdAt).getTime();
      const secondTime = new Date(pageJson.data[1].createdAt).getTime();
      expect(firstTime).toBeGreaterThanOrEqual(secondTime);
      expect(pageJson.data[0].id).toBe(w3.id);
      expect(pageJson.data[1].id).toBe(w2.id);

      // 2. Status filtering: GET ?status=PENDING&merchantProfileId=...
      const filterReq = new NextRequest(
        `http://localhost:3000/api/v1/admin/withdrawals?status=PENDING&merchantProfileId=${pId}`
      );
      const filterRes = await getWithdrawals(filterReq);
      expect(filterRes.status).toBe(200);

      const filterJson = await filterRes.json();
      expect(filterJson.success).toBe(true);
      expect(filterJson.data.length).toBe(1);
      expect(filterJson.data[0].id).toBe(w1.id);
      expect(filterJson.data[0].status).toBe(WithdrawalStatus.PENDING);
      expect(filterJson.meta.total).toBe(1);

      // 3. Unauthenticated -> 401
      mockUnauthenticated();
      const unauthReq = new NextRequest(
        `http://localhost:3000/api/v1/admin/withdrawals?merchantProfileId=${pId}`
      );
      const unauthRes = await getWithdrawals(unauthReq);
      expect(unauthRes.status).toBe(401);

      // 4. Merchant role -> 403
      mockMerchantSession();
      const merchReq = new NextRequest(
        `http://localhost:3000/api/v1/admin/withdrawals?merchantProfileId=${pId}`
      );
      const merchRes = await getWithdrawals(merchReq);
      expect(merchRes.status).toBe(403);
    });
  });

  // ============================================================================
  // Scenario 2: Fund Requests Pagination & Filtering API
  // ============================================================================
  describe("2. Fund Requests Pagination & Filtering API", () => {
    it("returns paginated and status-filtered fund requests with metadata and auth gates", async () => {
      const uId = uniqueId("user-fr");
      const pId = uniqueId("prof-fr");

      await db.user.create({
        data: { id: uId, email: `${uId}@test.com`, name: "Fund Request Merchant", role: UserRole.MERCHANT },
      });
      await db.merchantProfile.create({
        data: { id: pId, userId: uId, businessName: "Fund Request Co", accountStatus: AccountStatus.ACTIVE },
      });

      // Seed fund requests with PENDING and APPROVED
      const frPending = await db.fundRequest.create({
        data: {
          merchantProfileId: pId,
          amount: new Prisma.Decimal(5000),
          status: FundRequestStatus.PENDING,
          utrNumber: uniqueId("UTR-PEND"),
          paymentMode: "UPI",
          createdAt: new Date("2026-07-01T10:00:00.000Z"),
        },
      });

      const frApproved = await db.fundRequest.create({
        data: {
          merchantProfileId: pId,
          amount: new Prisma.Decimal(10000),
          status: FundRequestStatus.APPROVED,
          utrNumber: uniqueId("UTR-APPR"),
          paymentMode: "UPI",
          createdAt: new Date("2026-07-02T10:00:00.000Z"),
        },
      });

      // Admin calls: GET ?page=1&limit=1&status=PENDING
      mockAdminSession();
      const req = new NextRequest(
        "http://localhost:3000/api/v1/admin/fund-requests?page=1&limit=1&status=PENDING"
      );
      const res = await getFundRequests(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
      expect(json.data[0].status).toBe(FundRequestStatus.PENDING);
      expect(json.data[0].id).toBe(frPending.id);
      expect(json.meta.page).toBe(1);
      expect(json.meta.limit).toBe(1);
      expect(json.meta.total).toBeGreaterThanOrEqual(1);
      expect(json.meta.totalPages).toBeGreaterThanOrEqual(1);

      // Verify unauthenticated returns 401
      mockUnauthenticated();
      const unauthRes = await getFundRequests(new NextRequest("http://localhost:3000/api/v1/admin/fund-requests"));
      expect(unauthRes.status).toBe(401);

      // Verify merchant returns 403
      mockMerchantSession();
      const merchRes = await getFundRequests(new NextRequest("http://localhost:3000/api/v1/admin/fund-requests"));
      expect(merchRes.status).toBe(403);
    });
  });

  // ============================================================================
  // Scenario 3: KYC Applications Response Structure
  // ============================================================================
  describe("3. KYC Applications Response Structure", () => {
    it("returns correct success, data array, and meta structure for admin KYC list", async () => {
      // Seed at least one KYC application to ensure populated data
      const uId = uniqueId("user-kyc-list");
      const pId = uniqueId("prof-kyc-list");

      await db.user.create({
        data: { id: uId, email: `${uId}@test.com`, name: "KYC List User", role: UserRole.MERCHANT },
      });

      await db.merchantProfile.create({
        data: {
          id: pId,
          userId: uId,
          merchantType: "INDIVIDUAL",
          accountStatus: AccountStatus.PENDING,
          kycApplication: {
            create: {
              cycles: {
                create: {
                  cycleNumber: 1,
                  isCurrentCycle: true,
                  status: KycStatus.UNDER_REVIEW,
                  formVersion: {
                    create: {
                      id: uniqueId("form-v"),
                      status: "PUBLISHED",
                      versionNumber: 1,
                      form: { create: { name: "KYC Form List Test" } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Admin calls GET /api/v1/admin/kyc/applications
      mockAdminSession();
      const req = new NextRequest("http://localhost:3000/api/v1/admin/kyc/applications?page=1&limit=10");
      const res = await getKycApplications(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);

      // Verify meta object properties
      expect(json.meta).toBeDefined();
      expect(typeof json.meta.total).toBe("number");
      expect(typeof json.meta.page).toBe("number");
      expect(typeof json.meta.limit).toBe("number");
      expect(typeof json.meta.totalPages).toBe("number");
      expect(json.meta.page).toBe(1);
      expect(json.meta.limit).toBe(10);
      expect(json.meta.total).toBeGreaterThanOrEqual(1);

      // Verify unauthenticated returns 401
      mockUnauthenticated();
      const unauthRes = await getKycApplications(
        new NextRequest("http://localhost:3000/api/v1/admin/kyc/applications")
      );
      expect(unauthRes.status).toBe(401);

      // Verify merchant returns 403
      mockMerchantSession();
      const merchRes = await getKycApplications(
        new NextRequest("http://localhost:3000/api/v1/admin/kyc/applications")
      );
      expect(merchRes.status).toBe(403);
    });
  });

  // ============================================================================
  // Scenario 4: Audit Logs Date Range & Action Filtering
  // ============================================================================
  describe("4. Audit Logs Date Range & Action Filtering", () => {
    it("filters audit logs strictly by date range and action with complete auth gates", async () => {
      const entityId = uniqueId("audit-target-entity");

      // Seed audit logs across multiple dates and actions
      await db.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorId: adminUserId,
          entityType: AuditEntity.USER,
          entityId,
          action: AuditAction.APPROVE,
          createdAt: new Date("2026-05-10T12:00:00.000Z"),
          metadata: { note: "May 10 approval" },
        },
      });

      await db.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorId: adminUserId,
          entityType: AuditEntity.USER,
          entityId,
          action: AuditAction.SUSPEND,
          createdAt: new Date("2026-05-15T12:00:00.000Z"),
          metadata: { note: "May 15 suspension" },
        },
      });

      await db.auditLog.create({
        data: {
          actorType: AuditActorType.ADMIN,
          actorId: adminUserId,
          entityType: AuditEntity.USER,
          entityId,
          action: AuditAction.PROCESS,
          createdAt: new Date("2026-05-20T12:00:00.000Z"),
          metadata: { note: "May 20 process" },
        },
      });

      mockAdminSession();

      // 1. Date range filter: 2026-05-12 to 2026-05-18 (should only match May 15 SUSPEND)
      const dateRangeReq = new NextRequest(
        `http://localhost:3000/api/v1/admin/audit-logs?entityId=${entityId}&startDate=2026-05-12T00:00:00.000Z&endDate=2026-05-18T00:00:00.000Z`
      );
      const dateRangeRes = await getAuditLogs(dateRangeReq);
      expect(dateRangeRes.status).toBe(200);

      const dateRangeJson = await dateRangeRes.json();
      expect(dateRangeJson.success).toBe(true);
      expect(dateRangeJson.data.length).toBe(1);
      expect(dateRangeJson.data[0].action).toBe(AuditAction.SUSPEND);
      expect(dateRangeJson.data[0].entityId).toBe(entityId);
      expect(dateRangeJson.meta.total).toBe(1);

      // 2. Action filter: ?action=APPROVE (should only match May 10 APPROVE)
      const actionReq = new NextRequest(
        `http://localhost:3000/api/v1/admin/audit-logs?entityId=${entityId}&action=APPROVE`
      );
      const actionRes = await getAuditLogs(actionReq);
      expect(actionRes.status).toBe(200);

      const actionJson = await actionRes.json();
      expect(actionJson.success).toBe(true);
      expect(actionJson.data.length).toBe(1);
      expect(actionJson.data[0].action).toBe(AuditAction.APPROVE);
      expect(actionJson.data[0].entityId).toBe(entityId);

      // 3. Unauthenticated -> 401
      mockUnauthenticated();
      const unauthRes = await getAuditLogs(
        new NextRequest(`http://localhost:3000/api/v1/admin/audit-logs?entityId=${entityId}`)
      );
      expect(unauthRes.status).toBe(401);

      // 4. Merchant -> 403
      mockMerchantSession();
      const merchRes = await getAuditLogs(
        new NextRequest(`http://localhost:3000/api/v1/admin/audit-logs?entityId=${entityId}`)
      );
      expect(merchRes.status).toBe(403);
    });
  });

  // ============================================================================
  // Scenario 5: KYC Document Download Audit Logging
  // ============================================================================
  describe("5. KYC Document Download Audit Logging", () => {
    it("downloads KYC document, returns 200 with content, and records DOCUMENT_DOWNLOAD audit log", async () => {
      const uId = uniqueId("user-kyc-doc");
      const pId = uniqueId("prof-kyc-doc");
      const fvId = uniqueId("form-kyc-doc");
      const fdId = uniqueId("field-kyc-doc");
      const docId = uniqueId("doc-kyc-doc");

      // Seed complete KYC application with form and field definition
      await db.user.create({
        data: { id: uId, email: `${uId}@test.com`, name: "KYC Doc User", role: UserRole.MERCHANT },
      });

      await db.merchantProfile.create({
        data: {
          id: pId,
          userId: uId,
          merchantType: "COMPANY",
          accountStatus: AccountStatus.PENDING,
          kycApplication: {
            create: {
              cycles: {
                create: {
                  cycleNumber: 1,
                  isCurrentCycle: true,
                  status: KycStatus.UNDER_REVIEW,
                  formVersion: {
                    create: {
                      id: fvId,
                      status: "PUBLISHED",
                      versionNumber: 1,
                      form: { create: { name: "KYC Download Audit Form" } },
                      fields: {
                        create: {
                          id: fdId,
                          key: "business_registration",
                          label: "Business Registration",
                          dataType: "FILE",
                          inputType: "FILE",
                          isRequired: true,
                          section: "LEGAL",
                          orderIndex: 1,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const application = await db.kycApplication.findUnique({
        where: { merchantProfileId: pId },
        include: { cycles: { where: { isCurrentCycle: true } } },
      });
      expect(application).toBeDefined();

      const cycle = application!.cycles[0];

      // Seed document with status UPLOADED
      await db.kycDocument.create({
        data: {
          id: docId,
          submissionCycleId: cycle.id,
          fieldDefinitionId: fdId,
          storageKey: `STORAGE_KEY_${docId}`,
          originalFilename: "business_registration.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2048,
          status: "UPLOADED",
        },
      });

      // Admin downloads document
      mockAdminSession();
      const downloadReq = new NextRequest(
        `http://localhost:3000/api/v1/admin/kyc/applications/${application!.id}/documents/${docId}/download`
      );
      const downloadRes = await downloadKycDocument(downloadReq, {
        params: Promise.resolve({ applicationId: application!.id, documentId: docId }),
      });

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.headers.get("Content-Type")).toBe("application/pdf");
      expect(downloadRes.headers.get("Content-Disposition")).toContain("business_registration.pdf");

      const fileBuffer = await downloadRes.arrayBuffer();
      const fileText = Buffer.from(fileBuffer).toString("utf-8");
      expect(fileText).toBe("mock-pdf-content-for-readiness");

      // Verify audit log entry was created
      const audit = await db.auditLog.findFirst({
        where: {
          entityType: AuditEntity.KYC_APPLICATION,
          entityId: application!.id,
          action: AuditAction.PROCESS,
        },
      });

      expect(audit).toBeDefined();
      expect(audit!.actorType).toBe(AuditActorType.ADMIN);
      expect(audit!.actorId).toBe(adminUserId);

      const metadata = audit!.metadata as Record<string, unknown>;
      expect(metadata).toBeDefined();
      expect(metadata.operation).toBe("DOCUMENT_DOWNLOAD");
      expect(metadata.documentId).toBe(docId);
      expect(metadata.filename).toBe("business_registration.pdf");
    });
  });

  // ============================================================================
  // Scenario 6: Merchant Suspension Session Eviction & Audit
  // ============================================================================
  describe("6. Merchant Suspension Session Eviction & Audit", () => {
    it("suspends active merchant, evicts all user sessions, and creates an audit log", async () => {
      const uId = uniqueId("user-suspend");
      const pId = uniqueId("prof-suspend");
      const sId1 = uniqueId("session-1");
      const sId2 = uniqueId("session-2");

      // Seed active merchant user and profile
      await db.user.create({
        data: { id: uId, email: `${uId}@test.com`, name: "Active Merchant", role: UserRole.MERCHANT },
      });

      await db.merchantProfile.create({
        data: {
          id: pId,
          userId: uId,
          businessName: "Suspension Target Corp",
          accountStatus: AccountStatus.ACTIVE,
        },
      });

      // Seed multiple active browser sessions for this user in db.session
      await db.session.create({
        data: {
          id: sId1,
          userId: uId,
          token: uniqueId("token-1"),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      await db.session.create({
        data: {
          id: sId2,
          userId: uId,
          token: uniqueId("token-2"),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      // Pre-condition: user has 2 active sessions
      const initialSessionCount = await db.session.count({ where: { userId: uId } });
      expect(initialSessionCount).toBe(2);

      // Admin calls: POST /api/v1/admin/merchants/[id]/suspend
      mockAdminSession();
      const suspendReq = new NextRequest(
        `http://localhost:3000/api/v1/admin/merchants/${pId}/suspend`,
        { method: "POST" }
      );
      const suspendRes = await suspendMerchant(suspendReq, {
        params: Promise.resolve({ id: pId }),
      });

      expect(suspendRes.status).toBe(200);
      const resJson = await suspendRes.json();
      expect(resJson.success).toBe(true);
      expect(resJson.data.accountStatus).toBe(AccountStatus.SUSPENDED);

      // Verify merchant profile is updated to SUSPENDED in DB
      const updatedProfile = await db.merchantProfile.findUnique({
        where: { id: pId },
        select: { accountStatus: true },
      });
      expect(updatedProfile?.accountStatus).toBe(AccountStatus.SUSPENDED);

      // Verify sessions revoked! (count === 0)
      const remainingSessions = await db.session.count({ where: { userId: uId } });
      expect(remainingSessions).toBe(0);

      // Verify audit log contains action: "SUSPEND"
      const audit = await db.auditLog.findFirst({
        where: {
          entityType: AuditEntity.MERCHANT_PROFILE,
          entityId: pId,
          action: AuditAction.SUSPEND,
        },
      });

      expect(audit).toBeDefined();
      expect(audit!.actorType).toBe(AuditActorType.ADMIN);
      expect(audit!.actorId).toBe(adminUserId);
      const auditMeta = audit!.metadata as Record<string, unknown>;
      expect(auditMeta.previousStatus).toBe(AccountStatus.ACTIVE);
    });
  });
});
