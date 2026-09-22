import { db } from "@/infrastructure/database/db";
import { LocalDiskStorageAdapter } from "@/infrastructure/storage/local-disk.adapter";
import { logAction } from "@/modules/audit/domain/audit.service";
import { AuditActorType, AuditEntity, AuditAction, MerchantType } from "@prisma/client";
import crypto from "crypto";

function resolveCurrentCycle(application: any) {
  if (!application || !application.cycles) throw new KycStateError("No KYC cycles loaded.");
  const currentCycles = application.cycles.filter((c: any) => c.isCurrentCycle);
  if (currentCycles.length === 0) throw new KycStateError("No active KYC cycle found.");
  if (currentCycles.length > 1) {
    throw new KycStateError("Multiple current cycles detected. Database invariant violated.");
  }
  return currentCycles[0];
}

const storageProvider = new LocalDiskStorageAdapter();

export class ApplicationNotFoundError extends Error {
  constructor() {
    super("Application not found.");
    this.name = "ApplicationNotFoundError";
  }
}

export class FormNotFoundError extends Error {
  constructor() {
    super("Published KYC form not found.");
    this.name = "FormNotFoundError";
  }
}

export class MerchantTypeMissingError extends Error {
  constructor() {
    super("Merchant type must be set before requesting a KYC form.");
    this.name = "MerchantTypeMissingError";
  }
}

export class KycStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KycStateError";
  }
}

export class KycValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KycValidationError";
  }
}

export class InvalidMagicBytesError extends KycValidationError {
  constructor() {
    super("Unsupported file format or invalid magic bytes.");
    this.name = "InvalidMagicBytesError";
  }
}

export class KycCompletenessError extends Error {
  public errors: { fieldKey: string, message: string }[];
  constructor(errors: { fieldKey: string, message: string }[]) {
    super("KYC Completeness Validation Failed");
    this.name = "KycCompletenessError";
    this.errors = errors;
  }
}

export async function getMerchantKycApplication(merchantProfileId: string) {
  const application = await db.kycApplication.findUnique({
    where: { merchantProfileId },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      cycles: {
        where: { isCurrentCycle: true },
        select: {
          id: true,
          status: true,
          formVersionId: true,
          rejectionReason: true,
          allowResubmission: true,
          reviewerId: true,
          submittedAt: true,
          reviewedAt: true,
          isCurrentCycle: true,
          formVersion: {
            select: {
              id: true,
              versionNumber: true,
              form: { select: { name: true } }
            }
          },
          answers: {
            select: { fieldDefinitionId: true, value: true }
          }
        }
      }
    }
  });

  if (!application) return null;
  if (!application.cycles || application.cycles.length === 0) return null;
  const cycle = resolveCurrentCycle(application);

  return {
    id: application.id,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    status: cycle.status,
    formVersionId: cycle.formVersionId,
    rejectionReason: cycle.rejectionReason,
    allowResubmission: cycle.allowResubmission,
    reviewerId: cycle.reviewerId,
    submittedAt: cycle.submittedAt,
    reviewedAt: cycle.reviewedAt,
    formVersion: cycle.formVersion,
    answers: cycle.answers
  };
}

export async function getActiveKycForm(merchantProfileId: string) {
  const profile = await db.merchantProfile.findUnique({
    where: { id: merchantProfileId },
    select: { merchantType: true }
  });

  const merchantType = profile?.merchantType as MerchantType | undefined;
  if (!merchantType) {
    throw new MerchantTypeMissingError();
  }

  // Find the latest published form
  const form = await db.kycFormVersion.findFirst({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    include: {
      fields: {
        orderBy: { orderIndex: "asc" }
      }
    }
  });

  if (!form) {
    throw new FormNotFoundError();
  }

  // Filter fields applicable to this merchant type
  const applicableFields = form.fields.filter(field =>
    field.applicableTypes.length === 0 || field.applicableTypes.includes(merchantType)
  );

  return {
    id: form.id,
    formId: form.formId,
    versionNumber: form.versionNumber,
    publishedAt: form.publishedAt,
    fields: applicableFields.map(f => ({
      id: f.id,
      key: f.key,
      label: f.label,
      description: f.description,
      dataType: f.dataType,
      inputType: f.inputType,
      isRequired: f.isRequired,
      validationRules: f.validationRules,
      selectOptions: f.selectOptions,
      fileRules: f.fileRules,
      orderIndex: f.orderIndex,
    }))
  };
}

