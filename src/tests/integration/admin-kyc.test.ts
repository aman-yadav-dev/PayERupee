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
import { getKycApplicationDetail } from "@/modules/admin/application/admin-kyc.service";

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
            cycles: {
              create: {
                cycleNumber: 1,
                isCurrentCycle: true,
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
    } } });

    const app = await db.kycApplication.findUnique({ where: { merchantProfileId: profileId },
        include: { cycles: { where: { isCurrentCycle: true }, take: 1 } }
    });
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
          submissionCycleId: app.cycles[0].id,
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

    it("returns enriched questionnaire answers with human-readable question labels", async () => {
      mockAdminSession();
      const app = await createKycApp(KycStatus.UNDER_REVIEW);

      const answerFieldId = "answer-field-" + app.merchantProfileId;
      await db.kycFieldDefinition.create({
        data: {
          id: answerFieldId,
          formVersionId: app.cycles[0].formVersionId!,
          key: "business_registration_number",
          label: "Business Registration Number",
          description: "Enter your official company registration number",
          dataType: "STRING",
          inputType: "TEXT",
          isRequired: true,
          section: "IDENTITY",
          orderIndex: 2
        }
      });

      await db.kycAnswer.create({
        data: {
          submissionCycleId: app.cycles[0].id,
          fieldDefinitionId: answerFieldId,
          value: "REG-99887766"
        }
      });

      const req = new NextRequest("http://localhost/api/v1/admin/kyc/applications/" + app.id);
      const res = await getDetail(req, { params: Promise.resolve({ applicationId: app.id }) as any });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.answers).toBeDefined();
      expect(json.data.answers.length).toBe(1);

      const ans = json.data.answers[0];
      expect(ans.fieldDefinitionId).toBe(answerFieldId);
      expect(ans.fieldLabel).toBe("Business Registration Number");
      expect(ans.fieldKey).toBe("business_registration_number");
      expect(ans.section).toBe("IDENTITY");
      expect(ans.dataType).toBe("STRING");
      expect(ans.value).toBe("REG-99887766");
      expect(ans.isUnmapped).toBe(false);
    });

    it("maps known field IDs (company_name, pan_number, aadhaar_number) directly to human-readable labels", async () => {
      mockAdminSession();
      const app = await createKycApp(KycStatus.UNDER_REVIEW);
      const formVersionId = app.cycles[0].formVersionId!;

      const knownFields = [
        { id: "company_name_" + app.merchantProfileId, key: "company_name", label: "Company Name", orderIndex: 1, value: "PayERupee Ltd" },
        { id: "pan_number_" + app.merchantProfileId, key: "pan_number", label: "PAN Number", orderIndex: 2, value: "ABCDE1234F" },
        { id: "aadhaar_number_" + app.merchantProfileId, key: "aadhaar_number", label: "Aadhaar Number", orderIndex: 3, value: "999988887777" },
        { id: "gst_key_only_" + app.merchantProfileId, key: "gst_number", label: "", orderIndex: 4, value: "22AAAAA0000A1Z5" },
      ];

      for (const f of knownFields) {
        await db.kycFieldDefinition.create({
          data: {
            id: f.id,
            formVersionId,
            key: f.key,
            label: f.label,
            dataType: "STRING",
            inputType: "TEXT",
            isRequired: true,
            section: "IDENTITY",
            orderIndex: f.orderIndex,
          }
        });

        await db.kycAnswer.create({
          data: {
            submissionCycleId: app.cycles[0].id,
            fieldDefinitionId: f.id,
            value: f.value,
          }
        });
      }

      const req = new NextRequest("http://localhost/api/v1/admin/kyc/applications/" + app.id);
      const res = await getDetail(req, { params: Promise.resolve({ applicationId: app.id }) as any });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.answers).toBeDefined();

      const companyAns = json.data.answers.find((a: any) => a.fieldDefinitionId === "company_name_" + app.merchantProfileId);
      expect(companyAns).toBeDefined();
      expect(companyAns.fieldLabel).toBe("Company Name");
      expect(companyAns.isUnmapped).toBe(false);

      const panAns = json.data.answers.find((a: any) => a.fieldDefinitionId === "pan_number_" + app.merchantProfileId);
      expect(panAns).toBeDefined();
      expect(panAns.fieldLabel).toBe("PAN Number");
      expect(panAns.isUnmapped).toBe(false);

      const aadhaarAns = json.data.answers.find((a: any) => a.fieldDefinitionId === "aadhaar_number_" + app.merchantProfileId);
      expect(aadhaarAns).toBeDefined();
      expect(aadhaarAns.fieldLabel).toBe("Aadhaar Number");
      expect(aadhaarAns.isUnmapped).toBe(false);

      // Humanized key fallback when label is empty
      const gstKeyOnlyAns = json.data.answers.find((a: any) => a.fieldDefinitionId === "gst_key_only_" + app.merchantProfileId);
      expect(gstKeyOnlyAns).toBeDefined();
      expect(gstKeyOnlyAns.fieldLabel).toBe("GST Number");
      expect(gstKeyOnlyAns.isUnmapped).toBe(false);
    });

    it("resolves historical field definitions not in the current form version via kycFieldDefinition lookup", async () => {
      mockAdminSession();
      const app = await createKycApp(KycStatus.UNDER_REVIEW);

      // Create a separate historical form version with a historical field
      const histForm = await db.kycForm.create({
        data: { name: "Historical Form " + Math.random().toString(36).substring(7) }
      });
      const histVersion = await db.kycFormVersion.create({
        data: {
          formId: histForm.id,
          versionNumber: 88,
          status: "DEPRECATED"
        }
      });

      const histFieldId = "hist-field-" + Math.random().toString(36).substring(7);
      await db.kycFieldDefinition.create({
        data: {
          id: histFieldId,
          formVersionId: histVersion.id, // Different from app's cycle formVersionId
          key: "historical_tax_id",
          label: "Historical Tax ID",
          dataType: "STRING",
          inputType: "TEXT",
          isRequired: false,
          section: "TAX_DETAILS",
          orderIndex: 8
        }
      });

      await db.kycAnswer.create({
        data: {
          submissionCycleId: app.cycles[0].id,
          fieldDefinitionId: histFieldId,
          value: "TAX-LEGACY-4455"
        }
      });

      const req = new NextRequest("http://localhost/api/v1/admin/kyc/applications/" + app.id);
      const res = await getDetail(req, { params: Promise.resolve({ applicationId: app.id }) as any });
      expect(res.status).toBe(200);

      const json = await res.json();
      const histAns = json.data.answers.find((a: any) => a.fieldDefinitionId === histFieldId);
      expect(histAns).toBeDefined();
      expect(histAns.fieldLabel).toBe("Historical Tax ID");
      expect(histAns.fieldKey).toBe("historical_tax_id");
      expect(histAns.section).toBe("TAX DETAILS");
      expect(histAns.isUnmapped).toBe(false);
      expect(histAns.value).toBe("TAX-LEGACY-4455");
    });

    it("cleanly assigns fieldLabel 'Unmapped field' and isUnmapped: true for orphan/unknown field IDs without throwing or crashing", async () => {
      mockAdminSession();
      const app = await createKycApp(KycStatus.UNDER_REVIEW);

      const orphanFieldId = "orphan-field-" + Math.random().toString(36).substring(7);
      const answerId = "orphan-ans-" + Math.random().toString(36).substring(7);

      // Drop FK constraint if present to permit inserting orphan answer row in integration test
      await db.$executeRawUnsafe(`ALTER TABLE "kyc_answers" DROP CONSTRAINT IF EXISTS "kyc_answers_fieldDefinitionId_fkey";`);

      try {
        await db.$executeRawUnsafe(
          `INSERT INTO "kyc_answers" ("id", "submissionCycleId", "fieldDefinitionId", "value", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())`,
          answerId,
          app.cycles[0].id,
          orphanFieldId,
          JSON.stringify("Orphan KYC Value")
        );

        // Test API detail route
        const req = new NextRequest("http://localhost/api/v1/admin/kyc/applications/" + app.id);
        const res = await getDetail(req, { params: Promise.resolve({ applicationId: app.id }) as any });
        expect(res.status).toBe(200);

        const json = await res.json();
        const orphanAns = json.data.answers.find((a: any) => a.fieldDefinitionId === orphanFieldId);
        expect(orphanAns).toBeDefined();
        expect(orphanAns.fieldLabel).toBe("Unmapped field");
        expect(orphanAns.isUnmapped).toBe(true);
        expect(orphanAns.fieldDefinitionId).toBe(orphanFieldId);
        expect(orphanAns.value).toBe("Orphan KYC Value");

        // Test direct service function
        const detailFromService = await getKycApplicationDetail(app.id);
        const orphanFromService = detailFromService.answers.find((a) => a.fieldDefinitionId === orphanFieldId);
        expect(orphanFromService).toBeDefined();
        expect(orphanFromService!.fieldLabel).toBe("Unmapped field");
        expect(orphanFromService!.isUnmapped).toBe(true);
      } finally {
        await db.$executeRawUnsafe(`DELETE FROM "kyc_answers" WHERE "id" = $1;`, answerId).catch(() => {});
        await db.$executeRawUnsafe(
          `ALTER TABLE "kyc_answers" ADD CONSTRAINT "kyc_answers_fieldDefinitionId_fkey"
           FOREIGN KEY ("fieldDefinitionId") REFERENCES "kyc_field_definitions"("id")
           ON DELETE RESTRICT ON UPDATE CASCADE;`
        ).catch(() => {});
      }
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
          submissionCycleId: app.cycles[0].id,
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
          submissionCycleId: app1.cycles[0].id, // belongs to app1
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
          submissionCycleId: app.cycles[0].id,
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

      const updated = await db.kycApplication.findUnique({ where: { id: app.id },
          include: { cycles: { where: { isCurrentCycle: true }, take: 1 } }
    });
      expect(updated!.cycles[0].status).toBe("APPROVED");
      expect(updated!.cycles[0].reviewerId).toBe(adminUserId);
      expect(updated!.cycles[0].reviewedAt).not.toBeNull();

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

      const updated = await db.kycApplication.findUnique({ where: { id: app.id },
          include: { cycles: { where: { isCurrentCycle: true }, take: 1 } }
    });
      expect(updated!.cycles[0].status).toBe("REJECTED");
      expect(updated!.cycles[0].rejectionReason).toBe("Blurry document");
      expect(updated!.cycles[0].allowResubmission).toBe(true);
      expect(updated!.cycles[0].reviewerId).toBe(adminUserId);

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
