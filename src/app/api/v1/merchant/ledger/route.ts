import { logger } from "@/infrastructure/logger/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireFullMerchantAccess, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate & derive tenant context securely
    const { merchantProfileId } = await requireFullMerchantAccess(req);

    // 2. Fetch the merchant's primary ledger account id via the Wallet
    const wallet = await db.wallet.findUnique({
      where: { merchantProfileId },
      select: { ledgerAccountId: true }
    });

    if (!wallet) {
      return NextResponse.json({ success: true, data: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 0 } });
    }
    const ledgerAccountId = wallet.ledgerAccountId;

    // 3. Parse basic pagination safely
    const url = new URL(req.url);
    const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
    const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
    
    const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const limit = isNaN(limitParam) || limitParam < 1 ? 20 : Math.min(100, limitParam);
    const skip = (page - 1) * limit;

    // 4. Fetch ledger entries where the merchant's account is either debit or credit
    const whereClause = {
      OR: [
        { debitAccountId: ledgerAccountId },
        { creditAccountId: ledgerAccountId }
      ]
    };

    const [entries, total] = await Promise.all([
      db.ledgerEntry.findMany({
        where: whereClause,
        orderBy: { id: "desc" }, // id is cuid, sorts chronologically
        take: limit,
        skip,
        select: {
          id: true,
          amount: true,
          debitAccountId: true,
          creditAccountId: true,
          purpose: true,
          referenceType: true,
          referenceId: true,
          description: true,
          payoutId: true,
        }
      }),
      db.ledgerEntry.count({ where: whereClause })
    ]);

    // Format entries for the frontend (adding a helper to know if it's a credit or debit for this merchant)
    const formattedEntries = entries.map(entry => ({
      ...entry,
      direction: entry.creditAccountId === ledgerAccountId ? "CREDIT" : "DEBIT",
    }));

    return NextResponse.json({
      success: true,
      data: formattedEntries,
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
    logger.error("[GET /api/v1/merchant/ledger]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
