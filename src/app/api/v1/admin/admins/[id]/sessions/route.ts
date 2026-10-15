import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, UnauthorizedError, ForbiddenError, revokeAllUserSessions } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { logAction } from "@/modules/audit/domain/audit.service";
import { AuditActorType, AuditEntity, AuditAction, UserRole } from "@prisma/client";
import { logger } from "@/infrastructure/logger/logger";

/**
 * DELETE /api/v1/admin/admins/[id]/sessions
 * Hard-revoke all browser sessions for a designated administrator (SUPER_ADMIN only).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSuperAdmin(req);
    const { id: targetId } = await params;

    const targetUser = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, role: true },
    });

    if (!targetUser || (targetUser.role !== UserRole.ADMIN && targetUser.role !== UserRole.SUPER_ADMIN)) {
      return NextResponse.json(
        { success: false, error: "Administrator account not found." },
        { status: 404 }
      );
    }

    const sessionCount = await db.session.count({
      where: { userId: targetId },
    });

    // Revoke all sessions
    await revokeAllUserSessions(targetId);

    // Audit log
    await logAction({
      actorType: AuditActorType.ADMIN,
      actorId: session.user.id,
      entityType: AuditEntity.USER,
      entityId: targetId,
      action: AuditAction.PROCESS,
      metadata: {
        operation: "REVOKE_ALL_SESSIONS",
        targetEmail: targetUser.email,
        targetRole: targetUser.role,
        revokedSessionCount: sessionCount,
        executedBySuperAdminId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Revoked ${sessionCount} active session(s) for ${targetUser.email}`,
      revokedCount: sessionCount,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    logger.error("[DELETE /api/v1/admin/admins/[id]/sessions]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
