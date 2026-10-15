import { logger } from "@/infrastructure/logger/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { FundRequestStatus, Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.FundRequestWhereInput = {};
    if (status && status !== "ALL") {
      if (Object.values(FundRequestStatus).includes(status as FundRequestStatus)) {
        where.status = status as FundRequestStatus;
      }
    }

    const [total, requests] = await Promise.all([
      db.fundRequest.count({ where }),
      db.fundRequest.findMany({
        where,
        include: {
          merchantProfile: {
            include: { user: { select: { email: true, name: true } } }
          },
          approvedBy: { select: { email: true, name: true } }
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit
      })
    ]);

    const meta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };

    return NextResponse.json({
      success: true,
      data: requests,
      meta,
      pagination: meta, // backward-compat alias
    });

  } catch (error: unknown) {
    if (error instanceof UnauthorizedError || (error instanceof Error && error.name === "UnauthorizedError")) {
      return NextResponse.json({ success: false, error: (error as Error).message }, { status: 401 });
    }
    if (error instanceof ForbiddenError || (error instanceof Error && error.name === "ForbiddenError")) {
      return NextResponse.json({ success: false, error: (error as Error).message }, { status: 403 });
    }
    logger.error("[GET /api/v1/admin/fund-requests]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
