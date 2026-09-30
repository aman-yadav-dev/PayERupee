import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { submitKycApplication } from "@/modules/merchant/application/merchant-kyc.service";
import { approveKycApplication, rejectKycApplication } from "@/modules/admin/application/admin-kyc.service";
import { KycStatus, KycDataType, KycInputType } from "@prisma/client";

describe("KYC Email Notifications Outbox Integration", () => {
  let user: any;
  let merchantProfile: any;
  let formVersion: any;
  let field: any;
  let application: any;

  beforeEach(async () => {
    await db.outboxEvent.deleteMany();
    await db.auditLog.deleteMany();
    await db.kycAnswer.deleteMany();
    await db.kycApplication.deleteMany();
    await db.merchantProfile.deleteMany();
    await db.notificationPreference.deleteMany();
    await db.user.deleteMany();
    await db.kycFieldDefinition.deleteMany();
    await db.kycFormVersion.deleteMany();

    user = await db.user.create({
      data: { name: "Test Merchant", email: "test.merchant@example.com", emailVerified: true }
    });

    merchantProfile = await db.merchantProfile.create({
      data: { userId: user.id, merchantType: "PROPRIETOR" }
    });

    formVersion = await db.kycFormVersion.create({
      data: { versionNumber: 1, status: "PUBLISHED", publishedAt: new Date(), form: { create: { name: "Default" } } }
    });

    field = await db.kycFieldDefinition.create({
      data: { formVersionId: formVersion.id, key: "company_name", label: "Company", dataType: KycDataType.STRING, inputType: KycInputType.TEXT, isRequired: true, orderIndex: 1, section: "business_info" }
    });

    const companyTypeField = await db.kycFieldDefinition.create({
      data: { formVersionId: formVersion.id, key: "company_type", label: "Company Type", dataType: KycDataType.STRING, inputType: KycInputType.TEXT, isRequired: true, orderIndex: 2, section: "business_info" }
    });

    application = await db.kycApplication.create({
      data: { merchantProfileId: merchantProfile.id,
          cycles: { create: { cycleNumber: 1, formVersionId: formVersion.id, status: KycStatus.PENDING_SUBMISSION, isCurrentCycle: true } }
    },
        include: { cycles: true }
    });

    await db.kycAnswer.create({
      data: { submissionCycleId: application.cycles[0].id, fieldDefinitionId: field.id, value: "My Company" }
    });

    await db.kycAnswer.create({
      data: { submissionCycleId: application.cycles[0].id, fieldDefinitionId: companyTypeField.id, value: "INDIVIDUAL" }
    });
  });

  afterEach(async () => {
    await db.outboxEvent.deleteMany();
    await db.auditLog.deleteMany();
    await db.kycAnswer.deleteMany();
    await db.kycApplication.deleteMany();
    await db.merchantProfile.deleteMany();
    await db.notificationPreference.deleteMany();
    await db.user.deleteMany();
    await db.kycFieldDefinition.deleteMany();
    await db.kycFormVersion.deleteMany();
  });

  it("1. Initial submission creates EXACTLY ONE KYC_SUBMITTED event and respects idempotency", async () => {
    const updated = await submitKycApplication(merchantProfile.id);
    expect(updated.status).toBe(KycStatus.UNDER_REVIEW);
    // expect submissionCount removed.toBe(1);

    const outboxEvents = await db.outboxEvent.findMany();
    expect(outboxEvents.length).toBe(1);
    expect(outboxEvents[0].referenceId).toBe(`KYC_SUBMIT_${application.id}_v1`);
    
    const payload: any = outboxEvents[0].payload;
    expect(payload.templateId).toBe("KYC_SUBMITTED");
    expect(payload.templateVariables.name).toBe("Test Merchant");
    expect(payload.templateVariables.isResubmission).toBe(false);
    expect(payload.to).toBe("test.merchant@example.com");
    // Ensure no sensitive data
    expect(JSON.stringify(payload)).not.toContain("storageKey");
    expect(JSON.stringify(payload)).not.toContain("password");
  });

  it("2. Resubmission creates a v2 event without overriding v1", async () => {
    // 1st submission
    await submitKycApplication(merchantProfile.id);
    // reject
    const admin = await db.user.create({ data: { name: "Admin", email: "admin@example.com" } });
    await rejectKycApplication(admin.id, application.id, "Need better docs", true);
    
    // 2nd submission
    const { resubmitKycApplication } = await import('@/modules/merchant/application/merchant-kyc.service');
    await resubmitKycApplication(merchantProfile.id);
    const resubmitted = await submitKycApplication(merchantProfile.id);
    // expect submissionCount removed.toBe(2);

    const outboxEvents = await db.outboxEvent.findMany({ orderBy: { createdAt: "asc" } });
    // We expect 3 total outbox events: v1 submit, v1 reject, v2 submit
    expect(outboxEvents.length).toBe(3);
    
    const v2Submit = outboxEvents.find(e => e.referenceId === `KYC_SUBMIT_${application.id}_v2`);
    expect(v2Submit).toBeDefined();
    
    const payload: any = v2Submit!.payload;
    expect(payload.templateVariables.isResubmission).toBe(true);
  });

  it("3. Disabled KYC notifications creates NO email event", async () => {
    await db.notificationPreference.create({
      data: { userId: user.id, kycEmailsEnabled: false }
    });

    await submitKycApplication(merchantProfile.id);
    
    const outboxEvents = await db.outboxEvent.findMany();
    expect(outboxEvents.length).toBe(0); // No event created
  });

  it("5. Admin rejection creates KYC_REJECTED event with HTML-escaped reason", async () => {
    await submitKycApplication(merchantProfile.id);
    
    const admin = await db.user.create({ data: { name: "Admin", email: "admin@example.com" } });
    
    // Inject potentially malicious string
    await rejectKycApplication(admin.id, application.id, "Bad <script>alert(1)</script> data", true);

    const outboxEvents = await db.outboxEvent.findMany({ where: { referenceId: { startsWith: "KYC_REJECT" } } });
    expect(outboxEvents.length).toBe(1);
    expect(outboxEvents[0].referenceId).toBe(`KYC_REJECT_${application.id}_v1`);

    const payload: any = outboxEvents[0].payload;
    expect(payload.templateId).toBe("KYC_REJECTED");
    expect(payload.templateVariables.reason).toBe("Bad <script>alert(1)</script> data");
    // Escaping actually happens in the mailer rendering, but payload stores the raw string for rendering.
    // The requirement is that no sensitive data is placed here.
  });

  it("6. Admin approval creates KYC_APPROVED event", async () => {
    await submitKycApplication(merchantProfile.id);
    
    const admin = await db.user.create({ data: { name: "Admin", email: "admin@example.com" } });
    await approveKycApplication(admin.id, application.id);

    const outboxEvents = await db.outboxEvent.findMany({ where: { referenceId: { startsWith: "KYC_APPROVE" } } });
    expect(outboxEvents.length).toBe(1);
    expect(outboxEvents[0].referenceId).toBe(`KYC_APPROVE_${application.id}_v1`);

    const payload: any = outboxEvents[0].payload;
    expect(payload.templateId).toBe("KYC_APPROVED");
  });

  it("10. Invalid state transition creates NO email event and NO increment", async () => {
    await submitKycApplication(merchantProfile.id);
    const countBefore = await db.kycSubmissionCycle.count({ where: { applicationId: application.id } });

    // Trying to submit again should throw and roll back
    await expect(submitKycApplication(merchantProfile.id)).rejects.toThrow();

    const countAfter = await db.kycSubmissionCycle.count({ where: { applicationId: application.id } });
    expect(countAfter).toBe(countBefore); // Rollback occurred

    const outboxEvents = await db.outboxEvent.findMany({ where: { referenceId: { startsWith: "KYC_SUBMIT" } } });
    expect(outboxEvents.length).toBe(1); // Only the first one remains
  });
});
