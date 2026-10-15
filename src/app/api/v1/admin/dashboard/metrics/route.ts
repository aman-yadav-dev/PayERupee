import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { logger } from "@/infrastructure/logger/logger";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const [
      activeMerchants,
      pendingKyc,
      pendingFunds,
      pendingWithdrawals,
      activeBans,
      payoutStats,
    ] = await Promise.all([
      db.merchantProfile.count({ where: { accountStatus: "ACTIVE" } }).catch(() => 0),
      db.kycSubmissionCycle.count({ where: { isCurrentCycle: true, status: "UNDER_REVIEW" } }).catch(() => 0),
      db.fundRequest.count({ where: { status: "PENDING" } }).catch(() => 0),
      db.withdrawal.count({ where: { status: "PENDING" } }).catch(() => 0),
      db.globalBan.count({ where: { status: "ACTIVE" } }).catch(() => 0),
      db.payout.aggregate({
        where: { status: "SUCCESS" },
        _sum: { amount: true },
        _count: true,
      }).catch(() => ({ _sum: { amount: null }, _count: 0 })),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        activeMerchants,
        pendingKyc,
        pendingFunds,
        pendingWithdrawals,
        activeBans,
        payoutVolume: payoutStats._sum.amount ? Number(payoutStats._sum.amount) : 0,
        payoutCount: payoutStats._count || 0,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    logger.error("[GET /api/v1/admin/dashboard/metrics]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
