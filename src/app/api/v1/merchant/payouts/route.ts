import { logger } from "@/infrastructure/logger/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireFullMerchantAccess, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { Prisma } from "@prisma/client";
import { parseTransactionsFilters, InvalidFilterError } from "@/modules/payout/application/transactions-filters";

export async function GET(req: NextRequest) {
  try {
    const { merchantProfileId } = await requireFullMerchantAccess(req);

    const url = new URL(req.url);
    const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
    const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
    
    const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const limit = isNaN(limitParam) || limitParam < 1 ? 20 : Math.min(100, limitParam);
    const skip = (page - 1) * limit;

    let whereClause: Prisma.PayoutWhereInput;
    try {
      whereClause = parseTransactionsFilters(req, merchantProfileId);
    } catch (err: any) {
      if (err instanceof InvalidFilterError) {
        return NextResponse.json({ success: false, error: err.message }, { status: 400 });
      }
      throw err;
    }

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
          accountHolderName: true,
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
    if (error instanceof Error && error.name === "ForbiddenError") {
      const fbErr = error as any;
      return NextResponse.json({
        success: false,
        error: {
          code: fbErr.code || "FORBIDDEN",
          message: fbErr.message,
          details: fbErr.details,
          action: fbErr.action
        }
      }, { status: 403 });
    }
    logger.error("[GET /api/v1/merchant/payouts]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
