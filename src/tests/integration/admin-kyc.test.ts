import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { NextRequest } from "next/server";
import { KycStatus, AccountStatus, UserRole } from "@prisma/client";

// Import API routes
import { GET as getList } from "@/app/api/v1/admin/kyc/applications/route";
import { GET as getDetail } from "@/app/api/v1/admin/kyc/applications/[applicationId]/route";
import { POST as approveApp } from "@/app/api/v1/admin/kyc/applications/[applicationId]/approve/route";
import { POST as rejectApp } from "@/app/api/v1/admin/kyc/applications/[applicationId]/reject/route";
import { GET as downloadDoc } from "@/app/api/v1/admin/kyc/applications/[applicationId]/documents/[documentId]/download/route";

vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    }
  }
}));
import { auth } from "@/modules/auth/infrastructure/auth";

vi.mock("@/infrastructure/storage/local-disk.adapter", () => {
  return {
    LocalDiskStorageAdapter: class {
      put = vi.fn().mockResolvedValue(undefined);
      get = vi.fn().mockResolvedValue(Buffer.from("mock-pdf-content"));
      delete = vi.fn().mockResolvedValue(undefined);
    }
  };
});

describe("Admin KYC Workflow (Phase C5)", () => {
  const adminUserId = "admin-kyc-c5";
  const merchantUserId = "merchant-kyc-c5";

  beforeEach(async () => {
    // Seed users
    await db.user.upsert({
      where: { id: adminUserId },
      update: { role: "ADMIN" },
      create: { id: adminUserId, email: "adminc5@test.com", name: "Admin", role: "ADMIN" }
    });
    await db.user.upsert({
      where: { id: merchantUserId },
      update: { role: "MERCHANT" },
      create: { id: merchantUserId, email: "merchc5@test.com", name: "Merch", role: "MERCHANT" }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function mockAdminSession() {
    (auth.api.getSession as any).mockResolvedValue({
      user: { id: adminUserId },
      session: { id: "session-123" }
    });
  }

  function mockMerchantSession() {
    (auth.api.getSession as any).mockResolvedValue({
      user: { id: merchantUserId },
      session: { id: "session-456" }
    });
  }

  function mockUnauthenticated() {
    (auth.api.getSession as any).mockResolvedValue(null);
  }

  async function createKycApp(status: KycStatus = KycStatus.UNDER_REVIEW) {
    const profileId = "profile-" + Math.random().toString(36).substring(7);
    const newUserId = "user-" + Math.random().toString(36).substring(7);
    
    await db.user.create({
      data: { id: newUserId, email: newUserId + "@test.com", name: "Merch", role: "MERCHANT" }
    });

    await db.merchantProfile.create({
      data: {
        id: profileId,
        userId: newUserId,
        merchantType: "COMPANY",
        accountStatus: "PENDING",
        kycApplication: {
          create: {
            status,
            formVersion: {
            create: {
              id: "form-" + profileId,
              status: "PUBLISHED",
                versionNumber: 1,
                form: { create: { name: "Test Form" } },
                fields: {
                create: {
                  id: "field-" + profileId,
                  key: "test_doc",
                  label: "Test Doc",
                  dataType: "FILE",
                  inputType: "FILE",
                  isRequired: true,
                  section: "BUSINESS",
                  orderIndex: 1
                }
              }
            }
          }
          }
        }
      }
    });

    const app = await db.kycApplication.findUnique({ where: { merchantProfileId: profileId } });
    return app!;
  }

  describe("AUTH / Security", () => {
    it("returns 401 unauthenticated", async () => {
      mockUnauthenticated();
      const req = new NextRequest("http://localhost/api/v1/admin/kyc/applications");
      const res = await getList(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 for merchant", async () => {
      mockMerchantSession();
      const req = new NextRequest("http://localhost/api/v1/admin/kyc/applications");
      const res = await getList(req);
      expect(res.status).toBe(403);
    });

    it("returns 200 for admin", async () => {
      mockAdminSession();
      const req = new NextRequest("http://localhost/api/v1/admin/kyc/applications");
      const res = await getList(req);
      expect(res.status).toBe(200);
    });
  });

  describe("LIST /api/v1/admin/kyc/applications", () => {
    it("paginates and filters correctly", async () => {
      mockAdminSession();
      // create some apps
      await createKycApp(KycStatus.PENDING_SUBMISSION);
      await createKycApp(KycStatus.UNDER_REVIEW);

      const req = new NextRequest("http://localhost/api/v1/admin/kyc/applications?status=UNDER_REVIEW&limit=1");
      const res = await getList(req);
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.data.length).toBe(1);
      expect(data.data[0].status).toBe("UNDER_REVIEW");
      expect(data.data[0].merchantProfileId).toBeDefined();
      expect(data.meta.limit).toBe(1);
    });

    it("rejects invalid status filter", async () => {
      mockAdminSession();
      const req = new NextRequest("http://localhost/api/v1/admin/kyc/applications?status=INVALID_STATUS");
      const res = await getList(req);
      expect(res.status).toBe(400);
    });
  });

  describe("DETAIL /api/v1/admin/kyc/applications/[id]", () => {
    it("returns correctly shaped detail without storageKey", async () => {
      mockAdminSession();
      const app = await createKycApp(KycStatus.UNDER_REVIEW);
      
      // add a document
      await db.kycDocument.create({
        data: {
          id: "doc-1",
          applicationId: app.id,
          fieldDefinitionId: "field-" + app.merchantProfileId,
          storageKey: "SECRET_KEY_123",
          originalFilename: "test.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          status: "UPLOADED"
        }
      });

      const req = new NextRequest("http://localhost/api/v1/admin/kyc/applications/" + app.id);
      const res = await getDetail(req, { params: Promise.resolve({ applicationId: app.id }) as any });
      expect(res.status).toBe(200);
      
      const json = await res.json();
      expect(json.data.id).toBe(app.id);
      expect(json.data.merchantProfile.merchantType).toBe("COMPANY");
      expect(json.data.documents.length).toBe(1);
      expect(json.data.documents[0].originalFilename).toBe("test.pdf");
      expect(json.data.documents[0].storageKey).toBeUndefined(); // ensure stripped
    });

    it("404 for missing application", async () => {
      mockAdminSession();
      const req = new NextRequest("http://localhost/api/v1/admin/kyc/applications/non-existent");
      const res = await getDetail(req, { params: Promise.resolve({ applicationId: "non-existent" }) as any });
      expect(res.status).toBe(404);
    });
  });

  describe("DOCUMENT /api/v1/admin/kyc/applications/[id]/documents/[docId]/download", () => {
    it("downloads successfully if criteria met", async () => {
      mockAdminSession();
      const app = await createKycApp();
      await db.kycDocument.create({
        data: {
          id: "doc-2",
          applicationId: app.id,
          fieldDefinitionId: "field-" + app.merchantProfileId,
          storageKey: "SECRET_KEY_" + Math.random(),
          originalFilename: "real.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          status: "UPLOADED"
        }
      });

      const req = new NextRequest(`http://localhost/api/v1/admin/kyc/applications/${app.id}/documents/doc-2/download`);
      const res = await downloadDoc(req, { params: Promise.resolve({ applicationId: app.id, documentId: "doc-2" }) as any });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Content-Disposition")).toContain("real.pdf");
    });

    it("404 for application mismatch", async () => {
      mockAdminSession();
      const app1 = await createKycApp();
      const app2 = await createKycApp();
      await db.kycDocument.create({
        data: {
          id: "doc-3",
          applicationId: app1.id, // belongs to app1
          fieldDefinitionId: "field-" + app1.merchantProfileId,
          storageKey: "SECRET_KEY_" + Math.random(),
          originalFilename: "real.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          status: "UPLOADED"
        }
      });

      const req = new NextRequest(`http://localhost/api/v1/admin/kyc/applications/${app2.id}/documents/doc-3/download`);
      const res = await downloadDoc(req, { params: Promise.resolve({ applicationId: app2.id, documentId: "doc-3" }) as any });
      expect(res.status).toBe(404); // must fail because doc-3 does not belong to app2
    });
    
    it("400 for PENDING document", async () => {
      mockAdminSession();
      const app = await createKycApp();
      await db.kycDocument.create({
        data: {
          id: "doc-4",
          applicationId: app.id,
          fieldDefinitionId: "field-" + app.merchantProfileId,
          storageKey: "SECRET_KEY_" + Math.random(),
          originalFilename: "real.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          status: "PENDING"
        }
      });

      const req = new NextRequest(`http://localhost/api/v1/admin/kyc/applications/${app.id}/documents/doc-4/download`);
      const res = await downloadDoc(req, { params: Promise.resolve({ applicationId: app.id, documentId: "doc-4" }) as any });
      expect(res.status).toBe(400); 
    });
  });

  describe("APPROVE /api/v1/admin/kyc/applications/[id]/approve", () => {
    it("approves UNDER_REVIEW application", async () => {
      mockAdminSession();
      const app = await createKycApp(KycStatus.UNDER_REVIEW);

      const req = new NextRequest(`http://localhost/api/v1/admin/kyc/applications/${app.id}/approve`, { method: "POST" });
      const res = await approveApp(req, { params: Promise.resolve({ applicationId: app.id }) as any });
      expect(res.status).toBe(200);

      const updated = await db.kycApplication.findUnique({ where: { id: app.id } });
      expect(updated!.status).toBe("APPROVED");
      expect(updated!.reviewerId).toBe(adminUserId);
      expect(updated!.reviewedAt).not.toBeNull();

      const profile = await db.merchantProfile.findUnique({ where: { id: updated!.merchantProfileId } });
      expect(profile!.accountStatus).toBe("PENDING"); // MUST NOT BE MODIFIED

      // Check audit log
      const audit = await db.auditLog.findFirst({ where: { entityId: app.id, action: "APPROVE" } });
      expect(audit).toBeDefined();
      expect(audit!.actorId).toBe(adminUserId);
    });

    it("409 for invalid state (PENDING_SUBMISSION)", async () => {
      mockAdminSession();
      const app = await createKycApp(KycStatus.PENDING_SUBMISSION);

      const req = new NextRequest(`http://localhost/api/v1/admin/kyc/applications/${app.id}/approve`, { method: "POST" });
      const res = await approveApp(req, { params: Promise.resolve({ applicationId: app.id }) as any });
      expect(res.status).toBe(409);
      
      const audits = await db.auditLog.count({ where: { entityId: app.id, action: "APPROVE" } });
      expect(audits).toBe(0);
    });
  });

  describe("REJECT /api/v1/admin/kyc/applications/[id]/reject", () => {
    it("rejects UNDER_REVIEW application with proper metadata", async () => {
      mockAdminSession();
      const app = await createKycApp(KycStatus.UNDER_REVIEW);

      const req = new NextRequest(`http://localhost/api/v1/admin/kyc/applications/${app.id}/reject`, {
        method: "POST",
        body: JSON.stringify({
          rejectionReason: "Blurry document",
          allowResubmission: true
        })
      });
      const res = await rejectApp(req, { params: Promise.resolve({ applicationId: app.id }) as any });
      expect(res.status).toBe(200);

      const updated = await db.kycApplication.findUnique({ where: { id: app.id } });
      expect(updated!.status).toBe("REJECTED");
      expect(updated!.rejectionReason).toBe("Blurry document");
      expect(updated!.allowResubmission).toBe(true);
      expect(updated!.reviewerId).toBe(adminUserId);

      // Check audit log
      const audit = await db.auditLog.findFirst({ where: { entityId: app.id, action: "REJECT" } });
      expect(audit).toBeDefined();
    });

    it("400 for missing reason", async () => {
      mockAdminSession();
      const app = await createKycApp(KycStatus.UNDER_REVIEW);

      const req = new NextRequest(`http://localhost/api/v1/admin/kyc/applications/${app.id}/reject`, {
        method: "POST",
        body: JSON.stringify({
          rejectionReason: "   ",
          allowResubmission: true
        })
      });
      const res = await rejectApp(req, { params: Promise.resolve({ applicationId: app.id }) as any });
      expect(res.status).toBe(400);
    });
  });

  describe("CONCURRENCY", () => {
    it("serializes Approve vs Approve safely", async () => {
      mockAdminSession();
      const app = await createKycApp(KycStatus.UNDER_REVIEW);

      const req1 = new NextRequest(`http://localhost/api/v1/admin/kyc/applications/${app.id}/approve`, { method: "POST" });
      const req2 = new NextRequest(`http://localhost/api/v1/admin/kyc/applications/${app.id}/approve`, { method: "POST" });

      const [res1, res2] = await Promise.all([
        approveApp(req1, { params: Promise.resolve({ applicationId: app.id }) as any }),
        approveApp(req2, { params: Promise.resolve({ applicationId: app.id }) as any })
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]); // One succeeds, one fails

      const audits = await db.auditLog.count({ where: { entityId: app.id, action: "APPROVE" } });
      expect(audits).toBe(1); // Exactly one audit event
    });

    it("serializes Approve vs Reject safely", async () => {
      mockAdminSession();
      const app = await createKycApp(KycStatus.UNDER_REVIEW);

      const req1 = new NextRequest(`http://localhost/api/v1/admin/kyc/applications/${app.id}/approve`, { method: "POST" });
      const req2 = new NextRequest(`http://localhost/api/v1/admin/kyc/applications/${app.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ rejectionReason: "Bad", allowResubmission: true })
      });

      const [res1, res2] = await Promise.all([
        approveApp(req1, { params: Promise.resolve({ applicationId: app.id }) as any }),
        rejectApp(req2, { params: Promise.resolve({ applicationId: app.id }) as any })
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]); // Exactly one succeeds

      const audits = await db.auditLog.count({ where: { entityId: app.id } });
      expect(audits).toBe(1); // Only one audit event
    });
  });
});
