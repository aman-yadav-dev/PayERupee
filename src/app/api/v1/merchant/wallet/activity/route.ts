import { logger } from "@/infrastructure/logger/logger";
import { NextResponse } from "next/server";
import { requireFullMerchantAccess } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { parseWalletFilters, InvalidFilterError } from "@/modules/wallet/application/wallet-activity-filters";

export async function GET(request: Request) {
  try {
    const { merchantProfileId } = await requireFullMerchantAccess(request as any);

    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;

    const { queryFundRequests, queryWithdrawals, fundRequestsWhere, withdrawalsWhere } = parseWalletFilters(request as any, merchantProfileId);

    let fundRequests: any[] = [];
    let withdrawals: any[] = [];
    
    let totalFunds = 0;
    let totalWithdrawals = 0;

    if (queryFundRequests) {
      [totalFunds, fundRequests] = await Promise.all([
        db.fundRequest.count({ where: fundRequestsWhere }),
        db.fundRequest.findMany({
          where: fundRequestsWhere,
          orderBy: { createdAt: "desc" },
          take: skip + limit
        })
      ]);
    }

    if (queryWithdrawals) {
      [totalWithdrawals, withdrawals] = await Promise.all([
        db.withdrawal.count({ where: withdrawalsWhere }),
        db.withdrawal.findMany({
          where: withdrawalsWhere,
          orderBy: { createdAt: "desc" },
          take: skip + limit
        })
      ]);
    }

    const totalRecords = totalFunds + totalWithdrawals;
    const totalPages = Math.ceil(totalRecords / limit);

    // Map to unified structure
    const mappedFunds = fundRequests.map(f => ({
      id: f.id,
      type: "ADD_MONEY",
      reference: f.utrNumber || f.id,
      status: f.status === "APPROVED" ? "SUCCESS" : f.status === "REJECTED" ? "FAILED" : f.status,
      createdAt: f.createdAt,
      amount: f.amount,
      metadata: {
        paymentMode: f.paymentMode
      }
    }));

    const mappedWithdrawals = withdrawals.map(w => ({
      id: w.id,
      type: "WITHDRAWAL",
      reference: w.bankReference || w.providerReference || w.id,
      status: w.status,
      createdAt: w.createdAt,
      amount: w.amount,
      metadata: {
        paymentMode: w.paymentMode,
        fee: w.fee
      }
    }));

    const combined = [...mappedFunds, ...mappedWithdrawals]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(skip, skip + limit);

    return NextResponse.json({
      success: true,
      data: combined,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages
      }
    });

  } catch (error: any) {
    if (error instanceof InvalidFilterError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
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
    logger.error("[GET /api/v1/merchant/wallet/activity]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
