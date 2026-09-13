import { db } from "@/infrastructure/database/db";
import { KycDataType, KycInputType } from "@prisma/client";

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
