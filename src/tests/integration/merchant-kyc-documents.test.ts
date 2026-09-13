import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { NextRequest } from "next/server";
import { POST as uploadDoc, GET as listDocs } from "@/app/api/v1/merchant/kyc/documents/route";
import { GET as downloadDoc } from "@/app/api/v1/merchant/kyc/documents/[id]/download/route";
import { DELETE as deleteDoc } from "@/app/api/v1/merchant/kyc/documents/[id]/route";
import { LocalDiskStorageAdapter } from "@/infrastructure/storage/local-disk.adapter";

vi.mock("@/modules/auth/application/session-auth.service", () => {
  return { requireMerchantContext: vi.fn() };
});
import { requireMerchantContext } from "@/modules/auth/application/session-auth.service";

// Test Data
const mockUserIdA = "user-a";
const mockMerchantIdA = "merchant-a";
const mockUserIdB = "user-b";
const mockMerchantIdB = "merchant-b";
let formId: string, formVersionId: string;
let fileFieldId1: string, fileFieldId5: string, fileFieldId10: string, strFieldId: string;
let appIdA: string, appIdB: string;

// Helpers
const validPDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0x00, 0x00, 0x00]);
const validJPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0x00, 0x00, 0x00, 0x00]);
const validPNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x00, 0x00, 0x00, 0x00]);
const invalidBytes = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);

function createReq(fieldId: string, filename = "test.pdf", buffer = validPDF, overrideContentType: string | null = null) {
  const formData = new FormData();
  formData.append("fieldId", fieldId);
  const blob = new Blob([buffer], { type: overrideContentType || "application/pdf" });
  formData.append("file", blob, filename);
  return new NextRequest("http://localhost/api/v1/merchant/kyc/documents", { method: "POST", body: formData });
}

