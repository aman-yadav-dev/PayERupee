import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { NextRequest } from "next/server";
import { POST as resubmitKyc } from "@/app/api/v1/merchant/kyc/application/resubmit/route";
import KycRejectedPage from "@/app/(setup)/kyc/rejected/page";
import KycFormPage from "@/app/(setup)/kyc/form/page";
import { KycStateError } from "@/modules/merchant/application/merchant-kyc.service";
import { LocalDiskStorageAdapter } from "@/infrastructure/storage/local-disk.adapter";

const mockGetSession = vi.fn();
vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: { api: { getSession: (...args: any[]) => mockGetSession(...args) } }
}));

const mockRequireMerchantContext = vi.fn();
vi.mock("@/modules/auth/application/session-auth.service", () => ({
  requireMerchantContext: (...args: any[]) => mockRequireMerchantContext(...args),
  UnauthorizedError: class extends Error { constructor(msg: string) { super(msg); this.name = "UnauthorizedError"; } },
  ForbiddenError: class extends Error { constructor(msg: string) { super(msg); this.name = "ForbiddenError"; } }
}));

const mockRedirect = vi.fn();
vi.mock("@/modules/auth/application/destination-loader.service", () => ({ getResolvedAuthDestination: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => mockRedirect(url) }));
vi.mock("next/headers", () => ({ headers: () => new Map() }));
vi.mock("@/components/merchant/kyc/KycShell", () => ({ KycShell: ({ children }: any) => `KycShell:${children}`, AnimatedField: ({ children }: any) => `AnimatedField:${children}` }));
vi.mock("@/components/merchant/kyc/DynamicKycForm", () => ({ DynamicKycForm: () => "DynamicKycForm" }));

const mockStorageGet = vi.fn().mockResolvedValue(Buffer.from("dummy"));
const mockStoragePut = vi.fn().mockResolvedValue(undefined);
const mockStorageDelete = vi.fn().mockResolvedValue(undefined);
vi.mock("@/infrastructure/storage/local-disk.adapter", () => ({
  LocalDiskStorageAdapter: class {
    async get() { return mockStorageGet(); }
    async put(key: string, buf: Buffer, mime: string) { return mockStoragePut(key, buf, mime); }
    async delete(key: string) { return mockStorageDelete(key); }
    async exists() { return true; }
  }
}));

function createReq() {
  return new NextRequest("http://localhost/api/v1/merchant/kyc/application/resubmit", {
    method: "POST"
  });
}

