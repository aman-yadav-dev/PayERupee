import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { AccountStatus, Prisma } from "@prisma/client";
import { logger } from "@/infrastructure/logger/logger";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.MerchantProfileWhereInput = {};

    if (status && Object.values(AccountStatus).includes(status as AccountStatus)) {
      where.accountStatus = status as AccountStatus;
    }

    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [total, profiles] = await Promise.all([
      db.merchantProfile.count({ where }),
      db.merchantProfile.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          businessName: true,
          phone: true,
          accountStatus: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              emailVerified: true,
            },
          },
          wallet: {
            select: {
              id: true,
              balance: true,
              currency: true,
            },
          },
          kycApplication: {
            select: {
              id: true,
              cycles: {
                where: { isCurrentCycle: true },
                take: 1,
                select: {
                  status: true,
                  submittedAt: true,
                  reviewedAt: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const mapped = profiles.map((p) => ({
      id: p.id,
      businessName: p.businessName,
      phone: p.phone,
      accountStatus: p.accountStatus,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      user: p.user,
      wallet: p.wallet,
      kycStatus: p.kycApplication?.cycles[0]?.status || "PENDING_SUBMISSION",
      kycSubmittedAt: p.kycApplication?.cycles[0]?.submittedAt || null,
    }));

    return NextResponse.json({
      success: true,
      data: mapped,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    logger.error("[GET /api/v1/admin/merchants]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