export function validateFieldValue(field: any, value: any): void {
  if (field.dataType === "STRING") {
    if (typeof value !== "string") throw new KycValidationError(`Field ${field.key} expects a string.`);
  } else if (field.dataType === "NUMBER") {
    if (typeof value !== "number") throw new KycValidationError(`Field ${field.key} expects a number.`);
  } else if (field.dataType === "BOOLEAN") {
    if (typeof value !== "boolean") throw new KycValidationError(`Field ${field.key} expects a boolean.`);
  } else if (field.dataType === "DATE") {
    if (typeof value !== "string" || isNaN(Date.parse(value))) throw new KycValidationError(`Field ${field.key} expects a valid ISO date string.`);
  } else if (field.dataType === "FILE") {
    throw new KycValidationError(`File upload is not supported in this phase.`);
  } else {
    throw new KycValidationError(`Unsupported data type ${field.dataType} for field ${field.key}.`);
  }

  // SELECT validation
  if (field.inputType === "SELECT") {
    const options = field.selectOptions as string[] | undefined;
    if (options && Array.isArray(options)) {
      if (!options.includes(value as string)) {
        throw new KycValidationError(`Value '${value}' is not a valid option for field ${field.key}.`);
      }
    }
  }
}

export async function saveKycAnswers(merchantProfileId: string, answers: { fieldId: string, value: any }[]) {
  const profile = await db.merchantProfile.findUnique({
    where: { id: merchantProfileId },
    select: { merchantType: true }
  });

  const merchantType = profile?.merchantType as MerchantType | undefined;
  if (!merchantType) {
    throw new MerchantTypeMissingError();
  }

  return await db.$transaction(async (tx) => {
    let application = await tx.kycApplication.findUnique({ 
      where: { merchantProfileId },
      include: { cycles: { where: { isCurrentCycle: true } } }
    });

    if (!application) {
      const formVersion = await tx.kycFormVersion.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" }
      });
      if (!formVersion) throw new FormNotFoundError();

      application = await tx.kycApplication.create({
        data: {
          merchantProfileId,
          cycles: {
            create: {
              cycleNumber: 1,
              formVersionId: formVersion.id,
              isCurrentCycle: true,
              allowResubmission: true,
              status: "PENDING_SUBMISSION"
            }
          }
        },
        include: { cycles: { where: { isCurrentCycle: true } } }
      });
    } else {
      application = await tx.kycApplication.update({
        where: { id: application.id },
        data: { updatedAt: new Date() },
        include: { cycles: { where: { isCurrentCycle: true } } }
      });
    }

    const cycle = resolveCurrentCycle(application);

    if (cycle.status === "UNDER_REVIEW" || cycle.status === "APPROVED") {
      throw new KycStateError(`Cannot modify application in ${cycle.status} state.`);
    }

    if (cycle.status === "REJECTED" && !cycle.allowResubmission) {
      throw new KycStateError("Resubmission is not allowed for this application.");
    }

    const fields = await tx.kycFieldDefinition.findMany({
      where: { formVersionId: cycle.formVersionId }
    });

    const validAnswers = [];
    for (const ans of answers) {
      const field = fields.find(f => f.id === ans.fieldId);
      if (!field) {
        throw new KycValidationError(`Field ${ans.fieldId} does not exist in this form version.`);
      }

      if (field.applicableTypes.length > 0 && !field.applicableTypes.includes(merchantType)) {
        throw new KycValidationError(`Field ${field.key} is not applicable to this merchant type.`);
      }

      validateFieldValue(field, ans.value);

      validAnswers.push({
        submissionCycleId: cycle.id,
        fieldDefinitionId: field.id,
        value: ans.value
      });
    }

    if (validAnswers.length > 0) {
      await Promise.all(validAnswers.map(ans => tx.kycAnswer.upsert({
        where: {
          submissionCycleId_fieldDefinitionId: {
            submissionCycleId: ans.submissionCycleId,
            fieldDefinitionId: ans.fieldDefinitionId
          }
        },
        create: ans,
        update: { value: ans.value }
      })));
    }

    return { applicationId: application.id, status: cycle.status, savedCount: validAnswers.length };
  });
}