describe("KYC Resubmission API & Lifecycle", () => {
  const userId = "test-resubmit-user";
  const profileId = "test-resubmit-profile";
  let formVersion1Id = "";
  let formVersion2Id = "";
  let v1_companyTypeFieldId = "";
  let v1_panFieldId = "";
  let v2_companyTypeFieldId = "";
  let v2_newFieldId = "";
  let v1_docFieldId = "";
  let v2_docFieldId = "";
  let appId = "";
  let cycle1Id = "";

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.kycDocument.deleteMany();
    await db.kycAnswer.deleteMany();
    await db.kycSubmissionCycle.deleteMany();
    await db.kycApplication.deleteMany({ where: { merchantProfileId: profileId } });
    await db.merchantProfile.deleteMany({ where: { id: profileId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.kycFieldDefinition.deleteMany();
    await db.kycFormVersion.deleteMany();
    await db.kycForm.deleteMany();

    const form = await db.kycForm.create({ data: { name: "Test Form" } });
    const fv1 = await db.kycFormVersion.create({ data: { formId: form.id, versionNumber: 1, status: "DEPRECATED" } });
    const fv2 = await db.kycFormVersion.create({ data: { formId: form.id, versionNumber: 2, status: "PUBLISHED" } });
    formVersion1Id = fv1.id;
    formVersion2Id = fv2.id;

    const f1 = await db.kycFieldDefinition.create({ data: { formVersionId: formVersion1Id, key: "company_type", label: "CT", dataType: "STRING", inputType: "TEXT", isRequired: true, section: "GENERAL" }});
    const f2 = await db.kycFieldDefinition.create({ data: { formVersionId: formVersion1Id, key: "pan_number", label: "PAN", dataType: "STRING", inputType: "TEXT", isRequired: true, section: "GENERAL" }});
    const fDoc1 = await db.kycFieldDefinition.create({ data: { formVersionId: formVersion1Id, key: "pan_doc", label: "Doc", dataType: "FILE", inputType: "FILE", isRequired: true, section: "GENERAL" }});
    v1_companyTypeFieldId = f1.id;
    v1_panFieldId = f2.id;
    v1_docFieldId = fDoc1.id;

    const f3 = await db.kycFieldDefinition.create({ data: { formVersionId: formVersion2Id, key: "company_type", label: "CT", dataType: "STRING", inputType: "TEXT", isRequired: true, section: "GENERAL" }});
    const f4 = await db.kycFieldDefinition.create({ data: { formVersionId: formVersion2Id, key: "new_field", label: "NF", dataType: "STRING", inputType: "TEXT", isRequired: true, section: "GENERAL" }});
    const fDoc2 = await db.kycFieldDefinition.create({ data: { formVersionId: formVersion2Id, key: "pan_doc", label: "Doc", dataType: "FILE", inputType: "FILE", isRequired: true, section: "GENERAL" }});
    v2_companyTypeFieldId = f3.id;
    v2_newFieldId = f4.id;
    v2_docFieldId = fDoc2.id;
  });

  afterEach(async () => {
    await db.kycDocument.deleteMany();
    await db.kycAnswer.deleteMany();
    await db.kycSubmissionCycle.deleteMany();
    await db.kycApplication.deleteMany({ where: { merchantProfileId: profileId } });
    await db.merchantProfile.deleteMany({ where: { id: profileId } });
    await db.user.deleteMany({ where: { id: userId } });
  });

  async function createRejectedUser(allowResubmission: boolean, status: any = "REJECTED") {
    await db.user.create({ data: { id: userId, email: "resubmit-test@example.com", name: "Resubmit User", emailVerified: true } });
    const profile = await db.merchantProfile.create({
      data: {
        id: profileId, userId, accountStatus: "PENDING", merchantType: "INDIVIDUAL",
        kycApplication: {
          create: {
            cycles: {
              create: [{ cycleNumber: 1, formVersionId: formVersion1Id, status, allowResubmission, rejectionReason: "Invalid documents" }]
            }
          }
        }
      },
      include: { kycApplication: { include: { cycles: true } } }
    });
    appId = profile.kycApplication!.id;
    cycle1Id = profile.kycApplication!.cycles[0].id;

    mockRequireMerchantContext.mockResolvedValue({ merchantProfileId: profileId, accountStatus: "PENDING" });
    mockGetSession.mockResolvedValue({ user: { id: userId, emailVerified: true } });
  }

  it("1. REJECTED + allowResubmission=true: UI permits /kyc/form", async () => {
    const { getResolvedAuthDestination } = await import("@/modules/auth/application/destination-loader.service");
    vi.mocked(getResolvedAuthDestination).mockResolvedValueOnce("/kyc/rejected");
    
    await createRejectedUser(true);
    await KycFormPage();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("2. REJECTED + allowResubmission=false: API /resubmit returns 409", async () => {
    await createRejectedUser(false);
    const res = await resubmitKyc(createReq());
    expect(res.status).toBe(409);
  });

  it("3. PENDING_SUBMISSION: API /resubmit returns 409", async () => {
    await createRejectedUser(true, "PENDING_SUBMISSION");
    const res = await resubmitKyc(createReq());
    expect(res.status).toBe(409);
  });

  it("4. A -> resubmit creates Cycle N+1, old becomes historical, binds to newest form version, clones answers/docs", async () => {
    await createRejectedUser(true);
    
    await db.kycAnswer.createMany({
      data: [
        { submissionCycleId: cycle1Id, fieldDefinitionId: v1_companyTypeFieldId, value: "MyCorp" },
        { submissionCycleId: cycle1Id, fieldDefinitionId: v1_panFieldId, value: "OLD_OBSOLETE" }
      ]
    });
    
    await db.kycDocument.create({
      data: { submissionCycleId: cycle1Id, fieldDefinitionId: v1_docFieldId, storageKey: "old/key", originalFilename: "f.pdf", mimeType: "application/pdf", sizeBytes: 10, status: "UPLOADED" }
    });

    const res = await resubmitKyc(createReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const cycles = await db.kycSubmissionCycle.findMany({ where: { applicationId: appId }, orderBy: { cycleNumber: 'asc' }, include: { answers: true, documents: true } });
    expect(cycles).toHaveLength(2);

    const oldCycle = cycles[0];
    const newCycle = cycles[1];

    expect(oldCycle.cycleNumber).toBe(1);
    expect(oldCycle.isCurrentCycle).toBe(false);
    expect(oldCycle.status).toBe("REJECTED");
    expect(oldCycle.answers).toHaveLength(2);
    expect(oldCycle.documents).toHaveLength(1);

    expect(newCycle.cycleNumber).toBe(2);
    expect(newCycle.isCurrentCycle).toBe(true);
    expect(newCycle.status).toBe("PENDING_SUBMISSION");
    expect(newCycle.formVersionId).toBe(formVersion2Id);
    expect(newCycle.allowResubmission).toBe(false);
    
    expect(newCycle.answers).toHaveLength(1);
    expect(newCycle.answers[0].fieldDefinitionId).toBe(v2_companyTypeFieldId);
    expect(newCycle.answers[0].value).toBe("MyCorp");

    expect(newCycle.documents).toHaveLength(1);
    expect(newCycle.documents[0].fieldDefinitionId).toBe(v2_docFieldId);
    expect(newCycle.documents[0].storageKey).not.toBe("old/key");
    expect(newCycle.documents[0].storageKey).toContain(profileId);
  });

  it("5. Storage-copy failure cleans up successfully copied new objects", async () => {
    await createRejectedUser(true);
    const fDoc2_v1 = await db.kycFieldDefinition.create({ data: { formVersionId: formVersion1Id, key: "other_doc", label: "Doc2", dataType: "FILE", inputType: "FILE", isRequired: true, section: "GENERAL" }});
    const fDoc2_v2 = await db.kycFieldDefinition.create({ data: { formVersionId: formVersion2Id, key: "other_doc", label: "Doc2", dataType: "FILE", inputType: "FILE", isRequired: true, section: "GENERAL" }});
    await db.kycDocument.createMany({
      data: [
        { submissionCycleId: cycle1Id, fieldDefinitionId: v1_docFieldId, storageKey: "old/key1", originalFilename: "f1.pdf", mimeType: "application/pdf", sizeBytes: 10, status: "UPLOADED" },
        { submissionCycleId: cycle1Id, fieldDefinitionId: fDoc2_v1.id, storageKey: "old/key2", originalFilename: "f2.pdf", mimeType: "application/pdf", sizeBytes: 10, status: "UPLOADED" }
      ]
    });
    
    let calls = 0;
    mockStoragePut.mockImplementation(async () => {
      calls++;
      if (calls === 2) throw new Error("Disk full");
    });
    
    const res = await resubmitKyc(createReq());
    expect(res.status).toBe(500); 
    expect(mockStorageDelete).toHaveBeenCalledTimes(1); 
  });

  it("6. DB failure after physical copies cleans up copied objects", async () => {
    await createRejectedUser(true);
    await db.kycDocument.create({ data: { submissionCycleId: cycle1Id, fieldDefinitionId: v1_docFieldId, storageKey: "old/key1", originalFilename: "f1.pdf", mimeType: "application/pdf", sizeBytes: 10, status: "UPLOADED" }});
    
    mockStoragePut.mockResolvedValue(undefined); // reset from test 5
    mockStorageDelete.mockClear();

    vi.spyOn(db, "$transaction").mockRejectedValueOnce(new Error("DB Lock Timeout"));

    const res = await resubmitKyc(createReq());
    expect(res.status).toBe(500);
    expect(mockStorageDelete).toHaveBeenCalledTimes(1);
  });
});
