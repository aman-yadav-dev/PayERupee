import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { Prisma, WithdrawalStatus } from "@prisma/client";
import { logger } from "@/infrastructure/logger/logger";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const statusParam = searchParams.get("status")?.trim();
    const merchantProfileId = searchParams.get("merchantProfileId")?.trim();
    const startDate = searchParams.get("startDate")?.trim();
    const endDate = searchParams.get("endDate")?.trim();

    const where: Prisma.WithdrawalWhereInput = {};

    if (statusParam && statusParam !== "ALL") {
      let targetStatus: WithdrawalStatus | undefined;
      const upper = statusParam.toUpperCase();
      if (upper === "APPROVED" || upper === "SUCCESS") {
        targetStatus = WithdrawalStatus.SUCCESS;
      } else if (upper === "REJECTED" || upper === "FAILED") {
        targetStatus = WithdrawalStatus.FAILED;
      } else if (Object.values(WithdrawalStatus).includes(upper as WithdrawalStatus)) {
        targetStatus = upper as WithdrawalStatus;
      }
      if (targetStatus) {
        where.status = targetStatus;
      } else {
        where.status = { in: [] };
      }
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

    if (merchantProfileId) {
      where.merchantProfileId = merchantProfileId;
    }

    const [total, withdrawals] = await Promise.all([
      db.withdrawal.count({ where }),
      db.withdrawal.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          merchantProfile: {
            include: {
              user: {
                select: { email: true, name: true },
              },
            },
          },
          merchantBank: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: withdrawals,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    if (error instanceof UnauthorizedError || (error instanceof Error && error.name === "UnauthorizedError")) {
      return NextResponse.json({ success: false, error: (error as Error).message }, { status: 401 });
    }
    if (error instanceof ForbiddenError || (error instanceof Error && error.name === "ForbiddenError")) {
      return NextResponse.json({ success: false, error: (error as Error).message }, { status: 403 });
    }
    logger.error("[GET /api/v1/admin/withdrawals]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