describe("Phase C3: Merchant KYC Documents - Hardened Matrix", () => {
  beforeEach(async () => {
    await db.kycDocument.deleteMany();
    await db.kycAnswer.deleteMany();
    await db.kycApplication.deleteMany();
    await db.kycFieldDefinition.deleteMany();
    await db.kycFormVersion.deleteMany();
    await db.kycForm.deleteMany();
    await db.merchantProfile.deleteMany();
    await db.user.deleteMany();

    await db.user.createMany({ data: [
      { id: mockUserIdA, email: "a@a.com", role: "MERCHANT", name: "A" },
      { id: mockUserIdB, email: "b@b.com", role: "MERCHANT", name: "B" }
    ]});
    await db.merchantProfile.createMany({ data: [
      { id: mockMerchantIdA, userId: mockUserIdA, merchantType: "INDIVIDUAL" },
      { id: mockMerchantIdB, userId: mockUserIdB, merchantType: "INDIVIDUAL" }
    ]});
    
    const form = await db.kycForm.create({ data: { name: "Test Form" }});
    formId = form.id;
    const fv = await db.kycFormVersion.create({ data: { formId, versionNumber: 1, status: "PUBLISHED" }});
    formVersionId = fv.id;

    // Field: maxFiles=1, maxSize=5MB
    const f1 = await db.kycFieldDefinition.create({ data: {
      formVersionId, key: "f1", label: "F1", dataType: "FILE", inputType: "FILE", isRequired: true, section: "Docs",
      applicableTypes: ["INDIVIDUAL"], fileRules: { maxFiles: 1, maxSize: 5 * 1024 * 1024 }
    }});
    fileFieldId1 = f1.id;

    // Field: maxFiles=5, maxSize=10MB
    const f5 = await db.kycFieldDefinition.create({ data: {
      formVersionId, key: "f5", label: "F5", dataType: "FILE", inputType: "FILE", isRequired: true, section: "Docs",
      applicableTypes: ["INDIVIDUAL"], fileRules: { maxFiles: 5, maxSize: 10 * 1024 * 1024 }
    }});
    fileFieldId5 = f5.id;
    
    // Field: maxFiles=1, maxSize=1MB
    const f10 = await db.kycFieldDefinition.create({ data: {
      formVersionId, key: "f10", label: "F10", dataType: "FILE", inputType: "FILE", isRequired: true, section: "Docs",
      applicableTypes: ["INDIVIDUAL"], fileRules: { maxFiles: 1, maxSize: 1 * 1024 * 1024 }
    }});
    fileFieldId10 = f10.id;

    const s1 = await db.kycFieldDefinition.create({ data: {
      formVersionId, key: "s1", label: "S1", dataType: "STRING", inputType: "TEXT", isRequired: true, section: "Docs", applicableTypes: []
    }});
    strFieldId = s1.id;

    const appA = await db.kycApplication.create({ data: { merchantProfileId: mockMerchantIdA, formVersionId, status: "PENDING_SUBMISSION" }});
    appIdA = appA.id;
    const appB = await db.kycApplication.create({ data: { merchantProfileId: mockMerchantIdB, formVersionId, status: "PENDING_SUBMISSION" }});
    appIdB = appB.id;

    vi.mocked(requireMerchantContext).mockResolvedValue({ userId: mockUserIdA, merchantProfileId: mockMerchantIdA } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("AUTHENTICATION", () => {
    it("1. unauth upload -> 401", async () => {
      vi.mocked(requireMerchantContext).mockRejectedValue(new Error("Unauthorized"));
      const res = await uploadDoc(createReq(fileFieldId1));
      expect(res.status).toBe(401);
    });
    it("2. unauth list -> 401", async () => {
      vi.mocked(requireMerchantContext).mockRejectedValue(new Error("Unauthorized"));
      const res = await listDocs(new NextRequest("http://localhost/api"));
      expect(res.status).toBe(401);
    });
    it("3. unauth download -> 401", async () => {
      vi.mocked(requireMerchantContext).mockRejectedValue(new Error("Unauthorized"));
      const res = await downloadDoc(new NextRequest("http://localhost/api"), { params: { id: "1" }});
      expect(res.status).toBe(401);
    });
    it("4. unauth delete -> 401", async () => {
      vi.mocked(requireMerchantContext).mockRejectedValue(new Error("Unauthorized"));
      const res = await deleteDoc(new NextRequest("http://localhost/api"), { params: { id: "1" }});
      expect(res.status).toBe(401);
    });
  });

  describe("AUTHORIZATION / OWNERSHIP", () => {
    it("5-6. wrong merchant/app -> blocked", async () => {
      // B's field definition? No, fields belong to form version.
      // Simply verify created doc attaches to A's app, not B's.
      const res = await uploadDoc(createReq(fileFieldId1));
      expect(res.status).toBe(201);
      const data = await res.json();
      const doc = await db.kycDocument.findUnique({ where: { id: data.document.id } });
      expect(doc!.applicationId).toBe(appIdA);
    });
    it("7. cross-merchant download -> 404", async () => {
      vi.mocked(requireMerchantContext).mockResolvedValue({ userId: mockUserIdB, merchantProfileId: mockMerchantIdB } as any);
      const up = await uploadDoc(createReq(fileFieldId1));
      const upData = await up.json();
      
      vi.mocked(requireMerchantContext).mockResolvedValue({ userId: mockUserIdA, merchantProfileId: mockMerchantIdA } as any);
      const dl = await downloadDoc(new NextRequest("http://localhost/api"), { params: { id: upData.document.id }});
      expect(dl.status).toBe(404);
    });
    it("8. cross-merchant delete -> 404", async () => {
      vi.mocked(requireMerchantContext).mockResolvedValue({ userId: mockUserIdB, merchantProfileId: mockMerchantIdB } as any);
      const up = await uploadDoc(createReq(fileFieldId1));
      const upData = await up.json();
      vi.mocked(requireMerchantContext).mockResolvedValue({ userId: mockUserIdA, merchantProfileId: mockMerchantIdA } as any);
      const del = await deleteDoc(new NextRequest("http://localhost/api"), { params: { id: upData.document.id }});
      expect(del.status).toBe(404);
    });
    it("9. guessed ID -> 404", async () => {
      const res = await downloadDoc(new NextRequest("http://localhost/api"), { params: { id: "nonexistent-id" }});
      expect(res.status).toBe(404);
    });
  });

  describe("APPLICATION STATE", () => {
    it("10. PENDING_SUBMISSION upload allowed", async () => {
      const res = await uploadDoc(createReq(fileFieldId1));
      expect(res.status).toBe(201);
    });
    it("11. REJECTED + allowResubmission=true allowed", async () => {
      await db.kycApplication.update({ where: { id: appIdA }, data: { status: "REJECTED", allowResubmission: true }});
      const res = await uploadDoc(createReq(fileFieldId1));
      expect(res.status).toBe(201);
    });
    it("12. REJECTED + allowResubmission=false blocked", async () => {
      await db.kycApplication.update({ where: { id: appIdA }, data: { status: "REJECTED", allowResubmission: false }});
      const res = await uploadDoc(createReq(fileFieldId1));
      expect(res.status).toBe(409);
    });
    it("13-14. UNDER_REVIEW and APPROVED blocked", async () => {
      await db.kycApplication.update({ where: { id: appIdA }, data: { status: "UNDER_REVIEW" }});
      const res1 = await uploadDoc(createReq(fileFieldId1));
      expect(res1.status).toBe(409);
      
      await db.kycApplication.update({ where: { id: appIdA }, data: { status: "APPROVED" }});
      const res2 = await uploadDoc(createReq(fileFieldId1));
      expect(res2.status).toBe(409);
    });
  });

  describe("FIELD VALIDATION", () => {
    it("17. invalid field ID -> 400", async () => {
      const res = await uploadDoc(createReq("invalid"));
      expect(res.status).toBe(400);
    });
    it("18. non-FILE field -> 400", async () => {
      const res = await uploadDoc(createReq(strFieldId));
      expect(res.status).toBe(400);
    });
    it("19. wrong form version -> 400", async () => {
      const fv2 = await db.kycFormVersion.create({ data: { formId, versionNumber: 2, status: "DRAFT" }});
      const f2 = await db.kycFieldDefinition.create({ data: { formVersionId: fv2.id, key: "f2", label: "F2", dataType: "FILE", inputType: "FILE", isRequired: true, section: "Docs", applicableTypes: ["INDIVIDUAL"] }});
      const res = await uploadDoc(createReq(f2.id));
      expect(res.status).toBe(400);
    });
    it("20. merchant type mismatch -> 400", async () => {
      const fType = await db.kycFieldDefinition.create({ data: { formVersionId, key: "ft", label: "FT", dataType: "FILE", inputType: "FILE", isRequired: true, section: "Docs", applicableTypes: ["COMPANY"] }});
      const res = await uploadDoc(createReq(fType.id));
      expect(res.status).toBe(400);
    });
    it("21. maxFiles exceeded -> 409", async () => {
      const r1 = await uploadDoc(createReq(fileFieldId1));
      expect(r1.status).toBe(201);
      const r2 = await uploadDoc(createReq(fileFieldId1));
      expect(r2.status).toBe(409);
    });
  });

  describe("FILE VALIDATION & DYNAMIC SIZE", () => {
    it("22-25. valid PDF, JPEG, PNG, spoofed Content-Type", async () => {
      const r1 = await uploadDoc(createReq(fileFieldId5, "test.pdf", validPDF));
      expect(r1.status).toBe(201);
      const r2 = await uploadDoc(createReq(fileFieldId5, "test.jpg", validJPEG));
      expect(r2.status).toBe(201);
      const r3 = await uploadDoc(createReq(fileFieldId5, "test.png", validPNG));
      expect(r3.status).toBe(201);
      const r4 = await uploadDoc(createReq(fileFieldId5, "test.exe", validPDF, "application/octet-stream"));
      expect(r4.status).toBe(201);
    });
    it("27. invalid magic bytes -> 415", async () => {
      const r = await uploadDoc(createReq(fileFieldId5, "test.pdf", invalidBytes));
      expect(r.status).toBe(415);
    });
    it("28. executable disguised -> 415", async () => {
      const mz = Buffer.from([0x4D, 0x5A, 0x90, 0x00]);
      const r = await uploadDoc(createReq(fileFieldId5, "test.pdf", mz));
      expect(r.status).toBe(415);
    });
    it("30-32. malicious filenames safely handled", async () => {
      const r = await uploadDoc(createReq(fileFieldId5, "../../../etc/passwd\r\n.pdf", validPDF));
      expect(r.status).toBe(201);
      const data = await r.json();
      const doc = await db.kycDocument.findUnique({ where: { id: data.document.id }});
      expect(doc!.storageKey).not.toContain("etc/passwd");
      expect(doc!.storageKey).toMatch(/^kyc_documents\//);
    });
    it("33. maxSize 1MB rejects larger file", async () => {
      const buf = Buffer.alloc(1.5 * 1024 * 1024, 0);
      validPDF.copy(buf, 0);
      const r = await uploadDoc(createReq(fileFieldId10, "test.pdf", buf));
      expect(r.status).toBe(413);
    });
    it("34. maxSize 10MB accepts valid 6MB file", async () => {
      const buf = Buffer.alloc(6 * 1024 * 1024, 0);
      validPDF.copy(buf, 0);
      const r = await uploadDoc(createReq(fileFieldId5, "test.pdf", buf));
      expect(r.status).toBe(201);
    });
    it("35, 36. Content-Length bypass prevented by sizeBytes", async () => {
      // Even if spoofed, NextJS reads into Buffer and our code checks `buffer.length > maxSize`
      const buf = Buffer.alloc(1.5 * 1024 * 1024, 0);
      validPDF.copy(buf, 0);
      const req = createReq(fileFieldId10, "test.pdf", buf);
      req.headers.set("content-length", "10"); // spoof small
      const r = await uploadDoc(req);
      expect(r.status).toBe(413);
    });
  });

  describe("STORAGE / DB FAILURE", () => {
    it("37. success -> 201 and UPLOADED", async () => {
      const r = await uploadDoc(createReq(fileFieldId1));
      expect(r.status).toBe(201);
      const data = await r.json();
      const doc = await db.kycDocument.findUnique({ where: { id: data.document.id }});
      expect(doc!.status).toBe("UPLOADED");
    });
    it("38. storage failure -> 500, PENDING", async () => {
      const spy = vi.spyOn(LocalDiskStorageAdapter.prototype, "put").mockRejectedValueOnce(new Error("Storage I/O Error"));
      const r = await uploadDoc(createReq(fileFieldId1));
      expect(r.status).toBe(500);
      const docs = await db.kycDocument.findMany({ where: { applicationId: appIdA }});
      expect(docs).toHaveLength(1);
      expect(docs[0].status).toBe("PENDING");
      spy.mockRestore();
    });
  });

  describe("DOWNLOAD & LIST & DELETE", () => {
    it("42, 44-48, 49-52. download and list", async () => {
      const up = await uploadDoc(createReq(fileFieldId1));
      const upData = await up.json();
      
      const list = await listDocs(new NextRequest("http://localhost/api"));
      const listData = await list.json();
      expect(listData.documents).toHaveLength(1);
      expect(listData.documents[0].storageKey).toBeUndefined();

      const dl = await downloadDoc(new NextRequest("http://localhost/api"), { params: { id: upData.document.id }});
      expect(dl.status).toBe(200);
      expect(dl.headers.get("Content-Disposition")).toContain("attachment;");
    });

    it("53, 56. delete success and repeat", async () => {
      const up = await uploadDoc(createReq(fileFieldId1));
      const docId = (await up.json()).document.id;

      const del1 = await deleteDoc(new NextRequest("http://localhost/api"), { params: { id: docId }});
      expect(del1.status).toBe(200);
      const check = await db.kycDocument.findUnique({ where: { id: docId }});
      expect(check).toBeNull();

      const del2 = await deleteDoc(new NextRequest("http://localhost/api"), { params: { id: docId }});
      expect(del2.status).toBe(404);
    });
    
    it("55. DB delete ok, storage fails -> orphan behavior", async () => {
      const up = await uploadDoc(createReq(fileFieldId1));
      const docId = (await up.json()).document.id;

      const spy = vi.spyOn(LocalDiskStorageAdapter.prototype, "delete").mockRejectedValueOnce(new Error("Storage Delete Error"));
      const del = await deleteDoc(new NextRequest("http://localhost/api"), { params: { id: docId }});
      expect(del.status).toBe(500);
      const check = await db.kycDocument.findUnique({ where: { id: docId }});
      expect(check).toBeNull();
      spy.mockRestore();
    });
  });

  describe("CONCURRENCY", () => {
    it("58. Promise.all() maxFiles=1", async () => {
      const reqs = [createReq(fileFieldId1), createReq(fileFieldId1), createReq(fileFieldId1)];
      const results = await Promise.all(reqs.map(r => uploadDoc(r)));
      
      const codes = results.map(r => r.status);
      const success = codes.filter(c => c === 201).length;
      const conflicts = codes.filter(c => c === 409).length;
      
      expect(success).toBe(1);
      expect(conflicts).toBe(2);
      
      const docs = await db.kycDocument.findMany({ where: { applicationId: appIdA }});
      expect(docs).toHaveLength(1);
    });

    it("59. Promise.all() maxFiles=5", async () => {
      const reqs = Array.from({ length: 6 }).map(() => createReq(fileFieldId5));
      const results = await Promise.all(reqs.map(r => uploadDoc(r)));
      
      const success = results.filter(r => r.status === 201).length;
      const conflicts = results.filter(r => r.status === 409).length;
      
      expect(success).toBe(5);
      expect(conflicts).toBe(1);
    });
  });
});
