import { formatDateTimeIST } from "@/lib/date";
import { NextRequest, NextResponse } from "next/server";
import { requireFullMerchantAccess, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { Prisma } from "@prisma/client";
import { parseTransactionsFilters, InvalidFilterError } from "@/modules/payout/application/transactions-filters";

export async function GET(req: NextRequest) {
  try {
    const { merchantProfileId } = await requireFullMerchantAccess(req);

    let whereClause: Prisma.PayoutWhereInput;
    try {
      whereClause = parseTransactionsFilters(req, merchantProfileId);
    } catch (err: any) {
      if (err instanceof InvalidFilterError) {
        return NextResponse.json({ success: false, error: err.message }, { status: 400 });
      }
      throw err;
    }

    const payouts = await db.payout.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
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
    });

    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const headers = [
      "Transaction ID", "Idempotency Key", "Amount", "Fee", "Tax", "Total Debit", 
      "Status", "Payment Mode", "Account Holder", "Provider Reference", "Created At", "Updated At"
    ];

    const lines = [
      headers.map(escape).join(","),
      ...payouts.map(p => [
        p.id,
        p.idempotencyKey,
        p.amount.toString(),
        p.fee.toString(),
        p.tax.toString(),
        p.totalDebitAmount.toString(),
        p.status,
        p.paymentMode,
        p.accountHolderName,
        p.providerReference,
        formatDateTimeIST(p.createdAt),
        p.updatedAt.toISOString(),
      ].map(escape).join(","))
    ];

    const csvData = lines.join("\n");

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="transactions_export_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error: any) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
