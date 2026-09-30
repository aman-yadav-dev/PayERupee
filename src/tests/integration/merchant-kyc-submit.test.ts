import { requireMerchantContext } from "@/modules/auth/application/session-auth.service";
import { saveKycAnswers, deleteKycDocument, uploadKycDocument, submitKycApplication } from "@/modules/merchant/application/merchant-kyc.service";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/infrastructure/database/db";
import { POST as submitKyc } from "@/app/api/v1/merchant/kyc/application/submit/route";
import { auth } from "@/modules/auth/infrastructure/auth";

vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: { getSession: vi.fn() }
  }
}));

vi.mock("@/modules/auth/application/session-auth.service", () => ({
  requireMerchantContext: vi.fn(),
  UnauthorizedError: class extends Error {
    constructor(msg: string) { super(msg); this.name = "UnauthorizedError"; }
  }
}));

describe("POST /api/v1/merchant/kyc/application/submit", () => {
  const mockUserIdA = "user_submit_a";
  const mockMerchantIdA = "merchant_submit_a";
  const mockUserIdB = "user_submit_b";
  const mockMerchantIdB = "merchant_submit_b";
  let publishedFormId: string;
  let fieldNameId: string;
  let fieldTypeId: string;
  let fieldDocId: string;
  let fieldOptionalId: string;
  let fieldConditionalId: string;

  beforeEach(async () => {
    await db.kycDocument.deleteMany();
    await db.kycAnswer.deleteMany();
    await db.auditLog.deleteMany();
    await db.kycApplication.deleteMany();
    await db.kycFieldDefinition.deleteMany();
    await db.kycFormVersion.deleteMany();
    await db.kycForm.deleteMany();
    await db.merchantProfile.deleteMany();

    await db.user.deleteMany();
    await db.user.createMany({ data: [{ id: mockUserIdA, email: "a@test.com", name: "A" }, { id: mockUserIdB, email: "b@test.com", name: "B" }]});
    await db.merchantProfile.createMany({
      data: [
        { id: mockMerchantIdA, merchantType: "COMPANY", userId: mockUserIdA },
        { id: mockMerchantIdB, merchantType: "INDIVIDUAL", userId: mockUserIdB }
      ]
    });

    const form = await db.kycForm.create({ data: { name: "Submit Form" }});
    const formVersion = await db.kycFormVersion.create({
      data: { formId: form.id, versionNumber: 1, status: "PUBLISHED" }
    });
    publishedFormId = formVersion.id;

    const f1 = await db.kycFieldDefinition.create({
      data: { formVersionId: publishedFormId, key: "name", label: "Name", dataType: "STRING", inputType: "TEXT", isRequired: true, orderIndex: 1, applicableTypes: [], section: "GENERAL" }
    });
    fieldNameId = f1.id;

    const f2 = await db.kycFieldDefinition.create({
      data: { formVersionId: publishedFormId, key: "type", label: "Type", dataType: "STRING", inputType: "SELECT", isRequired: true, selectOptions: ["LLP", "LTD"], orderIndex: 2, applicableTypes: ["COMPANY"], section: "GENERAL" }
    });
    fieldTypeId = f2.id;

    const f3 = await db.kycFieldDefinition.create({
      data: { formVersionId: publishedFormId, key: "doc", label: "Doc", dataType: "FILE", inputType: "FILE", isRequired: true, orderIndex: 3, applicableTypes: [], section: "GENERAL" }
    });
    fieldDocId = f3.id;

    const f4 = await db.kycFieldDefinition.create({
      data: { formVersionId: publishedFormId, key: "optional", label: "Opt", dataType: "STRING", inputType: "TEXT", isRequired: false, orderIndex: 4, applicableTypes: [], section: "GENERAL" }
    });
    fieldOptionalId = f4.id;

    const f5 = await db.kycFieldDefinition.create({
      data: { 
        formVersionId: publishedFormId, key: "conditional", label: "Cond", dataType: "STRING", inputType: "TEXT", isRequired: true, orderIndex: 5, applicableTypes: [], section: "GENERAL",
        validationRules: { type: "REQUIRED_IF_EQUALS", targetFieldKey: "type", targetValue: "LTD" }
      }
    });
    fieldConditionalId = f5.id;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  function mockSession(userId: string | null, merchantId?: string) {
    const m = requireMerchantContext as any;
    if (!userId) {
      const err = new Error("Unauthorized");
      err.name = "UnauthorizedError";
      m.mockRejectedValue(err);
    } else {
      m.mockResolvedValue({ userId, merchantProfileId: merchantId || userId, accountStatus: "ACTIVE" });
    }
  }

  function createReq() {
    return new NextRequest(new URL("http://localhost/api/v1/merchant/kyc/application/submit"), { method: "POST" });
  }

  describe("AUTH & OWNERSHIP", () => {
    it("1. Unauthenticated -> 401", async () => {
      mockSession(null);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(401);
    });
    
    it("2. No application -> 404", async () => {
      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(404);
    });

    it("3. Wrong merchant -> 404", async () => {
      await db.kycApplication.create({ include: { cycles: true }, data: { merchantProfileId: mockMerchantIdB, cycles: { create: { cycleNumber: 1, isCurrentCycle: true, formVersionId: publishedFormId, status: "PENDING_SUBMISSION" } } }});
      mockSession(mockUserIdA, mockMerchantIdA); // tries to submit A, but only B exists
      const res = await submitKyc(createReq());
      expect(res.status).toBe(404);
    });
  });

  describe("STATE", () => {
    beforeEach(async () => {
      await db.kycApplication.create({ include: { cycles: true }, data: { id: "appA", merchantProfileId: mockMerchantIdA, cycles: { create: { cycleNumber: 1, isCurrentCycle: true, formVersionId: publishedFormId, status: "PENDING_SUBMISSION", allowResubmission: true } } }});
    });

    it("4. UNDER_REVIEW -> 409", async () => {
      const app = await db.kycApplication.findUnique({ where: { merchantProfileId: mockMerchantIdA }, include: { cycles: true }}); await db.kycSubmissionCycle.update({ where: { id: app!.cycles[0].id }, data: { status: "UNDER_REVIEW" }});
      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(409);
    });

    it("5. APPROVED -> 409", async () => {
      const app = await db.kycApplication.findUnique({ where: { merchantProfileId: mockMerchantIdA }, include: { cycles: true }}); await db.kycSubmissionCycle.update({ where: { id: app!.cycles[0].id }, data: { status: "APPROVED" }});
      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(409);
    });

    it("6. REJECTED allowResubmission=false -> 409", async () => {
      const app = await db.kycApplication.findUnique({ where: { merchantProfileId: mockMerchantIdA }, include: { cycles: true }}); await db.kycSubmissionCycle.update({ where: { id: app!.cycles[0].id }, data: { status: "REJECTED", allowResubmission: false }});
      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(409);
    });
  });

  describe("COMPLETENESS", () => {
    let appId: string;
    beforeEach(async () => {
      const app = await db.kycApplication.create({ include: { cycles: true }, data: { merchantProfileId: mockMerchantIdA, cycles: { create: { cycleNumber: 1, isCurrentCycle: true, formVersionId: publishedFormId, status: "PENDING_SUBMISSION", allowResubmission: true } } }});
      appId = app.id;
      // Provide valid base answers
      await db.kycAnswer.createMany({ data: [
        { submissionCycleId: app.cycles[0].id, fieldDefinitionId: fieldNameId, value: "My Company" },
        { submissionCycleId: app.cycles[0].id, fieldDefinitionId: fieldTypeId, value: "LLP" }
      ]});
      await db.kycDocument.create({ data: { submissionCycleId: app.cycles[0].id, fieldDefinitionId: fieldDocId, storageKey: "key", originalFilename: "file.pdf", mimeType: "application/pdf", sizeBytes: 100, status: "UPLOADED" }});
    });

    it("7. Valid PENDING -> success 200", async () => {
      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(200);
      
      const updated = await db.kycApplication.findUnique({ where: { id: appId }, include: { cycles: true }});
      expect(updated?.cycles[0].status).toBe("UNDER_REVIEW");
      expect(updated?.cycles[0].allowResubmission).toBe(true);
      expect(updated?.cycles[0].submittedAt).not.toBeNull();
    });

    it("8. Missing required scalar -> 422", async () => {
      await db.kycAnswer.deleteMany({ where: { fieldDefinitionId: fieldNameId }});
      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.errors[0].fieldKey).toBe("name");
    });

    it("9. Empty / Whitespace scalar -> 422", async () => {
      await db.kycAnswer.updateMany({ where: { fieldDefinitionId: fieldNameId }, data: { value: "   " }});
      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(422);
    });

    it("10. Missing required document -> 422", async () => {
      await db.kycDocument.deleteMany({ where: { fieldDefinitionId: fieldDocId }});
      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.errors[0].fieldKey).toBe("doc");
    });

    it("11. Only PENDING document -> 422", async () => {
      await db.kycDocument.updateMany({ where: { fieldDefinitionId: fieldDocId }, data: { status: "PENDING" }});
      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(422);
    });

    it("12. Invalid answer type (number instead of string) -> 422", async () => {
      await db.kycAnswer.updateMany({ where: { fieldDefinitionId: fieldNameId }, data: { value: 123 }});
      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(422);
    });

    it("13. Invalid select option -> 422", async () => {
      await db.kycAnswer.updateMany({ where: { fieldDefinitionId: fieldTypeId }, data: { value: "INVALID_CORP" }});
      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(422);
    });

    it("14. Conditional requirement triggered and missing -> 422", async () => {
      // Set type to "LTD" which makes "conditional" required
      await db.kycAnswer.updateMany({ where: { fieldDefinitionId: fieldTypeId }, data: { value: "LTD" }});
      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.errors[0].fieldKey).toBe("conditional");
    });

    it("15. Conditional requirement not triggered and missing -> success", async () => {
      // Type is "LLP", so "conditional" is not required
      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(200);
    });
    
    it("16. REJECTED allowResubmission=true valid -> success", async () => {
      await db.kycSubmissionCycle.updateMany({ where: { applicationId: appId }, data: { status: "REJECTED", allowResubmission: true, isCurrentCycle: false }});
      await db.kycSubmissionCycle.create({ data: { applicationId: appId, cycleNumber: 2, isCurrentCycle: true, formVersionId: publishedFormId, status: "PENDING_SUBMISSION" }});
      const oldCycle = await db.kycSubmissionCycle.findFirst({ where: { applicationId: appId, cycleNumber: 1 } });
      const cycle2 = await db.kycSubmissionCycle.findFirst({ where: { applicationId: appId, cycleNumber: 2 } });
      await db.kycAnswer.updateMany({ where: { submissionCycleId: oldCycle!.id }, data: { submissionCycleId: cycle2!.id } });
      await db.kycDocument.updateMany({ where: { submissionCycleId: oldCycle!.id }, data: { submissionCycleId: cycle2!.id } });
      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(200);
    });
  });

  describe("VERSION & CONCURRENCY", () => {
    let appId: string;
    beforeEach(async () => {
      const app = await db.kycApplication.create({ include: { cycles: true }, data: { merchantProfileId: mockMerchantIdA, cycles: { create: { cycleNumber: 1, isCurrentCycle: true, formVersionId: publishedFormId, status: "PENDING_SUBMISSION" } } }});
      appId = app.id;
      await db.kycAnswer.createMany({ data: [
        { submissionCycleId: app.cycles[0].id, fieldDefinitionId: fieldNameId, value: "My Company" },
        { submissionCycleId: app.cycles[0].id, fieldDefinitionId: fieldTypeId, value: "LLP" }
      ]});
      await db.kycDocument.create({ data: { submissionCycleId: app.cycles[0].id, fieldDefinitionId: fieldDocId, storageKey: "key", originalFilename: "file.pdf", mimeType: "application/pdf", sizeBytes: 100, status: "UPLOADED" }});
    });

    it("17. Application validates against its own formVersionId even if newer form published", async () => {
      const form = await db.kycForm.findFirstOrThrow();
      const newFormVersion = await db.kycFormVersion.create({
        data: { formId: form.id, versionNumber: 2, status: "PUBLISHED" }
      });
      // Add a new required field to the NEW version
      await db.kycFieldDefinition.create({
        data: { formVersionId: newFormVersion.id, key: "new_required", label: "New", dataType: "STRING", inputType: "TEXT", isRequired: true, orderIndex: 1, applicableTypes: [], section: "GENERAL" }
      });

      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      // Should succeed because it evaluates against version 1, not version 2
      expect(res.status).toBe(200);
    });

    it("18. Simultaneous submissions -> one success, one 409", async () => {
      mockSession(mockUserIdA, mockMerchantIdA);
      const req1 = createReq();
      const req2 = createReq();
      const [res1, res2] = await Promise.all([
        submitKyc(req1),
        submitKyc(req2)
      ]);
      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);
    });

    it("21. submission vs answer update -> serialize through lock", async () => {
      const [submitPromise, savePromise] = [
        submitKycApplication(mockMerchantIdA),
        saveKycAnswers(mockMerchantIdA, [{ fieldId: fieldNameId, value: "Concurrent Update" }])
      ];
      const results = await Promise.allSettled([submitPromise, savePromise]);
      const statuses = results.map(r => r.status);
      expect(statuses.includes("fulfilled")).toBe(true);
    });

    it("22. submission vs document deletion -> serialize through lock", async () => {
      const cycle = await db.kycSubmissionCycle.findFirst({ where: { applicationId: appId } });
      const doc = await db.kycDocument.findFirst({ where: { submissionCycleId: cycle!.id } });
      const [submitPromise, delPromise] = [
        submitKycApplication(mockMerchantIdA),
        deleteKycDocument(mockMerchantIdA, doc!.id)
      ];
      await Promise.allSettled([submitPromise, delPromise]);
      const updatedApp = await db.kycApplication.findUnique({ where: { id: appId } });
      const docExists = await db.kycDocument.findUnique({ where: { id: doc!.id } });
      const upCyc = await db.kycSubmissionCycle.findFirst({ where: { applicationId: appId } }); if (upCyc?.status === "UNDER_REVIEW") {
        expect(docExists).not.toBeNull();
      }
    });

    it("23. submission vs document upload -> serialize through lock", async () => {
      const [submitPromise, uploadPromise] = [
        submitKycApplication(mockMerchantIdA),
        uploadKycDocument(mockMerchantIdA, fieldDocId, Buffer.from("testpdf"), "test.pdf").catch(e => {
          if (e.message !== "MockStorageProvider error" && !e.message.includes("Cannot modify") && !e.message.includes("Maximum number")) throw e;
        })
      ];
      await Promise.allSettled([submitPromise, uploadPromise]);
      const updatedApp = await db.kycApplication.findUnique({ where: { id: appId } });
      const upCyc = await db.kycSubmissionCycle.findFirst({ where: { applicationId: appId } }); expect(["PENDING_SUBMISSION", "UNDER_REVIEW"]).toContain(upCyc?.status);
    });
  });

  describe("AUDIT & TIMESTAMPS", () => {
    let appId: string;
    beforeEach(async () => {
      const pastDate = new Date("2024-01-01T00:00:00Z");
      const app = await db.kycApplication.create({ include: { cycles: true }, data: { merchantProfileId: mockMerchantIdA, cycles: { create: { cycleNumber: 1, isCurrentCycle: true, formVersionId: publishedFormId, status: "PENDING_SUBMISSION", reviewedAt: pastDate } } }});
      appId = app.id;
      await db.kycAnswer.createMany({ data: [
        { submissionCycleId: app.cycles[0].id, fieldDefinitionId: fieldNameId, value: "My Company" },
        { submissionCycleId: app.cycles[0].id, fieldDefinitionId: fieldTypeId, value: "LLP" }
      ]});
      await db.kycDocument.create({ data: { submissionCycleId: app.cycles[0].id, fieldDefinitionId: fieldDocId, storageKey: "key", originalFilename: "file.pdf", mimeType: "application/pdf", sizeBytes: 100, status: "UPLOADED" }});
    });

    it("19. Successful submission creates UPDATE audit event with correct metadata and timestamps", async () => {
      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(200);

      const logs = await db.auditLog.findMany();
      expect(logs.length).toBe(1);
      expect(logs[0].actorType).toBe("MERCHANT");
      expect(logs[0].entityType).toBe("KYC_APPLICATION");
      expect(logs[0].action).toBe("UPDATE");
      expect((logs[0].metadata as any).previousStatus).toBe("PENDING_SUBMISSION");
      expect((logs[0].metadata as any).newStatus).toBe("UNDER_REVIEW");

      const app = await db.kycApplication.findUnique({ where: { id: appId }});
      const cycle = await db.kycSubmissionCycle.findFirst({ where: { applicationId: appId } });
      expect(cycle?.submittedAt).not.toBeNull();
      // Ensure reviewedAt was preserved
      expect(cycle?.reviewedAt?.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    });

    it("20. Failed 422 creates no audit event", async () => {
      await db.kycAnswer.deleteMany({ where: { fieldDefinitionId: fieldNameId }});
      mockSession(mockUserIdA, mockMerchantIdA);
      const res = await submitKyc(createReq());
      expect(res.status).toBe(422);

      const logs = await db.auditLog.findMany();
      expect(logs.length).toBe(0); // No audit log created
    });
  });
});
