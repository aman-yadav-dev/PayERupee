import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../../infrastructure/database/db";
import { updateKycMerchantType, saveKycAnswers, initializeKycApplication, getMerchantKycApplication, submitKycApplication } from "../../modules/merchant/application/merchant-kyc.service";
import { LocalDiskStorageAdapter } from "../../infrastructure/storage/local-disk.adapter";

describe("KYC Merchant-Type Draft Isolation", () => {
  let formVersionId: string;
  let merchantId: string;

  beforeAll(async () => {
    const fv = await db.kycFormVersion.findFirst({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" }
    });
    formVersionId = fv!.id;

    const user = await db.user.create({
      data: { id: "isolation_user", email: "isolation-test@payerupee.com", name: "Isolation User" }
    });
    const profile = await db.merchantProfile.create({
      data: { userId: user.id, merchantType: "INDIVIDUAL" }
    });
    merchantId = profile.id;
  });

  afterAll(async () => {
    await db.kycAnswer.deleteMany({ where: { cycle: { application: { merchantProfileId: merchantId } } } });
    await db.kycDocument.deleteMany({ where: { cycle: { application: { merchantProfileId: merchantId } } } });
    await db.kycSubmissionCycle.deleteMany({ where: { application: { merchantProfileId: merchantId } } });
    await db.kycApplication.deleteMany({ where: { merchantProfileId: merchantId } });
    await db.merchantProfile.deleteMany({ where: { id: merchantId } });
    await db.user.deleteMany({ where: { email: "isolation-test@payerupee.com" } });
  });

  it("1. Individual -> Company -> Individual restores answers and documents", async () => {
    await initializeKycApplication(merchantId, "INDIVIDUAL");
    
    const form = await db.kycFormVersion.findUnique({ where: { id: formVersionId }, include: { fields: true } });
    const fields = form!.fields;
    
    const panF = fields.find(f => f.key === "pan_number")!;
    const aadhaarF = fields.find(f => f.key === "aadhaar_number")!;
    const companyF = fields.find(f => f.key === "company_name")!;
    
    await saveKycAnswers(merchantId, [
      { fieldId: panF.id, value: "ABCDE1234F" }, // valid PAN
      { fieldId: aadhaarF.id, value: "123456789012" }, // valid Aadhaar
      { fieldId: companyF.id, value: "My Ind Company" }
    ]);

    // Add Aadhaar document
    const cycle = await db.kycSubmissionCycle.findFirst({ where: { application: { merchantProfileId: merchantId } } });
    await db.kycDocument.create({
      data: {
        submissionCycleId: cycle!.id,
        fieldDefinitionId: aadhaarF.id,
        originalFilename: "aadhaar.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        storageKey: "test/aadhaar.pdf",
        status: "UPLOADED"
      }
    });
    
    let app = await getMerchantKycApplication(merchantId);
    expect(app!.answers).toHaveLength(3);
    
    let rawAnswers = await db.kycAnswer.count({ where: { submissionCycleId: cycle!.id } });
    let rawDocs = await db.kycDocument.count({ where: { submissionCycleId: cycle!.id } });
    expect(rawAnswers).toBe(3);
    expect(rawDocs).toBe(1);

    await updateKycMerchantType(merchantId, "COMPANY");

    app = await getMerchantKycApplication(merchantId);
    expect(app!.answers).toHaveLength(2);
    expect(app!.merchantType).toBe("COMPANY");
    
    rawAnswers = await db.kycAnswer.count({ where: { submissionCycleId: cycle!.id } });
    rawDocs = await db.kycDocument.count({ where: { submissionCycleId: cycle!.id } });
    expect(rawAnswers).toBe(3); 
    expect(rawDocs).toBe(1); 

    await updateKycMerchantType(merchantId, "INDIVIDUAL");

    app = await getMerchantKycApplication(merchantId);
    expect(app!.answers).toHaveLength(3);
    expect(app!.merchantType).toBe("INDIVIDUAL");
    expect(app!.answers.some((a: any) => a.fieldDefinitionId === aadhaarF.id)).toBe(true);
  });

  it("2. Company -> Individual -> Company restores company-specific answers", async () => {
    await updateKycMerchantType(merchantId, "COMPANY");

    const form = await db.kycFormVersion.findUnique({ where: { id: formVersionId }, include: { fields: true } });
    const fields = form!.fields;
    const typeF = fields.find(f => f.key === "company_type")!;

    await saveKycAnswers(merchantId, [
      { fieldId: typeF.id, value: "COMPANY" }
    ]);

    let app = await getMerchantKycApplication(merchantId);
    expect(app!.answers.some((a: any) => a.fieldDefinitionId === typeF.id)).toBe(true);
    
    await updateKycMerchantType(merchantId, "INDIVIDUAL");
    app = await getMerchantKycApplication(merchantId);
    expect(app!.answers.some((a: any) => a.fieldDefinitionId === typeF.id)).toBe(false);

    await updateKycMerchantType(merchantId, "COMPANY");
    app = await getMerchantKycApplication(merchantId);
    expect(app!.answers.some((a: any) => a.fieldDefinitionId === typeF.id)).toBe(true);
  });

  it("3. Failure Safety: Aborts submission and prevents UNDER_REVIEW if physical document cleanup fails", async () => {
    // We are currently COMPANY. We have Aadhaar (orphaned) from test 1.
    // Let's satisfy COMPANY completeness.
    const form = await db.kycFormVersion.findUnique({ where: { id: formVersionId }, include: { fields: true } });
    const fields = form!.fields;
    
    const panF = fields.find(f => f.key === "pan_number")!;
    const typeF = fields.find(f => f.key === "company_type")!;
    const nameF = fields.find(f => f.key === "company_name")!;
    const addrF = fields.find(f => f.key === "company_address")!;
    const websiteF = fields.find(f => f.key === "website")!;
    const panDocF = fields.find(f => f.key === "pan_document")!;

    await saveKycAnswers(merchantId, [
      { fieldId: panF.id, value: "ABCDE1234F" },
      { fieldId: typeF.id, value: "COMPANY" },
      { fieldId: nameF.id, value: "Test Company" },
      { fieldId: addrF.id, value: "123 Test St" }
    ]);

    const cycle = await db.kycSubmissionCycle.findFirst({ where: { application: { merchantProfileId: merchantId } } });
    
    await db.kycDocument.create({
      data: {
        submissionCycleId: cycle!.id,
        fieldDefinitionId: panDocF.id,
        originalFilename: "pan.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        storageKey: "test/pan.pdf",
        status: "UPLOADED"
      }
    });

    const spy = vi.spyOn(LocalDiskStorageAdapter.prototype, 'delete').mockRejectedValueOnce(new Error("Simulated storage failure"));

    await expect(submitKycApplication(merchantId)).rejects.toThrow("Failed to clean up orphaned document");

    spy.mockRestore();

    const checkApp = await db.kycApplication.findUnique({ where: { merchantProfileId: merchantId }, include: { cycles: { where: { isCurrentCycle: true } } } });
    expect(checkApp!.cycles[0].status).toBe("PENDING_SUBMISSION");
    
    const rawDocs = await db.kycDocument.count({ where: { submissionCycleId: cycle!.id } });
    expect(rawDocs).toBe(2); // pan_document + orphaned aadhaar_document
  });

  it("4. Final Submission Cleanup: Purges orphaned data physically and permanently", async () => {
    const cycle = await db.kycSubmissionCycle.findFirst({ where: { application: { merchantProfileId: merchantId } } });
    const spy = vi.spyOn(LocalDiskStorageAdapter.prototype, 'delete').mockResolvedValue(undefined);

    await submitKycApplication(merchantId);

    const checkApp = await db.kycApplication.findUnique({ where: { merchantProfileId: merchantId }, include: { cycles: { where: { isCurrentCycle: true } } } });
    expect(checkApp!.cycles[0].status).toBe("UNDER_REVIEW");

    const rawDocs = await db.kycDocument.findMany({ where: { submissionCycleId: cycle!.id } });
    expect(rawDocs).toHaveLength(1); // Only pan_document left
    
    const form = await db.kycFormVersion.findUnique({ where: { id: formVersionId }, include: { fields: true } });
    const panDocF = form!.fields.find(f => f.key === "pan_document")!;
    expect(rawDocs[0].fieldDefinitionId).toBe(panDocF.id);

    const aadhaarF = form!.fields.find(f => f.key === "aadhaar_number")!;
    const rawAnswers = await db.kycAnswer.findMany({ where: { submissionCycleId: cycle!.id } });
    expect(rawAnswers.some(a => a.fieldDefinitionId === aadhaarF.id)).toBe(false);

    expect(spy).toHaveBeenCalledWith("test/aadhaar.pdf");
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });
});
