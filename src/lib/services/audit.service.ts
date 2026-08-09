import { Prisma, AuditActorType, AuditEntity, AuditAction } from "@prisma/client";
import { db } from "@/lib/db";

export type AuditLogInput = {
  actorType: AuditActorType;
  actorId?: string;
  entityType: AuditEntity;
  entityId: string;
  action: AuditAction;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Standardized interface for creating an audit log.
 * Accepts an optional Prisma transaction client.
 */
export async function logAction(
  input: AuditLogInput,
  tx: Prisma.TransactionClient = db
) {
  return tx.auditLog.create({
    data: {
      actorType: input.actorType,
      actorId: input.actorId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: input.metadata || Prisma.JsonNull,
    },
  });
}