export function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  // PDF: %PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return 'application/pdf';
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'image/jpeg';
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'image/png';
  return null;
}

export async function uploadKycDocument(
  merchantProfileId: string,
  fieldDefinitionId: string,
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType?: string
) {
  const profile = await db.merchantProfile.findUnique({
    where: { id: merchantProfileId },
    select: { merchantType: true }
  });

  const merchantType = profile?.merchantType as MerchantType | undefined;
  if (!merchantType) {
    throw new MerchantTypeMissingError();
  }

  const detectedMime = detectMimeType(fileBuffer);
  const finalMime = detectedMime || mimeType;

  if (!finalMime || !["image/jpeg", "image/png", "application/pdf"].includes(finalMime)) {
    throw new InvalidMagicBytesError();
  }

  

  
  const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/\.\./g, '_');
  const storageKey = `merchant/${merchantProfileId}/kyc/${crypto.randomUUID()}-${sanitizedFilename}`;


  const docRecord = await db.$transaction(async (tx) => {
    const application = await tx.kycApplication.findUnique({
      where: { merchantProfileId },
      include: { cycles: { where: { isCurrentCycle: true } } }
    });

    if (!application) throw new ApplicationNotFoundError();
    const cycle = resolveCurrentCycle(application);

    const field = await tx.kycFieldDefinition.findUnique({
      where: { id: fieldDefinitionId }
    });

    if (!field || field.formVersionId !== cycle.formVersionId) {
      throw new KycValidationError("Invalid field definition for this application version.");
    }

    
    if (field.dataType !== "FILE") {
      throw new KycValidationError("Field is not a file upload field.");
    }

    let maxFiles = 5;
    let maxSize = 10 * 1024 * 1024;
    if (field.fileRules && typeof field.fileRules === 'object') {
      const rules = field.fileRules as any;
      if (rules.maxFiles !== undefined) maxFiles = rules.maxFiles;
      if (rules.maxSize !== undefined) maxSize = rules.maxSize;
    }

    if (fileBuffer.length > maxSize) {
      throw new KycValidationError(`File exceeds the maximum allowed size for this field.`);
    }
    

    if (field.applicableTypes.length > 0 && !field.applicableTypes.includes(merchantType)) {
      throw new KycValidationError(`Field ${field.key} is not applicable to this merchant type.`);
    }

    const lockedApp = await tx.kycApplication.update({
      where: { id: application.id },
      data: { updatedAt: new Date() },
      include: { cycles: { where: { isCurrentCycle: true } } }
    });
    
    const lockedCycle = resolveCurrentCycle(lockedApp);

    if (lockedCycle.status === "UNDER_REVIEW" || lockedCycle.status === "APPROVED") {
      throw new KycStateError(`Cannot modify application in ${lockedCycle.status} state.`);
    }
    if (lockedCycle.status === "REJECTED" && !lockedCycle.allowResubmission) {
      throw new KycStateError("Resubmission is not allowed for this application.");
    }

    const existingDocs = await tx.kycDocument.count({
      where: {
        submissionCycleId: lockedCycle.id,
        fieldDefinitionId: fieldDefinitionId
      }
    });

    if (existingDocs >= maxFiles) {
      throw new KycStateError("Maximum number of files exceeded for this field.");
    }

    return await tx.kycDocument.create({
      data: {
        submissionCycleId: lockedCycle.id,
        fieldDefinitionId,
        storageKey,
        originalFilename,
        mimeType: finalMime,
        sizeBytes: fileBuffer.length,
        status: "PENDING"
      }
    });
  });

  let physicalUploadSucceeded = false;
  try {
    await storageProvider.put(storageKey, fileBuffer);
    physicalUploadSucceeded = true;
    
    await db.kycDocument.update({
      where: { id: docRecord.id },
      data: { status: "UPLOADED" }
    });
    
    return docRecord;
  } catch (e: any) {
    if (physicalUploadSucceeded) {
      await storageProvider.delete(storageKey).catch(console.error);
    }
    await db.kycDocument.delete({ where: { id: docRecord.id } }).catch(console.error);
    throw e;
  }
}

