import { logger } from "@/infrastructure/logger/logger";
import { formatDateTimeIST } from "@/lib/date";
import { NextRequest, NextResponse } from "next/server";
import { requireFullMerchantAccess } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { Prisma } from "@prisma/client";
import { parseTransactionsFilters, InvalidFilterError } from "@/modules/payout/application/transactions-filters";
import { maskDestination } from "@/lib/masking";

export async function GET(req: NextRequest) {
  try {
    const { merchantProfileId } = await requireFullMerchantAccess(req);

    let whereClause: Prisma.PayoutWhereInput;
    try {
      whereClause = parseTransactionsFilters(req, merchantProfileId);
    } catch (e: any) {
      if (e instanceof InvalidFilterError) {
        return new NextResponse(`Bad Request: ${e.message}`, { status: 400 });
      }
      throw e;
    }

    const payouts = await db.payout.findMany({
      where: whereClause,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    const rows: string[] = [];
    
    // Headers
    rows.push([
      "Date",
      "Transaction ID",
      "Merchant Reference",
      "Amount",
      "Fee",
      "Tax",
      "Total Debited",
      "Payment Mode",
      "Destination Account",
      "IFSC",
      "Status",
      "Provider",
      "Provider Reference",
      "Failure Reason"
    ].map(escapeCSV).join(","));

    // Rows
    for (const p of payouts) {
      const maskedAccount = maskDestination(p.accountNumber) || "";

      rows.push([
        formatDateTimeIST(p.createdAt),
        p.id,
        p.merchantReference || "",
        p.amount.toString(),
        p.fee.toString(),
        p.tax.toString(),
        p.totalDebitAmount.toString(),
        p.paymentMode,
        maskedAccount,
        p.ifscCode,
        p.status,
        p.provider || "",
        p.providerReference || "",
        p.failureReason || ""
      ].map(escapeCSV).join(","));
    }

    const csvContent = "\uFEFF" + rows.join("\n"); // UTF-8 BOM
    
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="transactions-${dateStr}.csv"`,
      },
    });

  } catch (error: any) {
    if (error.name === "UnauthorizedError" || error.name === "ForbiddenError") {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    logger.error("Transactions Export Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

function escapeCSV(val: string | null | undefined): string {
  if (!val) return "";
  let str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
