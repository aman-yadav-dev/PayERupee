import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/infrastructure/database/db";
import { GET as getKycApplication } from "@/app/api/v1/merchant/kyc/application/route";
import { GET as getKycForm } from "@/app/api/v1/merchant/kyc/form/route";
import { PUT as putKycAnswers } from "@/app/api/v1/merchant/kyc/answers/route";
import { auth } from "@/modules/auth/infrastructure/auth";

vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: { getSession: vi.fn() }
  }
}));

describe("Merchant KYC APIs (Phases C1 & C2)", () => {
  let mockUserIdA = "kyc-user-a";
  let mockMerchantIdA = "kyc-merchant-a";
  let mockUserIdB = "kyc-user-b";
  let mockMerchantIdB = "kyc-merchant-b";
  let mockUserIdC = "kyc-user-c";
  let mockMerchantIdC = "kyc-merchant-c";
  
  let publishedFormId: string;
  let unpublishedFormId: string;

  beforeEach(async () => {
    // Setup KYC Forms
    const form = await db.kycForm.create({ data: { name: "Standard KYC" } });

    const published = await db.kycFormVersion.create({
      data: {
        formId: form.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        fields: {
          create: [
            { key: "pan", label: "PAN", section: "Identity", dataType: "STRING", inputType: "TEXT", isRequired: true, orderIndex: 1, applicableTypes: [] },
            { key: "company_proof", label: "Company Proof", section: "Identity", dataType: "FILE", inputType: "FILE", isRequired: true, orderIndex: 2, applicableTypes: ["COMPANY"] },
            { key: "business_type", label: "Business Type", section: "Identity", dataType: "STRING", inputType: "SELECT", selectOptions: ["Retail", "Wholesale"], isRequired: true, orderIndex: 3, applicableTypes: [] },
            { key: "revenue", label: "Revenue", section: "Identity", dataType: "NUMBER", inputType: "NUMBER", isRequired: false, orderIndex: 4, applicableTypes: [] }
          ]
        }
      }
    });
    publishedFormId = published.id;

    const unpublished = await db.kycFormVersion.create({
      data: {
        formId: form.id,
        versionNumber: 2,
        status: "DRAFT",
        fields: {
          create: [
            { key: "pan_v2", label: "PAN v2", section: "Identity", dataType: "STRING", inputType: "TEXT", isRequired: true, orderIndex: 1, applicableTypes: [] }
          ]
        }
      }
    });
    unpublishedFormId = unpublished.id;

    // Setup Merchants
    await db.user.create({ data: { id: mockUserIdA, name: "User A", email: "kyc_a@test.com" } });
    await db.merchantProfile.create({
      data: { id: mockMerchantIdA, userId: mockUserIdA, businessName: "Merchant A", accountStatus: "ACTIVE", merchantType: "COMPANY" }
    });
    await db.kycApplication.create({
      data: { merchantProfileId: mockMerchantIdA,
          cycles: { create: { cycleNumber: 1, formVersionId: publishedFormId, status: "PENDING_SUBMISSION", isCurrentCycle: true, allowResubmission: true } }
    },
        include: { cycles: true }
    });

    await db.user.create({ data: { id: mockUserIdB, name: "User B", email: "kyc_b@test.com" } });
    await db.merchantProfile.create({
      data: { id: mockMerchantIdB, userId: mockUserIdB, businessName: "Merchant B", accountStatus: "ACTIVE", merchantType: "INDIVIDUAL" }
    });

    await db.user.create({ data: { id: mockUserIdC, name: "User C", email: "kyc_c@test.com" } });
    await db.merchantProfile.create({
      data: { id: mockMerchantIdC, userId: mockUserIdC, businessName: "Merchant C", accountStatus: "ACTIVE" } 
    });
  });

  afterEach(async () => {
    vi.resetAllMocks();
    await db.kycAnswer.deleteMany();
    await db.kycApplication.deleteMany();
    await db.kycFieldDefinition.deleteMany();
    await db.kycFormVersion.deleteMany();
    await db.kycForm.deleteMany();
    await db.merchantProfile.deleteMany();
    await db.user.deleteMany();
  });

  function mockSession(userId: string) {
    (auth.api.getSession as any).mockResolvedValue({
      user: { id: userId, email: `${userId}@test.com`, role: "MERCHANT" }
    });
  }

  function mockNoSession() {
    (auth.api.getSession as any).mockResolvedValue(null);
  }

  async function getFields() {
    const pan = await db.kycFieldDefinition.findFirst({ where: { key: "pan" } });
    const company = await db.kycFieldDefinition.findFirst({ where: { key: "company_proof" } });
    const business = await db.kycFieldDefinition.findFirst({ where: { key: "business_type" } });
    const revenue = await db.kycFieldDefinition.findFirst({ where: { key: "revenue" } });
    const panV2 = await db.kycFieldDefinition.findFirst({ where: { key: "pan_v2" } });
    return { pan, company, business, revenue, panV2 };
  }

  // --- Phase C1 Tests ---

  it("C1: rejects unauthenticated requests (401)", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/application");
    const res = await getKycApplication(req);
    expect(res.status).toBe(401);
  });

  it("C1: authenticates and retrieves Merchant A's application safely", async () => {
    mockSession(mockUserIdA);
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/application");
    const res = await getKycApplication(req);
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("PENDING_SUBMISSION");
  });

  it("C1: returns null application if merchant has not started KYC", async () => {
    mockSession(mockUserIdB);
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/application");
    const res = await getKycApplication(req);
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
  });

  it("C1: allows PENDING merchant to read workflow", async () => {
    mockSession(mockUserIdA);
    await db.merchantProfile.update({ where: { id: mockMerchantIdA }, data: { accountStatus: "PENDING" } });
    
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/application");
    const res = await getKycApplication(req);
    expect(res.status).toBe(200);
  });

  it("C1: rejects SUSPENDED merchant from reading workflow", async () => {
    mockSession(mockUserIdA);
    await db.merchantProfile.update({ where: { id: mockMerchantIdA }, data: { accountStatus: "SUSPENDED" } });
    
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/application");
    const res = await getKycApplication(req);
    expect(res.status).toBe(403);
  });

  it("C1: returns active form filtered for COMPANY", async () => {
    mockSession(mockUserIdA);
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/form");
    const res = await getKycForm(req);
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(publishedFormId); 
    expect(body.data.fields).toHaveLength(4);
  });

  it("C1: returns active form filtered for INDIVIDUAL", async () => {
    mockSession(mockUserIdB);
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/form");
    const res = await getKycForm(req);
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.fields).toHaveLength(3);
    expect(body.data.fields.some((f: any) => f.key === "company_proof")).toBe(false);
  });

  it("C1: rejects form request if merchant type is missing", async () => {
    mockSession(mockUserIdC);
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/form");
    const res = await getKycForm(req);
    
    expect(res.status).toBe(400); 
    const body = await res.json();
    expect(body.error).toBe("Merchant type must be set before requesting a KYC form.");
  });

  // --- Phase C2 Tests ---

  it("C2: rejects unauthenticated requests (401)", async () => {
    mockNoSession();
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { method: "PUT", body: JSON.stringify({ answers: [] }) });
    const res = await putKycAnswers(req);
    expect(res.status).toBe(401);
  });

  it("C2: merchant can create/save initial draft (no app exists)", async () => {
    mockSession(mockUserIdB); 
    const fields = await getFields();
    
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ answers: [{ fieldId: fields.pan!.id, value: "ABCDE1234F" }] }) 
    });
    const res = await putKycAnswers(req);
    // Should fail with 404 because no application exists
    expect(res.status).toBe(404);

    const errorBody = await res.json();
    expect(errorBody.error).toBe("Application not found.");

    // Explicitly initialize the application
    const initReq = new NextRequest("http://localhost/api/v1/merchant/kyc/application", {
      method: "POST",
      body: JSON.stringify({ merchantType: "INDIVIDUAL" })
    });
    const { POST: initializeKycApplicationEndpoint } = await import("@/app/api/v1/merchant/kyc/application/route");
    const initRes = await initializeKycApplicationEndpoint(initReq);
    expect(initRes.status).toBe(200);

    // Now save should succeed
    const req2 = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ answers: [{ fieldId: fields.pan!.id, value: "ABCDE1234F" }] }) 
    });
    const res2 = await putKycAnswers(req2);
    expect(res2.status).toBe(200);

    const body = await res2.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("PENDING_SUBMISSION");
    expect(body.data.savedCount).toBe(1);
    const getReq = new NextRequest("http://localhost/api/v1/merchant/kyc/application");
    const getRes = await getKycApplication(getReq);
    const getBody = await getRes.json();
    expect(getBody.data.answers).toHaveLength(1);
    expect(getBody.data.answers[0].value).toBe("ABCDE1234F");
  });

  it("C2: merchant can update existing draft answer", async () => {
    mockSession(mockUserIdA); 
    const fields = await getFields();
    
    const req1 = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ answers: [{ fieldId: fields.pan!.id, value: "OLD_PAN" }] }) 
    });
    await putKycAnswers(req1);

    const req2 = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ answers: [{ fieldId: fields.pan!.id, value: "NEW_PAN" }] }) 
    });
    const res2 = await putKycAnswers(req2);
    expect(res2.status).toBe(200);

    const getReq = new NextRequest("http://localhost/api/v1/merchant/kyc/application");
    const getRes = await getKycApplication(getReq);
    const getBody = await getRes.json();
    expect(getBody.data.answers[0].value).toBe("NEW_PAN");
  });

  it("C2: incomplete required fields can still be saved as draft", async () => {
    mockSession(mockUserIdA); 
    const fields = await getFields();
    
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ answers: [{ fieldId: fields.business!.id, value: "Retail" }] }) 
    });
    const res = await putKycAnswers(req);
    expect(res.status).toBe(200);
  });

  it("C2: invalid fieldDefinitionId rejected", async () => {
    mockSession(mockUserIdA); 
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ answers: [{ fieldId: "fake_id", value: "Retail" }] }) 
    });
    const res = await putKycAnswers(req);
    expect(res.status).toBe(400);
  });

  it("C2: field from another form version rejected", async () => {
    mockSession(mockUserIdA); 
    const fields = await getFields();
    
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ answers: [{ fieldId: fields.panV2!.id, value: "123" }] }) 
    });
    const res = await putKycAnswers(req);
    expect(res.status).toBe(400);
  });

  it("C2: field for another merchant type rejected", async () => {
    mockSession(mockUserIdB); 
    const fields = await getFields();
    
    // Explicitly initialize the application first
    const initReq = new NextRequest("http://localhost/api/v1/merchant/kyc/application", {
      method: "POST",
      body: JSON.stringify({ merchantType: "INDIVIDUAL" })
    });
    const { POST: initializeKycApplicationEndpoint } = await import("@/app/api/v1/merchant/kyc/application/route");
    await initializeKycApplicationEndpoint(initReq);

    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ answers: [{ fieldId: fields.company!.id, value: "doc.pdf" }] }) 
    });
    const res = await putKycAnswers(req);
    expect(res.status).toBe(400);
  });

  it("C2: invalid select value rejected", async () => {
    mockSession(mockUserIdA); 
    const fields = await getFields();
    
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ answers: [{ fieldId: fields.business!.id, value: "InvalidOption" }] }) 
    });
    const res = await putKycAnswers(req);
    expect(res.status).toBe(400);
  });

  it("C2: invalid data type rejected", async () => {
    mockSession(mockUserIdA); 
    const fields = await getFields();
    
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ answers: [{ fieldId: fields.revenue!.id, value: "1000" }] }) 
    });
    const res = await putKycAnswers(req);
    expect(res.status).toBe(400);
  });

  it("C2: UNDER_REVIEW application cannot be modified", async () => {
    mockSession(mockUserIdA); 
    await db.kycSubmissionCycle.updateMany({ where: { application: { merchantProfileId: mockMerchantIdA }, isCurrentCycle: true }, data: { status: "UNDER_REVIEW" } });
    
    const fields = await getFields();
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ answers: [{ fieldId: fields.pan!.id, value: "A" }] }) 
    });
    const res = await putKycAnswers(req);
    expect(res.status).toBe(409); 
  });

  it("C2: REJECTED + allowResubmission=false cannot be modified", async () => {
    mockSession(mockUserIdA); 
    await db.kycSubmissionCycle.updateMany({ where: { application: { merchantProfileId: mockMerchantIdA }, isCurrentCycle: true }, data: { status: "REJECTED", allowResubmission: false } });
    
    const fields = await getFields();
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ answers: [{ fieldId: fields.pan!.id, value: "A" }] }) 
    });
    const res = await putKycAnswers(req);
    expect(res.status).toBe(409); 
  });

  it("C2: REJECTED + allowResubmission=true cannot be modified directly", async () => {
    mockSession(mockUserIdA); 
    await db.kycSubmissionCycle.updateMany({ where: { application: { merchantProfileId: mockMerchantIdA }, isCurrentCycle: true }, data: { status: "REJECTED", allowResubmission: true } });
    
    const fields = await getFields();
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ answers: [{ fieldId: fields.pan!.id, value: "A" }] }) 
    });
    const res = await putKycAnswers(req);
    expect(res.status).toBe(409); 
  });

  it("C2: APPROVED application cannot be modified", async () => {
    mockSession(mockUserIdA); 
    await db.kycSubmissionCycle.updateMany({ where: { application: { merchantProfileId: mockMerchantIdA }, isCurrentCycle: true }, data: { status: "APPROVED" } });
    
    const fields = await getFields();
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ answers: [{ fieldId: fields.pan!.id, value: "A" }] }) 
    });
    const res = await putKycAnswers(req);
    expect(res.status).toBe(409); 
  });

  it("C2: merchant/application ownership cannot be manipulated", async () => {
    mockSession(mockUserIdA); 
    // Merchant A attempts to alter Merchant B's application by passing it in the body (if the API even supported it, it should ignore it)
    const fields = await getFields();
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ merchantProfileId: mockMerchantIdB, answers: [{ fieldId: fields.pan!.id, value: "HACK" }] }) 
    });
    const res = await putKycAnswers(req);
    expect(res.status).toBe(200); // Saves under Merchant A, ignoring mockMerchantIdB
    
    // Verify Merchant B's application is NOT created/modified
    const appB = await db.kycApplication.findUnique({ where: { merchantProfileId: mockMerchantIdB }, include: { cycles: { include: { answers: true }, where: { isCurrentCycle: true }, take: 1 } } });
    expect(appB).toBeNull();
  });


  it("C2: string pretending to be a number is rejected (strict NUMBER validation)", async () => {
    mockSession(mockUserIdA); 
    const fields = await getFields();
    
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ answers: [{ fieldId: fields.revenue!.id, value: "1000" }] }) 
    });
    const res = await putKycAnswers(req);
    expect(res.status).toBe(400);
  });

  it("C2: valid number is accepted (strict NUMBER validation)", async () => {
    mockSession(mockUserIdA); 
    const fields = await getFields();
    
    const req = new NextRequest("http://localhost/api/v1/merchant/kyc/answers", { 
      method: "PUT", 
      body: JSON.stringify({ answers: [{ fieldId: fields.revenue!.id, value: 1000 }] }) 
    });
    const res = await putKycAnswers(req);
    expect(res.status).toBe(200);
  });
});