export async function listKycDocuments(merchantProfileId: string) {
  const application = await db.kycApplication.findUnique({
    where: { merchantProfileId },
    include: { cycles: { where: { isCurrentCycle: true } } }
  });

  if (!application) return [];
  if (!application.cycles || application.cycles.length === 0) return [];
  const cycle = resolveCurrentCycle(application);

  const docs = await db.kycDocument.findMany({
    where: { submissionCycleId: cycle.id },
    select: {
      id: true,
      fieldDefinitionId: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
      status: true,
      createdAt: true
    }
  });

  return docs;
}

export async function getKycDocumentForDownload(merchantProfileId: string, documentId: string) {
  const application = await db.kycApplication.findUnique({
    where: { merchantProfileId },
    include: { cycles: { where: { isCurrentCycle: true } } }
  });
  if (!application) throw new ApplicationNotFoundError();
  const cycle = resolveCurrentCycle(application);

  const doc = await db.kycDocument.findUnique({
    where: {
      id: documentId,
      submissionCycleId: cycle.id
    }
  });

  if (!doc) throw new KycValidationError("Document not found");
  if (doc.status !== "UPLOADED") throw new KycValidationError("Document is not available for download");

  const buffer = await storageProvider.get(doc.storageKey);
  return {
    buffer,
    mimeType: doc.mimeType,
    originalFilename: doc.originalFilename
  };
}

export async function deleteKycDocument(merchantProfileId: string, documentId: string) {
  const docRecord = await db.$transaction(async (tx) => {
    let application = await tx.kycApplication.findUnique({
      where: { merchantProfileId },
      include: { cycles: { where: { isCurrentCycle: true } } }
    });
    if (!application) throw new ApplicationNotFoundError();

    application = await tx.kycApplication.update({
      where: { id: application.id },
      data: { updatedAt: new Date() },
      include: { cycles: { where: { isCurrentCycle: true } } }
    });

    const cycle = resolveCurrentCycle(application);

    if (cycle.status === "UNDER_REVIEW" || cycle.status === "APPROVED") {
      throw new KycStateError(`Cannot modify application in ${cycle.status} state.`);
    }
    if (cycle.status === "REJECTED" && !cycle.allowResubmission) {
      throw new KycStateError("Resubmission is not allowed for this application.");
    }

    const doc = await tx.kycDocument.findUnique({
      where: {
        id: documentId,
        submissionCycleId: cycle.id
      }
    });

    if (!doc) throw new KycValidationError("Document not found");

    await tx.kycDocument.delete({
      where: { id: doc.id }
    });

    return doc;
  });

  await storageProvider.delete(docRecord.storageKey);
}

