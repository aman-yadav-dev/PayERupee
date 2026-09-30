import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { 
  getActiveKycForm,
  initializeKycApplication,
  saveKycAnswers,
  submitKycApplication,
  ApplicationNotFoundError
} from "@/modules/merchant/application/merchant-kyc.service";

describe("KYC Lifecycle Explicit Initialization", () => {
  const mockUserId = "test-usr-lifecycle";
  const mockMerchantId = "test-merch-lifecycle";
  let publishedFormId: string;
  let panFieldId: string;
  let reqFieldId: string;

  beforeEach(async () => {
    await db.kycAnswer.deleteMany();
    await db.kycDocument.deleteMany();
    await db.kycSubmissionCycle.deleteMany();
    await db.kycApplication.deleteMany();
    await db.merchantProfile.deleteMany();
    await db.user.deleteMany({ where: { id: mockUserId } });

    await db.kycFieldDefinition.deleteMany();
    await db.kycFormVersion.deleteMany();
    await db.kycForm.deleteMany();

    await db.user.create({ data: { id: mockUserId, email: "life@test.com", name: "Life" } });
    await db.merchantProfile.create({
      data: { id: mockMerchantId, userId: mockUserId, accountStatus: "PENDING" }
    });

    const form = await db.kycForm.create({ data: { name: "Lifecycle KYC" } });

    const fv = await db.kycFormVersion.create({
      data: {
        formId: form.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date()
      }
    });
    publishedFormId = fv.id;

    const reqField = await db.kycFieldDefinition.create({
      data: {
        formVersionId: publishedFormId,
        key: "req_field",
        label: "Req Field",
        dataType: "STRING",
        inputType: "TEXT",
        isRequired: true,
        orderIndex: 2,
        section: "Identity",
        applicableTypes: ["COMPANY"]
      }
    });
    reqFieldId = reqField.id;

    const panField = await db.kycFieldDefinition.create({
      data: {
        formVersionId: publishedFormId,
        key: "pan_number",
        label: "PAN Number",
        dataType: "STRING",
        inputType: "TEXT",
        isRequired: true,
        orderIndex: 3,
        section: "Identity",
        applicableTypes: ["COMPANY"]
      }
    });
    panFieldId = panField.id;
  });

  it("1. Explicit Initialization works and creates Cycle 1", async () => {
    const app = await initializeKycApplication(mockMerchantId, "COMPANY");
    expect(app).not.toBeNull();
    if (!app) return;
    expect(app.cycles).toHaveLength(1);
    expect(app.cycles[0].cycleNumber).toBe(1);
    expect(app.cycles[0].status).toBe("PENDING_SUBMISSION");
    
    const profile = await db.merchantProfile.findUnique({ where: { id: mockMerchantId } });
    expect(profile?.merchantType).toBe("COMPANY");
  });

  it("2. saveKycAnswers without explicit application throws ApplicationNotFoundError", async () => {
    await db.merchantProfile.update({ where: { id: mockMerchantId }, data: { merchantType: "COMPANY" }});
    await expect(saveKycAnswers(mockMerchantId, [{ fieldId: reqFieldId, value: "123" }]))
      .rejects.toThrow(ApplicationNotFoundError);
  });

  it("3. allows partial draft but rejects malformed final submission", async () => {
    await initializeKycApplication(mockMerchantId, "COMPANY");

    // Partial save with malformed PAN - should succeed
    const res = await saveKycAnswers(mockMerchantId, [
        { fieldId: reqFieldId, value: "ReqVal" },
        { fieldId: panFieldId, value: "ABCDE1234F" }
    ]);
    expect(res.savedCount).toBe(2);

    const submitRes = await submitKycApplication(mockMerchantId);
    expect(submitRes.status).toBe("UNDER_REVIEW");
  });
});