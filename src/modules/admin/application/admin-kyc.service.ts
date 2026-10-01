import { db } from "@/infrastructure/database/db";
import { KycStatus, AuditActorType, AuditEntity, AuditAction, Prisma } from "@prisma/client";
import { logAction } from "@/modules/audit/domain/audit.service";
import { LocalDiskStorageAdapter } from "@/infrastructure/storage/local-disk.adapter";
import { triggerImmediateEmailDispatch } from "@/modules/notifications/application/email-outbox.dispatcher";
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
    where.cycles = {
      some: {
        isCurrentCycle: true,
        status: status as KycStatus
      }
    };
  }

  const [total, applications] = await Promise.all([
    db.kycApplication.count({ where }),
    db.kycApplication.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        merchantProfileId: true,
        merchantProfile: { select: { user: { select: { name: true, email: true } } } },
        cycles: {
          where: { isCurrentCycle: true },
          take: 1,
          select: {
            status: true,
            submittedAt: true,
            reviewedAt: true,
            allowResubmission: true
          }
        }
      }
    })
  ]);

  const mapped = applications.map(app => {
    const active = app.cycles[0];
    return {
      id: app.id,
      merchantProfileId: app.merchantProfileId,
      status: active?.status || KycStatus.PENDING_SUBMISSION,
      submittedAt: active?.submittedAt || null,
      reviewedAt: active?.reviewedAt || null,
      allowResubmission: active?.allowResubmission || false,
      merchantProfile: app.merchantProfile
    };
  });

  return {
    data: mapped,
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
      cycles: {
        where: { isCurrentCycle: true },
        take: 1,
        include: {
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
      }
    }
  });

  if (!application) {
    throw new ApplicationNotFoundError();
  }

  const active = application.cycles[0];
  
  return {
    ...application,
    status: active?.status || KycStatus.PENDING_SUBMISSION,
    formVersion: active?.formVersion,
    answers: active?.answers || [],
    documents: active?.documents || []
  };
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
    where: { id: documentId },
    include: { cycle: true }
  });

  if (!doc || doc.cycle?.applicationId !== applicationId) {
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
  const result = await db.$transaction(async (tx) => {
    // Acquire parent-row lock
    const application = await tx.kycApplication.update({
      where: { id: applicationId },
      data: { updatedAt: new Date() },
      include: { 
        merchantProfile: { 
          include: { user: { include: { notificationPreference: true } } } 
        } 
      }
    });

    if (!application) {
      throw new ApplicationNotFoundError();
    }

    const activeCycles = await tx.kycSubmissionCycle.findMany({
      where: { applicationId, isCurrentCycle: true }
    });

    if (activeCycles.length !== 1) {
      throw new KycStateError("Could not resolve current KYC submission cycle.");
    }

    const currentCycle = activeCycles.pop()!;

    if (currentCycle.status !== KycStatus.UNDER_REVIEW) {
      throw new KycStateError(`Cannot approve application in ${currentCycle.status} state.`);
    }

    const updatedCycle = await tx.kycSubmissionCycle.update({
      where: { id: currentCycle.id },
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
        cycleId: currentCycle.id,
        cycleNumber: currentCycle.cycleNumber,
        previousStatus: KycStatus.UNDER_REVIEW,
        newStatus: KycStatus.APPROVED
      }
    }, tx);

    const kycEmailsEnabled = application.merchantProfile?.user?.notificationPreference?.kycEmailsEnabled ?? true;
    const userEmail = application.merchantProfile?.user?.email;
    const userName = application.merchantProfile?.user?.name;

    if (kycEmailsEnabled && userEmail && userName) {
      await tx.outboxEvent.create({
        data: {
          referenceType: "EMAIL_DISPATCH",
          referenceId: `KYC_APPROVE_${application.id}_v${currentCycle.cycleNumber}`,
          payload: {
            to: userEmail,
            subject: "KYC Application Approved",
            templateId: "KYC_APPROVED",
            templateVariables: { name: userName }
          }
        }
      });
    }

    return updatedCycle;
  });

  triggerImmediateEmailDispatch();
  return result;
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

  const result = await db.$transaction(async (tx) => {
    // Acquire parent-row lock
    const application = await tx.kycApplication.update({
      where: { id: applicationId },
      data: { updatedAt: new Date() },
      include: { 
        merchantProfile: { 
          include: { user: { include: { notificationPreference: true } } } 
        } 
      }
    });

    if (!application) {
      throw new ApplicationNotFoundError();
    }

    const activeCycles = await tx.kycSubmissionCycle.findMany({
      where: { applicationId, isCurrentCycle: true }
    });

    if (activeCycles.length !== 1) {
      throw new KycStateError("Could not resolve current KYC submission cycle.");
    }

    const currentCycle = activeCycles.pop()!;

    if (currentCycle.status !== KycStatus.UNDER_REVIEW) {
      throw new KycStateError(`Cannot reject application in ${currentCycle.status} state.`);
    }

    const updatedCycle = await tx.kycSubmissionCycle.update({
      where: { id: currentCycle.id },
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
        cycleId: currentCycle.id,
        cycleNumber: currentCycle.cycleNumber,
        previousStatus: KycStatus.UNDER_REVIEW,
        newStatus: KycStatus.REJECTED,
        reason: rejectionReason.trim(),
        allowResubmission
      }
    }, tx);

    const kycEmailsEnabled = application.merchantProfile?.user?.notificationPreference?.kycEmailsEnabled ?? true;
    const userEmail = application.merchantProfile?.user?.email;
    const userName = application.merchantProfile?.user?.name;

    if (kycEmailsEnabled && userEmail && userName) {
      const { env } = await import("@/config/env");
      await tx.outboxEvent.create({
        data: {
          referenceType: "EMAIL_DISPATCH",
          referenceId: `KYC_REJECT_${application.id}_v${currentCycle.cycleNumber}`,
          payload: {
            to: userEmail,
            subject: "Action Required: KYC Application Rejected",
            templateId: "KYC_REJECTED",
            templateVariables: { 
              name: userName,
              reason: rejectionReason.trim(),
              ctaLink: env.BETTER_AUTH_URL + "/kyc/rejected"
            }
          }
        }
      });
    }

    return updatedCycle;
  });

  triggerImmediateEmailDispatch();
  return result;
}

/**
 * Retrieve the audit history for a KYC application.
 */
export async function getKycApplicationAuditHistory(applicationId: string) {
  return await db.auditLog.findMany({
    where: {
      entityType: AuditEntity.KYC_APPLICATION,
      entityId: applicationId
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}
