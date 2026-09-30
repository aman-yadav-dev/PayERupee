import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { uploadKycDocument, deleteKycDocument, getKycDocumentForDownload } from "@/modules/merchant/application/merchant-kyc.service";
import { LocalDiskStorageAdapter } from "@/infrastructure/storage/local-disk.adapter";
import { vi } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";

describe("KYC Document Storage Flattening (Slice A)", () => {
  let mockMerchantId = "merch_storage_test";
  let fieldDefId = "";
  let formVersionId = "";

  beforeEach(async () => {
    // Clear storage directory to prevent false positives from previous tests
    const storageDir = path.join(process.cwd(), ".storage");
    if (fs.existsSync(storageDir)) {
      fs.rmSync(storageDir, { recursive: true, force: true });
    }

    await db.kycDocument.deleteMany();
    await db.kycApplication.deleteMany({ where: { merchantProfileId: mockMerchantId } });
    await db.merchantProfile.deleteMany({ where: { id: mockMerchantId } });
    await db.user.deleteMany({ where: { email: "storage@test.com" } });
    await db.kycFieldDefinition.deleteMany({ where: { key: "test_doc_field" } });

    const user = await db.user.create({
      data: {
        id: crypto.randomUUID(),
        email: "storage@test.com",
        name: "Storage Test User"
      }
    });

    const merchant = await db.merchantProfile.create({
      data: {
        id: mockMerchantId,
        userId: user.id,
        businessName: "Storage Test Biz",
        merchantType: "COMPANY"
      }
    });

    let publishedForm = await db.kycFormVersion.findFirst({
      where: { status: "PUBLISHED" }
    });
    if (!publishedForm) {
       const form = await db.kycForm.create({ data: { name: "Test Form" } });
       publishedForm = await db.kycFormVersion.create({
         data: { formId: form.id, versionNumber: 1, status: "PUBLISHED" }
       });
    }
    formVersionId = publishedForm!.id;

    const field = await db.kycFieldDefinition.create({
      data: {
        formVersionId,
        key: "test_doc_field",
        label: "Test Doc",
        dataType: "FILE",
        inputType: "FILE",
        section: "DOCUMENTS",
        isRequired: true,
        applicableTypes: ["COMPANY"],
        fileRules: {
          maxSizeMB: 5,
          allowedMimeTypes: ["image/jpeg"]
        }
      }
    });
    fieldDefId = field.id;

    await db.kycApplication.create({ data: { id: "app_storage_1", merchantProfileId: mockMerchantId, cycles: { create: { cycleNumber: 1, isCurrentCycle: true, formVersionId, status: "PENDING_SUBMISSION" } } } });
  });

  it("1. New uploads use hierarchical identity paths: kyc_documents/{merchantProfileId}/{applicationId}/{uuid}", async () => {
    // Mock JPEG magic bytes (FF D8 FF E0)
    const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00]);
    const doc = await uploadKycDocument(mockMerchantId, fieldDefId, buffer, "test.jpg");

    // Fetch the actual record from DB to verify storageKey
    const dbDoc = await db.kycDocument.findUnique({ where: { id: doc.id } });
    expect(dbDoc).toBeDefined();

    // 1. Verify storage key is hierarchical
    expect(dbDoc!.storageKey).toMatch(new RegExp(`^merchant/${mockMerchantId}/kyc/[0-9a-f-]+.*$`));

    // 2. Verify file exists on disk
    const fullPath = path.join(process.cwd(), ".storage", dbDoc!.storageKey);
    expect(fs.existsSync(fullPath)).toBe(true);

    // 3. Verify nested application directories WERE created
    const nestedAppDirPath = path.dirname(fullPath);
    expect(fs.existsSync(nestedAppDirPath)).toBe(true);
    expect(path.basename(nestedAppDirPath)).toBe("kyc");
    expect(path.basename(path.dirname(nestedAppDirPath))).toBe(mockMerchantId);

    // cleanup
    await deleteKycDocument(mockMerchantId, doc.id);
  });

  it("2. Existing nested documents remain readable and deletable", async () => {
    // Manually create a nested storage document to simulate pre-migration state
    const uuid = crypto.randomUUID();
    const nestedKey = `merchant/${mockMerchantId}/kyc/${uuid}`;
    const fullPath = path.join(process.cwd(), ".storage", nestedKey);

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, Buffer.from("legacy-nested-data"));

    const activeC = await db.kycSubmissionCycle.findFirst({ where: { applicationId: "app_storage_1", isCurrentCycle: true } });
    
    const doc = await db.kycDocument.create({
      data: {
        id: "doc_legacy_1",
        submissionCycleId: activeC!.id,
        fieldDefinitionId: fieldDefId,
        storageKey: nestedKey,
        originalFilename: "legacy.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 123,
        status: "UPLOADED"
      }
    });

    // 1. Readable
    const buffer = await getKycDocumentForDownload(mockMerchantId, "doc_legacy_1");
    expect(buffer).toBeDefined();
    expect(buffer.buffer.toString()).toBe("legacy-nested-data");

    // 2. Deletable
    await deleteKycDocument(mockMerchantId, "doc_legacy_1");

    const deletedDoc = await db.kycDocument.findUnique({ where: { id: "doc_legacy_1" } });
    expect(deletedDoc).toBeNull();
    expect(fs.existsSync(fullPath)).toBe(false);
  });

  it("3. Compensation: Storage write failure cleans up PENDING DB row", async () => {
    // Mock physical storage failure
    vi.spyOn(LocalDiskStorageAdapter.prototype, 'put').mockRejectedValueOnce(
      new Error("Forced physical write failure")
    );

    const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00]);

    await expect(
      uploadKycDocument(mockMerchantId, fieldDefId, buffer, "test_fail.jpg")
    ).rejects.toThrow("Forced physical write failure");

    // Verify DB has no PENDING row for this mock application
    const activeC = await db.kycSubmissionCycle.findFirst({ where: { applicationId: "app_storage_1", isCurrentCycle: true } });
    const docs = await db.kycDocument.findMany({ where: { submissionCycleId: activeC!.id } });
    expect(docs.length).toBe(0);

    vi.restoreAllMocks();
  });

  it("4. Compensation: DB update failure removes the physically written file", async () => {
    // We need an unrelated doc so we can count remaining docs at the end
    const activeC = await db.kycSubmissionCycle.findFirst({ where: { applicationId: "app_storage_1", isCurrentCycle: true } });
    
    await db.kycDocument.create({
      data: {
        id: "unrelated_doc_1",
        submissionCycleId: activeC!.id,
        fieldDefinitionId: fieldDefId,
        storageKey: "kyc_documents/unrelated",
        originalFilename: "unrelated.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 100,
        status: "UPLOADED"
      }
    });

    // Force the DB update to UPLOADED to fail
    const dbUpdateSpy = vi.spyOn(db.kycDocument, 'update').mockRejectedValueOnce(new Error("Forced DB update failure"));
    const deleteSpy = vi.spyOn(LocalDiskStorageAdapter.prototype, 'delete');

    const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00]);

    await expect(
      uploadKycDocument(mockMerchantId, fieldDefId, buffer, "test_db_fail.jpg")
    ).rejects.toThrow("Forced DB update failure");

    // Verify the file was cleaned up via the storage provider delete method
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    
    // The spy gets called with the storage key
    const deletedKey = deleteSpy.mock.calls[0][0];
    expect(deletedKey).toMatch(new RegExp(`^merchant/${mockMerchantId}/kyc/[0-9a-f-]+.*$`));

    // Let's actually verify the file does not exist on disk
    const fullPath2 = path.join(process.cwd(), ".storage", deletedKey);
    expect(fs.existsSync(fullPath2)).toBe(false);
    
    // VERIFY DB CLEANUP: no PENDING row should remain for this application
    const remainingDocs = await db.kycDocument.findMany({ where: { submissionCycleId: activeC!.id } });
    expect(remainingDocs.length).toBe(1);
    expect(remainingDocs[0].id).toBe("unrelated_doc_1");
    
    dbUpdateSpy.mockRestore();
    deleteSpy.mockRestore();
  });
});
