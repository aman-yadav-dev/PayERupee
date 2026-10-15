import { logger } from "@/infrastructure/logger/logger";
import { NextResponse } from "next/server";
import { formatDateTimeIST } from "@/lib/date";
import { requireFullMerchantAccess } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { parseWalletFilters, InvalidFilterError } from "@/modules/wallet/application/wallet-activity-filters";

export async function GET(request: Request) {
  try {
    const { merchantProfileId } = await requireFullMerchantAccess(request as any);

    const { queryFundRequests, queryWithdrawals, fundRequestsWhere, withdrawalsWhere } = parseWalletFilters(request as any, merchantProfileId);

    let fundRequests: any[] = [];
    let withdrawals: any[] = [];

    if (queryFundRequests) {
      fundRequests = await db.fundRequest.findMany({
        where: fundRequestsWhere,
        orderBy: { createdAt: "desc" }
      });
    }

    if (queryWithdrawals) {
      withdrawals = await db.withdrawal.findMany({
        where: withdrawalsWhere,
        orderBy: { createdAt: "desc" }
      });
    }

    // Map to unified structure
    const mappedFunds = fundRequests.map(f => ({
      id: f.id,
      type: "Add Money",
      reference: f.utrNumber || f.id,
      status: f.status === "APPROVED" ? "SUCCESS" : f.status === "REJECTED" ? "FAILED" : f.status,
      createdAt: f.createdAt,
      amount: Number(f.amount),
      paymentMode: f.paymentMode || "N/A"
    }));

    const mappedWithdrawals = withdrawals.map(w => ({
      id: w.id,
      type: "Withdraw",
      reference: w.bankReference || w.providerReference || w.id,
      status: w.status,
      createdAt: w.createdAt,
      amount: -Number(w.amount), // Express withdrawals as negative in export
      paymentMode: w.paymentMode || "N/A"
    }));

    const combined = [...mappedFunds, ...mappedWithdrawals].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return "";
      let str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        str = `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let csvContent = "Date,Type,Reference,Amount,Status,Payment Mode\n";
    
    for (const record of combined) {
      csvContent += `${escapeCSV(formatDateTimeIST(record.createdAt))},${escapeCSV(record.type)},${escapeCSV(record.reference)},${escapeCSV(record.amount)},${escapeCSV(record.status)},${escapeCSV(record.paymentMode)}\n`;
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="wallet-activity-${new Date().toISOString().split("T")[0]}.csv"`
      }
    });

  } catch (error: any) {
    if (error instanceof InvalidFilterError) {
      return new NextResponse(error.message, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return new NextResponse(error.message, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return new NextResponse(error.message, { status: 403 });
    }
    logger.error("[GET /api/v1/merchant/wallet/export]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