export async function submitKycApplication(merchantProfileId: string) {
  const profile = await db.merchantProfile.findUnique({
    where: { id: merchantProfileId },
    select: { merchantType: true }
  });
  const merchantType = profile?.merchantType as MerchantType | undefined;
  if (!merchantType) throw new MerchantTypeMissingError();

  return await db.$transaction(async (tx) => {
    let application = await tx.kycApplication.findUnique({ 
      where: { merchantProfileId },
      include: { cycles: { where: { isCurrentCycle: true } } }
    });
    if (!application) throw new ApplicationNotFoundError();

    application = await tx.kycApplication.update({
      where: { id: application.id },
      data: { updatedAt: new Date() },
      include: { cycles: { where: { isCurrentCycle: true } } }
    });

    const cycle = resolveCurrentCycle(application);

    if (cycle.status === "UNDER_REVIEW" || cycle.status === "APPROVED") {
      throw new KycStateError(`Cannot submit application in ${cycle.status} state.`);
    }
    if (cycle.status === "REJECTED" && !cycle.allowResubmission) {
      throw new KycStateError("Resubmission is not allowed for this application.");
    }

    const fields = await tx.kycFieldDefinition.findMany({
      where: { formVersionId: cycle.formVersionId }
    });

    const applicableFields = fields.filter(f => f.applicableTypes.length === 0 || f.applicableTypes.includes(merchantType));

    const answers = await tx.kycAnswer.findMany({
      where: { submissionCycleId: cycle.id }
    });

    const documents = await tx.kycDocument.findMany({
      where: { submissionCycleId: cycle.id, status: "UPLOADED" }
    });

    const answerMap = new Map(answers.map(a => [a.fieldDefinitionId, a.value]));
    const docMap = new Map<string, number>();
    documents.forEach(d => {
      docMap.set(d.fieldDefinitionId, (docMap.get(d.fieldDefinitionId) || 0) + 1);
    });

    const errors: { fieldKey: string, message: string }[] = [];

    for (const field of applicableFields) {
      let isInactive = false;
      if (field.validationRules) {
        try {
          const rule = field.validationRules as any;
          if (rule.type === "REQUIRED_IF_EQUALS" && rule.targetFieldKey && rule.targetValue !== undefined) {
            const targetField = applicableFields.find(f => f.key === rule.targetFieldKey);
            if (!targetField) {
              isInactive = true;
            } else {
              const targetAnswerValue = answerMap.get(targetField.id);
              if (targetAnswerValue !== rule.targetValue) {
                isInactive = true;
              }
            }
          } else {
             errors.push({ fieldKey: field.key, message: "Invalid validation rule configuration." });
             continue;
          }
        } catch (e: any) {
          errors.push({ fieldKey: field.key, message: "Invalid validation rule configuration." });
          continue;
        }
      }

      if (isInactive) continue;

      if (field.isRequired) {
        if (field.dataType === "FILE") {
          const docCount = docMap.get(field.id) || 0;
          if (docCount < 1) {
            errors.push({ fieldKey: field.key, message: "File upload is required." });
          }
        } else {
          const value = answerMap.get(field.id);
          if (value === undefined || value === null || value === "") {
            errors.push({ fieldKey: field.key, message: "Answer is required." });
            continue;
          }
          if (typeof value === "string" && value.trim() === "") {
             errors.push({ fieldKey: field.key, message: "Answer is required." });
             continue;
          }

          try {
            validateFieldValue(field, value);
          } catch (e: any) {
            errors.push({ fieldKey: field.key, message: e.message || "Invalid answer." });
          }
        }
      } else {
        if (field.dataType !== "FILE") {
           const value = answerMap.get(field.id);
           if (value !== undefined && value !== null && value !== "") {
              if (typeof value === "string") {
                 if (value.trim() !== "") {
                    try {
                      validateFieldValue(field, value);
                    } catch (e: any) {
                      errors.push({ fieldKey: field.key, message: e.message || "Invalid answer." });
                    }
                 }
              } else {
                 try {
                   validateFieldValue(field, value);
                 } catch (e: any) {
                   errors.push({ fieldKey: field.key, message: e.message || "Invalid answer." });
                 }
              }
           }
        }
      }
    }

    if (errors.length > 0) {
      throw new KycCompletenessError(errors);
    }

    const previousStatus = cycle.status;

    const updatedCycle = await tx.kycSubmissionCycle.update({
      where: { id: cycle.id },
      data: {
        status: "UNDER_REVIEW",
        submittedAt: new Date()
      }
    });

    await logAction({
      actorType: AuditActorType.MERCHANT,
      actorId: merchantProfileId,
      entityType: AuditEntity.KYC_APPLICATION,
      entityId: application.id,
      action: AuditAction.UPDATE,
      metadata: {
        action: "SUBMIT_KYC",
        previousStatus,
        newStatus: "UNDER_REVIEW"
      }
    }, tx);

    return updatedCycle;
  });
}




