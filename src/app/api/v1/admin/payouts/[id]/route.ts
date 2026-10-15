
import { logger } from "@/infrastructure/logger/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const resolvedParams = await params;
    const payoutId = resolvedParams.id;

    const payout = await db.payout.findUnique({
      where: { id: payoutId },
      include: {
        ledgerEntries: true,
      }
    });

    if (!payout) {
      return NextResponse.json({ success: false, error: "Payout not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, payout }, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    
    logger.error("Admin payout lookup error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

