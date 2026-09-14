import { db } from "@/infrastructure/database/db";
import { KycStatus, AuditActorType, AuditEntity, AuditAction, Prisma } from "@prisma/client";
import { logAction } from "@/modules/audit/domain/audit.service";
import { LocalDiskStorageAdapter } from "@/infrastructure/storage/local-disk.adapter";
const storageProvider = new LocalDiskStorageAdapter();
import { ApplicationNotFoundError, KycStateError, KycValidationError } from "@/modules/merchant/application/merchant-kyc.service";

/**
 * List KYC applications with pagination and optional status filter.
 */
export async function listKycApplications(page: number = 1, limit: number = 20, status?: string) {
  if (limit > 100) limit = 100;
  if (page < 1) page = 1;

  const where: Prisma.KycApplicationWhereInput = {};
  if (status) {
    if (!Object.values(KycStatus).includes(status as KycStatus)) {
      throw new KycValidationError("Invalid status filter");
    }
    where.status = status as KycStatus;
  }

  const [total, applications] = await Promise.all([
    db.kycApplication.count({ where }),
    db.kycApplication.findMany({
      where,
      orderBy: [
        { submittedAt: 'desc' },
        { createdAt: 'desc' }
      ],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        merchantProfileId: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        allowResubmission: true
      }
    })
  ]);

  return {
    data: applications,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get detailed view of a KYC application for admin review.
 */
export async function getKycApplicationDetail(applicationId: string) {
  const application = await db.kycApplication.findUnique({
    where: { id: applicationId },
    include: {
      merchantProfile: {
        select: {
          id: true,
          merchantType: true,
          accountStatus: true,
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      },
      formVersion: {
        include: {
          fields: true
        }
      },
      answers: true,
      documents: {
        select: {
          id: true,
          fieldDefinitionId: true,
          status: true,
          originalFilename: true,
          mimeType: true,
          createdAt: true,
          updatedAt: true
        }
      }
    }
  });

  if (!application) {
    throw new ApplicationNotFoundError();
  }

  return application;
}

/**
 * Securely download a KYC document.
 */
export async function downloadAdminKycDocument(applicationId: string, documentId: string) {
  const application = await db.kycApplication.findUnique({
    where: { id: applicationId },
    select: { id: true }
  });
  if (!application) throw new ApplicationNotFoundError();

  const doc = await db.kycDocument.findUnique({
    where: { id: documentId }
  });

  if (!doc || doc.applicationId !== applicationId) {
    throw new KycValidationError("Document not found or mismatch");
  }

  if (doc.status !== "UPLOADED") {
    throw new KycValidationError("Document is not uploaded");
  }

  const buffer = await storageProvider.get(doc.storageKey);
  return {
    buffer,
    mimeType: doc.mimeType,
    originalFilename: doc.originalFilename
  };
}

/**
 * Approve a KYC application.
 */
export async function approveKycApplication(adminUserId: string, applicationId: string) {
  return await db.$transaction(async (tx) => {
    let application = await tx.kycApplication.findUnique({
      where: { id: applicationId }
    });

    if (!application) {
      throw new ApplicationNotFoundError();
    }

    // Acquire parent-row lock
    application = await tx.kycApplication.update({
      where: { id: applicationId },
      data: { updatedAt: new Date() }
    });

    if (application.status !== KycStatus.UNDER_REVIEW) {
      throw new KycStateError(`Cannot approve application in ${application.status} state.`);
    }

    const updatedApp = await tx.kycApplication.update({
      where: { id: applicationId },
      data: {
        status: KycStatus.APPROVED,
        reviewerId: adminUserId,
        reviewedAt: new Date()
      }
    });

    await logAction({
      actorType: AuditActorType.ADMIN,
      actorId: adminUserId,
      entityType: AuditEntity.KYC_APPLICATION,
      entityId: applicationId,
      action: AuditAction.APPROVE,
      metadata: {
        previousStatus: KycStatus.UNDER_REVIEW,
        newStatus: KycStatus.APPROVED
      }
    }, tx);

    return updatedApp;
  });
}

/**
 * Reject a KYC application.
 */
export async function rejectKycApplication(
  adminUserId: string, 
  applicationId: string, 
  rejectionReason: string, 
  allowResubmission: boolean
) {
  if (!rejectionReason || rejectionReason.trim().length === 0) {
    throw new KycValidationError("Rejection reason is required.");
  }
  if (rejectionReason.length > 1000) {
    throw new KycValidationError("Rejection reason exceeds maximum length of 1000.");
  }
  if (typeof allowResubmission !== "boolean") {
    throw new KycValidationError("allowResubmission must be a boolean.");
  }

  return await db.$transaction(async (tx) => {
    let application = await tx.kycApplication.findUnique({
      where: { id: applicationId }
    });

    if (!application) {
      throw new ApplicationNotFoundError();
    }

    // Acquire parent-row lock
    application = await tx.kycApplication.update({
      where: { id: applicationId },
      data: { updatedAt: new Date() }
    });

    if (application.status !== KycStatus.UNDER_REVIEW) {
      throw new KycStateError(`Cannot reject application in ${application.status} state.`);
    }

    const updatedApp = await tx.kycApplication.update({
      where: { id: applicationId },
      data: {
        status: KycStatus.REJECTED,
        rejectionReason: rejectionReason.trim(),
        allowResubmission,
        reviewerId: adminUserId,
        reviewedAt: new Date()
      }
    });

    await logAction({
      actorType: AuditActorType.ADMIN,
      actorId: adminUserId,
      entityType: AuditEntity.KYC_APPLICATION,
      entityId: applicationId,
      action: AuditAction.REJECT,
      metadata: {
        previousStatus: KycStatus.UNDER_REVIEW,
        newStatus: KycStatus.REJECTED,
        reason: rejectionReason.trim(),
        allowResubmission
      }
    }, tx);

    return updatedApp;
  });
}
