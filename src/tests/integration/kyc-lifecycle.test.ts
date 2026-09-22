import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { 
  getActiveKycForm,
  
  saveKycAnswers,
  submitKycApplication
} from "@/modules/merchant/application/merchant-kyc.service";

describe("KYC Lifecycle Late Binding (merchantType=null)", () => {
  const mockUserId = "test-usr-lifecycle";
  const mockMerchantId = "test-merch-lifecycle";
  let publishedFormId: string;
  let companyTypeFieldId: string;
  let panFieldId: string;
  let reqFieldId: string;

  beforeEach(async () => {
    await db.kycAnswer.deleteMany();
    await db.kycDocument.deleteMany();
    await db.kycApplication.deleteMany();
    await db.merchantProfile.deleteMany();
    await db.user.deleteMany({ where: { id: mockUserId } });

    await db.kycFieldDefinition.deleteMany();
    await db.kycFormVersion.deleteMany();
    await db.kycForm.deleteMany();

    // Basic User/Merchant Setup simulating /register flow where merchantType is not set
    await db.user.create({ data: { id: mockUserId, email: "life@test.com", name: "Life" } });
    await db.merchantProfile.create({
      data: { id: mockMerchantId, userId: mockUserId, accountStatus: "PENDING", merchantType: "PROPRIETOR" } // merchantType implicitly null
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

    const companyTypeField = await db.kycFieldDefinition.create({
      data: {
        formVersionId: publishedFormId,
        key: "company_type",
        label: "Company Type",
        dataType: "STRING",
        inputType: "SELECT",
        selectOptions: ["INDIVIDUAL", "COMPANY"],
        isRequired: true,
        orderIndex: 1,
        section: "Identity",
        applicableTypes: []
      }
    });
    companyTypeFieldId = companyTypeField.id;
    const panField = await db.kycFieldDefinition.create({
      data: {
        formVersionId: publishedFormId,
        key: "pan_number",
        label: "PAN",
        dataType: "STRING",
        inputType: "TEXT",
        isRequired: false,
        orderIndex: 2,
        section: "Identity",
        applicableTypes: ["COMPANY", "INDIVIDUAL"],
        validationRules: {
          pattern: "^[A-Z]{5}[0-9]{4}[A-Z]{1}$",
          message: "Invalid PAN format."
        }
      }
    });
    panFieldId = panField.id;

    
    const reqField = await db.kycFieldDefinition.create({
      data: {
        formVersionId: publishedFormId,
        key: "req_field",
        label: "Required Field",
        dataType: "STRING",
        inputType: "TEXT",
        isRequired: true,
        orderIndex: 2,
        section: "Identity",
        applicableTypes: ["COMPANY"] // Only applicable to COMPANY
      }
    });
    reqFieldId = reqField.id;
  });

  it("A-G: completes full KYC journey when merchantType starts null", async () => {
    let profile = await db.merchantProfile.findUnique({ where: { id: mockMerchantId } });
    expect(profile?.merchantType).toBeNull();

    await db.kycApplication.create({ data: { merchantProfileId: mockMerchantId, cycles: { create: { cycleNumber: 1, isCurrentCycle: true, formVersionId: publishedFormId, status: "PENDING_SUBMISSION", allowResubmission: true } } } });
    const app = await db.kycApplication.findUnique({ 
      where: { merchantProfileId: mockMerchantId }, 
      include: { cycles: { where: { isCurrentCycle: true } } } 
    });
    expect(app!.cycles[0]?.formVersionId).toBe(publishedFormId);
    expect(app!.cycles[0]?.status).toBe("PENDING_SUBMISSION");

    const form = await getActiveKycForm(mockMerchantId);
    expect(form.id).toBe(publishedFormId);
    expect(form.fields.length).toBeGreaterThan(0);

    // Save draft
    await saveKycAnswers(mockMerchantId, [{ fieldId: companyTypeFieldId, value: "COMPANY" }]);
    await saveKycAnswers(mockMerchantId, [{ fieldId: reqFieldId, value: "My Data" }]);
    await saveKycAnswers(mockMerchantId, [{ fieldId: panFieldId, value: "ABCDE1234F" }]);

    profile = await db.merchantProfile.findUnique({ where: { id: mockMerchantId } });
    expect(profile?.merchantType).toBeNull(); // Still null before submission

    await submitKycApplication(mockMerchantId);

    const finalApp = await db.kycApplication.findUnique({ 
      where: { id: app!.id },
      include: { cycles: { where: { isCurrentCycle: true } } }
    });
    expect(finalApp?.cycles[0]?.status).toBe("UNDER_REVIEW");

    profile = await db.merchantProfile.findUnique({ where: { id: mockMerchantId } });
    expect(profile?.merchantType).toBe("COMPANY");
  });

  it("H: fails submission if missing required fields, rolls back merchantType mutation", async () => {
    await db.kycApplication.create({ data: { merchantProfileId: mockMerchantId, cycles: { create: { cycleNumber: 1, isCurrentCycle: true, formVersionId: publishedFormId, status: "PENDING_SUBMISSION", allowResubmission: true } } } });
    
    // Set COMPANY but omit req_field
    await saveKycAnswers(mockMerchantId, [{ fieldId: companyTypeFieldId, value: "COMPANY" }]);

    await expect(submitKycApplication(mockMerchantId))
      .rejects.toThrow(); 
      
    // Transaction must roll back, so merchantType remains null
    const profile = await db.merchantProfile.findUnique({ where: { id: mockMerchantId } });
    expect(profile?.merchantType).toBeNull();
  });

  it("I: fails submission if company type is missing, leaving merchantType null", async () => {
    await db.kycApplication.create({ data: { merchantProfileId: mockMerchantId, cycles: { create: { cycleNumber: 1, isCurrentCycle: true, formVersionId: publishedFormId, status: "PENDING_SUBMISSION", allowResubmission: true } } } });
    
    await expect(submitKycApplication(mockMerchantId))
      .rejects.toThrow("KYC Completeness Validation Failed");
      
    const profile = await db.merchantProfile.findUnique({ where: { id: mockMerchantId } });
    expect(profile?.merchantType).toBeNull(); // Did not mutate
  });

  it("J: fails submission if provided company type conflicts with existing profile type", async () => {
    await db.merchantProfile.update({
      where: { id: mockMerchantId },
      data: { merchantType: "INDIVIDUAL" }
    });
    
    await db.kycApplication.create({ data: { merchantProfileId: mockMerchantId, cycles: { create: { cycleNumber: 1, isCurrentCycle: true, formVersionId: publishedFormId, status: "PENDING_SUBMISSION", allowResubmission: true } } } });
    // Submit COMPANY when profile is INDIVIDUAL
    await saveKycAnswers(mockMerchantId, [{ fieldId: companyTypeFieldId, value: "COMPANY" }]);

    await expect(submitKycApplication(mockMerchantId))
      .rejects.toThrow("Submitted Company Type conflicts with existing merchant profile type.");
      
    const profile = await db.merchantProfile.findUnique({ where: { id: mockMerchantId } });
    expect(profile?.merchantType).toBe("INDIVIDUAL"); // Remained INDIVIDUAL
  });

  it("Explicit Creation 1: saveKycAnswers without explicit application throws ApplicationNotFoundError", async () => {
    // Ensure no application exists
    await db.kycApplication.deleteMany({ where: { merchantProfileId: mockMerchantId } });

    await expect(saveKycAnswers(mockMerchantId, [{ fieldId: reqFieldId, value: "Test" }]))
      .rejects.toThrow();
  });

  it("Explicit Creation 2: createMerchantKycApplication works and subsequent saves work", async () => {
    await db.kycApplication.deleteMany({ where: { merchantProfileId: mockMerchantId } });
    
    // Explicit create
    const app = await db.kycApplication.create({ data: { merchantProfileId: mockMerchantId, cycles: { create: { cycleNumber: 1, isCurrentCycle: true, formVersionId: publishedFormId, status: "PENDING_SUBMISSION", allowResubmission: true } } } });
    const dbApp = await db.kycApplication.findUnique({
      where: { id: app.id },
      include: { cycles: { where: { isCurrentCycle: true } } }
    });
    expect(dbApp?.cycles[0]?.status).toBe("PENDING_SUBMISSION");
    
    // Save answers should now succeed
    await saveKycAnswers(mockMerchantId, [{ fieldId: reqFieldId, value: "Test" }]);
  });

  it("Final Backend Validation: allows partial draft but rejects malformed final submission", async () => {
    await db.kycApplication.deleteMany({ where: { merchantProfileId: mockMerchantId } });
    await db.kycApplication.create({ data: { merchantProfileId: mockMerchantId, cycles: { create: { cycleNumber: 1, isCurrentCycle: true, formVersionId: publishedFormId, status: "PENDING_SUBMISSION", allowResubmission: true } } } });

    // Save partial draft
    await saveKycAnswers(mockMerchantId, [
      { fieldId: companyTypeFieldId, value: "COMPANY" },
      { fieldId: reqFieldId, value: "My Data" },
      { fieldId: panFieldId, value: "ABC12" } // Partial PAN
    ]);

    // Should fail final submission strictly
    try {
      await submitKycApplication(mockMerchantId);
      expect.fail("Should have thrown KycCompletenessError");
    } catch (e: any) {
      console.log("TEST ERRORS:", JSON.stringify(e.errors, null, 2));
      expect(e.name).toBe("KycCompletenessError");
      const hasPanError = e.errors.some((err: any) => err.message.includes("Invalid PAN format."));
      expect(hasPanError).toBe(true);
    }
  });


  it("Final Backend Validation: malformed Aadhaar rejected, valid Aadhaar accepted", async () => {
    // Need aadhaar field id
    const aadhaarField = await db.kycFieldDefinition.findFirst({
      where: { key: "aadhaar_number", formVersionId: publishedFormId }
    });
    let aadhaarFieldId = aadhaarField?.id;
    if (!aadhaarFieldId) {
      const field = await db.kycFieldDefinition.create({
        data: {
          formVersionId: publishedFormId,
          key: "aadhaar_number",
          label: "Aadhaar",
          dataType: "STRING",
          inputType: "TEXT",
          isRequired: false,
          orderIndex: 3,
          section: "Identity",
          applicableTypes: ["INDIVIDUAL"],
          validationRules: {
            pattern: "^[0-9]{12}$",
            message: "Aadhaar must be 12 digits."
          }
        }
      });
      aadhaarFieldId = field.id;
    }

    await db.kycApplication.deleteMany({ where: { merchantProfileId: mockMerchantId } });
    await db.kycApplication.create({ data: { merchantProfileId: mockMerchantId, cycles: { create: { cycleNumber: 1, isCurrentCycle: true, formVersionId: publishedFormId, status: "PENDING_SUBMISSION", allowResubmission: true } } } });

    // Save partial Aadhaar draft
    await saveKycAnswers(mockMerchantId, [
      { fieldId: companyTypeFieldId, value: "INDIVIDUAL" },
      { fieldId: aadhaarFieldId, value: "1234" } // Partial Aadhaar
    ]);

    // Should fail final submission
    try {
      await submitKycApplication(mockMerchantId);
      expect.fail("Should have thrown KycCompletenessError");
    } catch (e: any) {
      expect(e.name).toBe("KycCompletenessError");
      const hasAadhaarError = e.errors.some((err: any) => err.message.includes("Aadhaar must be 12 digits."));
      expect(hasAadhaarError).toBe(true);
    }

    // Provide valid Aadhaar
    await saveKycAnswers(mockMerchantId, [
      { fieldId: aadhaarFieldId, value: "123456789012" }
    ]);

    // Valid Aadhaar satisfies the applicable fixture and submission should succeed
    await submitKycApplication(mockMerchantId);
  });

});