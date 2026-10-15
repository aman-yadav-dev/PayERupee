import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { auth } from "@/modules/auth/infrastructure/auth";
import { db } from "@/infrastructure/database/db";
import { logAction } from "@/modules/audit/domain/audit.service";
import { AuditActorType, AuditEntity, AuditAction, UserRole, Prisma } from "@prisma/client";
import { z } from "zod";
import { logger } from "@/infrastructure/logger/logger";

const createAdminSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address").toLowerCase(),
  role: z.enum(["ADMIN", "SUPER_ADMIN"]),
  password: z.string().min(10, "Password must be at least 10 characters"),
});

/**
 * GET /api/v1/admin/admins
 * List all administrator accounts with server-side pagination, search, and active session counts.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireSuperAdmin(req);

    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
    const search = searchParams.get("search")?.trim() || "";
    const roleParam = searchParams.get("role")?.trim() || "";

    const where: Prisma.UserWhereInput = {
      role: roleParam && ["ADMIN", "SUPER_ADMIN"].includes(roleParam)
        ? (roleParam as UserRole)
        : { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, admins] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          emailVerified: true,
          _count: {
            select: { sessions: true },
          },
        },
        orderBy: [{ role: "desc" }, { createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: admins.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        role: a.role,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        emailVerified: a.emailVerified,
        activeSessionsCount: a._count.sessions,
        isCurrentActor: a.id === session.user.id,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    logger.error("[GET /api/v1/admin/admins]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * POST /api/v1/admin/admins
 * Provision a new administrator account (SUPER_ADMIN only).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requireSuperAdmin(req);

    const body = await req.json().catch(() => ({}));
    const parsed = createAdminSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, name, role, password } = parsed.data;

    // Check if email already registered
    const existing = await db.user.findUnique({
      where: { email },
      select: { id: true, role: true },
    });

    if (existing) {
      if (existing.role === UserRole.MERCHANT) {
        return NextResponse.json(
          {
            success: false,
            error: "User is already registered as a Merchant. Silent promotion of merchant accounts is prohibited.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: "An administrator with this email address already exists." },
        { status: 409 }
      );
    }

    // Provision securely via Better Auth to ensure standard password hashing and salting
    const created = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
    });

    if (!created?.user?.id) {
      throw new Error("Authentication provider failed to create user record.");
    }

    // Set role to requested administrative role and mark verified
    const adminUser = await db.user.update({
      where: { id: created.user.id },
      data: {
        role: role as UserRole,
        emailVerified: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    // Audit log
    await logAction({
      actorType: AuditActorType.ADMIN,
      actorId: session.user.id,
      entityType: AuditEntity.USER,
      entityId: adminUser.id,
      action: AuditAction.CREATE,
      metadata: {
        createdAdminEmail: adminUser.email,
        createdAdminRole: adminUser.role,
        provisionedBySuperAdminId: session.user.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: adminUser,
        message: `Successfully provisioned ${adminUser.role} account for ${adminUser.email}`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    logger.error("[POST /api/v1/admin/admins]", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
