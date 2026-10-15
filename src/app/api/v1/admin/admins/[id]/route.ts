import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, UnauthorizedError, ForbiddenError, revokeAllUserSessions } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { logAction } from "@/modules/audit/domain/audit.service";
import { AuditActorType, AuditEntity, AuditAction, UserRole } from "@prisma/client";
import { z } from "zod";
import { logger } from "@/infrastructure/logger/logger";

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "SUPER_ADMIN"]),
});

/**
 * PATCH /api/v1/admin/admins/[id]
 * Update administrator role (SUPER_ADMIN only).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSuperAdmin(req);
    const { id: targetId } = await params;

    const body = await req.json().catch(() => ({}));
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { role: newRole } = parsed.data;

    const targetUser = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!targetUser || (targetUser.role !== UserRole.ADMIN && targetUser.role !== UserRole.SUPER_ADMIN)) {
      return NextResponse.json(
        { success: false, error: "Administrator account not found." },
        { status: 404 }
      );
    }

    // Safeguard: Last SUPER_ADMIN protection
    if (targetUser.role === UserRole.SUPER_ADMIN && newRole !== UserRole.SUPER_ADMIN) {
      const superAdminCount = await db.user.count({
        where: { role: UserRole.SUPER_ADMIN },
      });

      if (superAdminCount <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot demote the only remaining SUPER_ADMIN. Another Super Administrator must be designated first.",
          },
          { status: 403 }
        );
      }
    }

    const updated = await db.user.update({
      where: { id: targetId },
      data: { role: newRole as UserRole },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        updatedAt: true,
      },
    });

    // Write audit log
    await logAction({
      actorType: AuditActorType.ADMIN,
      actorId: session.user.id,
      entityType: AuditEntity.USER,
      entityId: targetId,
      action: AuditAction.UPDATE,
      metadata: {
        previousRole: targetUser.role,
        newRole: updated.role,
        modifiedBySuperAdminId: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Updated ${updated.email} role from ${targetUser.role} to ${updated.role}`,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    logger.error("[PATCH /api/v1/admin/admins/[id]]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/admin/admins/[id]
 * Revoke administrator access and evict all active sessions (SUPER_ADMIN only).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSuperAdmin(req);
    const { id: targetId } = await params;

    // Safeguard: Cannot delete own account
    if (session.user.id === targetId) {
      return NextResponse.json(
        { success: false, error: "Self-deletion prohibited. You cannot delete your own administrator account." },
        { status: 403 }
      );
    }

    const targetUser = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!targetUser || (targetUser.role !== UserRole.ADMIN && targetUser.role !== UserRole.SUPER_ADMIN)) {
      return NextResponse.json(
        { success: false, error: "Administrator account not found." },
        { status: 404 }
      );
    }

    // Safeguard: Last SUPER_ADMIN protection
    if (targetUser.role === UserRole.SUPER_ADMIN) {
      const superAdminCount = await db.user.count({
        where: { role: UserRole.SUPER_ADMIN },
      });

      if (superAdminCount <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot delete the only remaining SUPER_ADMIN. Platform governance requires at least one active Super Administrator.",
          },
          { status: 403 }
        );
      }
    }

    // Execute atomic revocation and session teardown in a transaction
    await db.$transaction(async (tx) => {
      // 1. Revoke all active sessions
      await revokeAllUserSessions(targetId, tx);

      // 2. Demote role to MERCHANT (or delete user record if no relations exist)
      await tx.user.update({
        where: { id: targetId },
        data: { role: UserRole.MERCHANT },
      });

      // 3. Write immutable audit log
      await logAction(
        {
          actorType: AuditActorType.ADMIN,
          actorId: session.user.id,
          entityType: AuditEntity.USER,
          entityId: targetId,
          action: AuditAction.DELETE,
          metadata: {
            revokedAdminEmail: targetUser.email,
            revokedAdminRole: targetUser.role,
            executedBySuperAdminId: session.user.id,
            sessionsRevoked: true,
          },
        },
        tx
      );
    });

    return NextResponse.json({
      success: true,
      message: `Successfully revoked administrative privileges for ${targetUser.email}. All active sessions have been terminated.`,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    logger.error("[DELETE /api/v1/admin/admins/[id]]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
