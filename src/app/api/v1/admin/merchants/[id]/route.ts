import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { logger } from "@/infrastructure/logger/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req);
    const { id } = await params;

    const profile = await db.merchantProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            createdAt: true,
          },
        },
        wallet: {
          include: {
            ledgerAccount: true,
          },
        },
        merchantBanks: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
        apiKeys: {
          select: {
            id: true,
            environment: true,
            name: true,
            isActive: true,
            createdAt: true,
            lastUsedAt: true,
          },
        },
        kycApplication: {
          include: {
            cycles: {
              where: { isCurrentCycle: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ success: false, error: "Merchant profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    logger.error("[GET /api/v1/admin/merchants/[id]]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
