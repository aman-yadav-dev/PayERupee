import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { AuditAction, AuditActorType, AuditEntity, Prisma } from "@prisma/client";
import { logger } from "@/infrastructure/logger/logger";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const actorType = searchParams.get("actorType")?.trim();
    const action = searchParams.get("action")?.trim();
    const entityType = searchParams.get("entityType")?.trim();
    const entityId = searchParams.get("entityId")?.trim();
    const startDate = searchParams.get("startDate")?.trim();
    const endDate = searchParams.get("endDate")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (actorType && Object.values(AuditActorType).includes(actorType as AuditActorType)) {
      where.actorType = actorType as AuditActorType;
    }

    if (action && Object.values(AuditAction).includes(action as AuditAction)) {
      where.action = action as AuditAction;
    }

    if (entityType && Object.values(AuditEntity).includes(entityType as AuditEntity)) {
      where.entityType = entityType as AuditEntity;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (startDate || endDate) {
      const createdAtFilter: Prisma.DateTimeFilter = {};
      if (startDate && !isNaN(Date.parse(startDate))) {
        createdAtFilter.gte = new Date(startDate);
      }
      if (endDate && !isNaN(Date.parse(endDate))) {
        const end = new Date(endDate);
        if (endDate.length <= 10) {
          end.setUTCHours(23, 59, 59, 999);
        }
        createdAtFilter.lte = end;
      }
      where.createdAt = createdAtFilter;
    }

    const [total, logs] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    logger.error("[GET /api/v1/admin/audit-logs]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
