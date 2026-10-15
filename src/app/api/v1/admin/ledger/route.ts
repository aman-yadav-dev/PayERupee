import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { LedgerAccountType, LedgerEntryPurpose, Prisma, ReferenceType } from "@prisma/client";
import { logger } from "@/infrastructure/logger/logger";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const purpose = searchParams.get("purpose")?.trim();
    const referenceType = searchParams.get("referenceType")?.trim();
    const startDate = searchParams.get("startDate")?.trim();
    const endDate = searchParams.get("endDate")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const skip = (page - 1) * limit;

    // 1. Fetch system account summaries
    const [transitAccounts, revenueAccounts, merchantAccountsAgg, pendingDisbursementsAgg] = await Promise.all([
      db.ledgerAccount.findMany({
        where: { type: LedgerAccountType.SYSTEM_TRANSIT },
        select: { id: true, type: true, currency: true, isActive: true, createdAt: true },
      }),
      db.ledgerAccount.findMany({
        where: { type: LedgerAccountType.SYSTEM_REVENUE },
        select: { id: true, type: true, currency: true, isActive: true, createdAt: true },
      }),
      db.wallet.aggregate({
        _sum: { balance: true },
        _count: true,
      }),
      db.payout.aggregate({
        where: { status: { in: ["PENDING", "PROCESSING"] } },
        _sum: { totalDebitAmount: true },
      }),
    ]);

    // 2. Fetch recent ledger entries with pagination
    const where: Prisma.LedgerEntryWhereInput = {};
    if (purpose && Object.values(LedgerEntryPurpose).includes(purpose as LedgerEntryPurpose)) {
      where.purpose = purpose as LedgerEntryPurpose;
    }
    if (referenceType && Object.values(ReferenceType).includes(referenceType as ReferenceType)) {
      where.referenceType = referenceType as ReferenceType;
    }
    if (startDate || endDate) {
      const createdAtFilter: Prisma.DateTimeFilter = {};
      if (startDate && !isNaN(Date.parse(startDate))) {
        createdAtFilter.gte = new Date(startDate);
      }
      if (endDate && !isNaN(Date.parse(endDate))) {
        const end = new Date(endDate);
        if (endDate.length <= 10) {
          end.setUTCHours(23, 59, 59, 999);
        }
        createdAtFilter.lte = end;
      }
      where.createdAt = createdAtFilter;
    }

    const [totalEntries, entries] = await Promise.all([
      db.ledgerEntry.count({ where }),
      db.ledgerEntry.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
        include: {
          debitAccount: {
            select: { id: true, type: true, currency: true, merchantProfileId: true },
          },
          creditAccount: {
            select: { id: true, type: true, currency: true, merchantProfileId: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          systemTransitCount: transitAccounts.length,
          systemRevenueCount: revenueAccounts.length,
          totalMerchantLiability: merchantAccountsAgg._sum?.balance ? Number(merchantAccountsAgg._sum.balance) : 0,
          totalMerchantLocked: pendingDisbursementsAgg._sum?.totalDebitAmount ? Number(pendingDisbursementsAgg._sum.totalDebitAmount) : 0,
          activeMerchantWallets: merchantAccountsAgg._count || 0,
        },
        entries,
      },
      meta: {
        total: totalEntries,
        page,
        limit,
        totalPages: Math.ceil(totalEntries / limit),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    logger.error("[GET /api/v1/admin/ledger]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
