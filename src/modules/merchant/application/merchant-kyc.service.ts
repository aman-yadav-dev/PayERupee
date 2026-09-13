import { db } from "@/infrastructure/database/db";
import { KycDataType, KycInputType } from "@prisma/client";
import { LocalDiskStorageAdapter } from "@/infrastructure/storage/local-disk.adapter";
import crypto from "crypto";

const storageProvider = new LocalDiskStorageAdapter();

export class ApplicationNotFoundError extends Error {
  constructor() {
    super("KYC application not found.");
    this.name = "ApplicationNotFoundError";
  }
}

export class FormNotFoundError extends Error {
  constructor() {
    super("No applicable published KYC form found.");
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

export async function getMerchantKycApplication(merchantProfileId: string) {
  const application = await db.kycApplication.findUnique({
    where: { merchantProfileId },
    select: {
      id: true,
      status: true,
      formVersionId: true,
      submittedAt: true,
      reviewedAt: true,
      rejectionReason: true,
      allowResubmission: true,
      createdAt: true,
      updatedAt: true,
      answers: {
        select: {
          fieldDefinitionId: true,
          value: true
        }
      }
    }
  });

  return application; // Can be null, which is standard when an application hasn't been created
}

export async function getActiveKycForm(merchantProfileId: string) {
  const profile = await db.merchantProfile.findUnique({
    where: { id: merchantProfileId },
    select: { merchantType: true }
  });

  if (!profile?.merchantType) {
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
    field.applicableTypes.length === 0 || field.applicableTypes.includes(profile.merchantType!)
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
      section: f.section,
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

export async function saveKycAnswers(merchantProfileId: string, answers: { fieldId: string, value: any }[]) {
  const profile = await db.merchantProfile.findUnique({
    where: { id: merchantProfileId },
    select: { merchantType: true }
  });

  if (!profile?.merchantType) {
    throw new MerchantTypeMissingError();
  }

  // Find or create application
  let application = await db.kycApplication.findUnique({ where: { merchantProfileId } });

  if (!application) {
    // If we need to create one, find the currently active form
    const formVersion = await db.kycFormVersion.findFirst({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" }
    });

    if (!formVersion) {
      throw new FormNotFoundError();
    }

    application = await db.kycApplication.create({
      data: {
        merchantProfileId,
        formVersionId: formVersion.id,
        status: "PENDING_SUBMISSION",
        allowResubmission: true
      }
    });
  }

  // Validate State
  if (application.status === "UNDER_REVIEW" || application.status === "APPROVED") {
    throw new KycStateError(`Cannot modify application in ${application.status} state.`);
  }

  if (application.status === "REJECTED" && !application.allowResubmission) {
    throw new KycStateError("Resubmission is not allowed for this application.");
  }

  let activeFormVersionId: string | null = null;
  if (!application) {
    const formVersion = await db.kycFormVersion.findFirst({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" }
    });
    activeFormVersionId = formVersion?.id ?? null;
  } else {
    activeFormVersionId = application.formVersionId;
  }

  if (!activeFormVersionId) {
    throw new FormNotFoundError();
  }

  // Fetch the fields for this application's form version
  const formFields = await db.kycFieldDefinition.findMany({
    where: { formVersionId: activeFormVersionId }
  });

  const validAnswers = [];

  for (const ans of answers) {
    const field = formFields.find(f => f.id === ans.fieldId);

    if (!field) {
      throw new KycValidationError(`Field ${ans.fieldId} does not exist in this form version.`);
    }

    if (field.applicableTypes.length > 0 && !field.applicableTypes.includes(profile.merchantType)) {
      throw new KycValidationError(`Field ${field.key} is not applicable to merchant type ${profile.merchantType}.`);
    }

    // Since this is a DRAFT, we skip isRequired validation.
    // However, if a value IS provided (not null/undefined/empty string), we must validate its type.
    if (ans.value !== null && ans.value !== undefined && ans.value !== "") {

      // Basic type validation
      if (field.dataType === "STRING") {
        if (typeof ans.value !== "string") throw new KycValidationError(`Field ${field.key} expects a string.`);
      } else if (field.dataType === "NUMBER") {
        if (typeof ans.value !== "number" || isNaN(ans.value)) throw new KycValidationError(`Field ${field.key} expects a number.`);
      } else if (field.dataType === "BOOLEAN") {
        if (typeof ans.value !== "boolean") throw new KycValidationError(`Field ${field.key} expects a boolean.`);
      } else if (field.dataType === "DATE") {
        if (typeof ans.value !== "string" || isNaN(Date.parse(ans.value))) throw new KycValidationError(`Field ${field.key} expects a valid ISO date string.`);
      } else if (field.dataType === "FILE") {
        throw new KycValidationError(`File upload is not supported in this phase.`);
      } else {
        throw new KycValidationError(`Unsupported data type ${field.dataType} for field ${field.key}.`);
      }

      // SELECT validation
      if (field.inputType === "SELECT") {
        const options = field.selectOptions as string[] | undefined;
        if (options && Array.isArray(options)) {
          if (!options.includes(ans.value as string)) {
            throw new KycValidationError(`Value '${ans.value}' is not a valid option for field ${field.key}.`);
          }
        }
      }

      validAnswers.push({
        applicationId: application.id,
        fieldDefinitionId: field.id,
        value: ans.value
      });
    }
  }

  // Upsert all valid answers safely in a transaction
  if (validAnswers.length > 0) {
    await db.$transaction(
      validAnswers.map(ans => db.kycAnswer.upsert({
        where: {
          applicationId_fieldDefinitionId: {
            applicationId: ans.applicationId,
            fieldDefinitionId: ans.fieldDefinitionId
          }
        },
        create: ans,
        update: { value: ans.value }
      }))
    );
  }

  return { applicationId: application.id, status: application.status, savedCount: validAnswers.length };
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

export async function uploadKycDocument(merchantProfileId: string, fieldId: string, buffer: Buffer, originalFilename: string) {
  const profile = await db.merchantProfile.findUnique({
    where: { id: merchantProfileId },
    select: { merchantType: true }
  });

  if (!profile?.merchantType) throw new MerchantTypeMissingError();

  const application = await db.kycApplication.findUnique({ where: { merchantProfileId } });
  if (!application) throw new ApplicationNotFoundError();

  if (application.status === "UNDER_REVIEW" || application.status === "APPROVED") {
    throw new KycStateError(`Cannot modify application in ${application.status} state.`);
  }
  if (application.status === "REJECTED" && !application.allowResubmission) {
    throw new KycStateError("Resubmission is not allowed for this application.");
  }

  if (!application.formVersionId) throw new FormNotFoundError();

  const field = await db.kycFieldDefinition.findUnique({
    where: { id: fieldId }
  });

  if (!field || field.formVersionId !== application.formVersionId) {
    throw new KycValidationError("Invalid field definition.");
  }
  if (field.dataType !== "FILE") {
    throw new KycValidationError("Field is not a FILE type.");
  }
  if (field.applicableTypes.length > 0 && !field.applicableTypes.includes(profile.merchantType)) {
    throw new KycValidationError("Field not applicable to this merchant type.");
  }

  const mimeType = detectMimeType(buffer);
  if (!mimeType) {
    throw new InvalidMagicBytesError();
  }

  const fileRules = field.fileRules as any || {};
  const maxFiles = fileRules.maxFiles || 1;
  const maxSize = fileRules.maxSize || 5 * 1024 * 1024; // Default 5MB

  if (buffer.length > maxSize) {
    throw new KycValidationError("File exceeds maximum allowed size.");
  }

  const docRecord = await db.$transaction(async (tx) => {
    // Acquire row-level lock on the application
    await tx.kycApplication.update({
      where: { id: application.id },
      data: { updatedAt: new Date() }
    });

    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    const count = await tx.kycDocument.count({
      where: {
        applicationId: application.id,
        fieldDefinitionId: field.id,
        OR: [
          { status: "UPLOADED" },
          { status: "PENDING", createdAt: { gte: fiveMinsAgo } }
        ]
      }
    });

    if (count >= maxFiles) {
      throw new KycStateError("Maximum number of files exceeded for this field.");
    }

    const uuid = crypto.randomUUID();
    const storageKey = `kyc_documents/${application.id}/${uuid}`;

    return tx.kycDocument.create({
      data: {
        applicationId: application.id,
        fieldDefinitionId: field.id,
        storageKey,
        originalFilename: originalFilename.substring(0, 255), // Sanitize max length
        mimeType,
        sizeBytes: buffer.length,
        status: "PENDING"
      }
    });
  });

  // Perform physical storage write
  try {
    await storageProvider.put(docRecord.storageKey, buffer, docRecord.mimeType);
  } catch (error) {
    // We explicitly do NOT delete the DB record here. We leave it as PENDING.
    throw error;
  }

  // Update DB to UPLOADED
  const updatedDoc = await db.kycDocument.update({
    where: { id: docRecord.id },
    data: { status: "UPLOADED" }
  });

  return {
    id: updatedDoc.id,
    originalFilename: updatedDoc.originalFilename,
    mimeType: updatedDoc.mimeType,
    sizeBytes: updatedDoc.sizeBytes,
    createdAt: updatedDoc.createdAt
  };
}

export async function listKycDocuments(merchantProfileId: string) {
  const application = await db.kycApplication.findUnique({
    where: { merchantProfileId },
    select: { id: true }
  });

  if (!application) return [];

  const docs = await db.kycDocument.findMany({
    where: { applicationId: application.id },
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
    select: { id: true }
  });
  if (!application) throw new ApplicationNotFoundError();

  const doc = await db.kycDocument.findUnique({
    where: {
      id: documentId,
      applicationId: application.id
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
  const application = await db.kycApplication.findUnique({
    where: { merchantProfileId },
    select: { id: true, status: true, allowResubmission: true }
  });
  if (!application) throw new ApplicationNotFoundError();

  if (application.status === "UNDER_REVIEW" || application.status === "APPROVED") {
    throw new KycStateError(`Cannot modify application in ${application.status} state.`);
  }
  if (application.status === "REJECTED" && !application.allowResubmission) {
    throw new KycStateError("Resubmission is not allowed for this application.");
  }

  const doc = await db.kycDocument.findUnique({
    where: {
      id: documentId,
      applicationId: application.id
    }
  });

  if (!doc) throw new KycValidationError("Document not found");

  // DB Delete First
  await db.kycDocument.delete({
    where: { id: doc.id }
  });

  // Storage Delete Second
  await storageProvider.delete(doc.storageKey);
}
