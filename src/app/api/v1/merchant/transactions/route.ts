import { logger } from "@/infrastructure/logger/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireFullMerchantAccess } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { Prisma } from "@prisma/client";
import { parseTransactionsFilters, InvalidFilterError } from "@/modules/payout/application/transactions-filters";
import { maskDestination } from "@/lib/masking";

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
    } catch (e: any) {
      if (e instanceof InvalidFilterError) {
        return NextResponse.json({ success: false, error: e.message }, { status: 400 });
      }
      throw e;
    }

    const [totalRecords, payouts] = await Promise.all([
      db.payout.count({ where: whereClause }),
      db.payout.findMany({
        where: whereClause,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
      })
    ]);

    const mappedTransactions = payouts.map(p => ({
      id: p.id,
      type: "PAYOUT",
      reference: p.merchantReference || p.id,
      amount: p.amount.toString(),
      fee: p.fee.toString(),
      tax: p.tax.toString(),
      totalDebitAmount: p.totalDebitAmount.toString(),
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      paymentMode: p.paymentMode,
      destination: {
        accountName: p.accountHolderName,
        accountNumber: maskDestination(p.accountNumber),
        ifscCode: p.ifscCode,
        vpa: p.vpa
      },
      failureReason: p.failureReason
    }));

    return NextResponse.json({
      success: true,
      data: mappedTransactions,
      pagination: {
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
        currentPage: page,
        limit
      }
    });

  } catch (error: any) {
    if (error.name === "UnauthorizedError") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (error.name === "ForbiddenError") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    logger.error("Transactions API Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
