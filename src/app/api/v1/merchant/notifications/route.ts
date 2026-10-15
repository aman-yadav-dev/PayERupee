import { logger } from "@/infrastructure/logger/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireMerchantContext, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";

export async function GET(req: NextRequest) {
  try {
    const { merchantProfileId } = await requireMerchantContext(req);

    const welcomeCount = await db.notification.count({
      where: { merchantProfileId, type: "WELCOME" }
    });

    if (welcomeCount === 0) {
      await db.notification.create({
        data: {
          merchantProfileId,
          type: "WELCOME",
          title: "Welcome to PayERupee",
          message: "Your merchant dashboard is ready. You can now track transactions, monitor performance, and export data securely.",
          read: false
        }
      });
    }

    const notifications = await db.notification.findMany({
      where: { merchantProfileId },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    const unreadCount = await db.notification.count({
      where: { merchantProfileId, read: false }
    });

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (error: any) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    logger.error("[GET /api/v1/merchant/notifications]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { merchantProfileId } = await requireMerchantContext(req);
    const body = await req.json().catch(() => ({}));

    if (body.markAllRead) {
      await db.notification.updateMany({
        where: { merchantProfileId, read: false },
        data: { read: true }
      });
      return NextResponse.json({ success: true });
    }

    if (body.id) {
      await db.notification.updateMany({
        where: { id: body.id, merchantProfileId },
        data: { read: true }
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Missing markAllRead or id" }, { status: 400 });
  } catch (error: any) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    logger.error("[PATCH /api/v1/merchant/notifications]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
