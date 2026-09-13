import { NextRequest, NextResponse } from "next/server";
import { authenticateSession, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate & derive tenant context securely
    const { merchantProfileId } = await authenticateSession(req);

    // 2. Parse basic pagination safely
    const url = new URL(req.url);
    const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
    const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
    
    const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const limit = isNaN(limitParam) || limitParam < 1 ? 20 : Math.min(100, limitParam);
    const skip = (page - 1) * limit;

    // Optional filters (e.g., status)
    const statusParam = url.searchParams.get("status");
    const whereClause: Prisma.PayoutWhereInput = {
      merchantProfileId, // Strict isolation
    };

    if (statusParam) {
      whereClause.status = statusParam as any;
    }

    // 3. Fetch data and count
    const [payouts, total] = await Promise.all([
      db.payout.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
        select: {
          id: true,
          idempotencyKey: true,
          amount: true,
          fee: true,
          tax: true,
          totalDebitAmount: true,
          status: true,
          paymentMode: true,
          providerReference: true,
          createdAt: true,
          updatedAt: true,
        }
      }),
      db.payout.count({ where: whereClause })
    ]);

    return NextResponse.json({
      success: true,
      data: payouts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error("[GET /api/v1/merchant/payouts]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
