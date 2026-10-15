import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { PayoutStatus, Prisma } from "@prisma/client";
import { logger } from "@/infrastructure/logger/logger";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim();
    const merchantProfileId = searchParams.get("merchantProfileId")?.trim();
    const startDate = searchParams.get("startDate")?.trim();
    const endDate = searchParams.get("endDate")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.PayoutWhereInput = {};

    if (status && Object.values(PayoutStatus).includes(status as PayoutStatus)) {
      where.status = status as PayoutStatus;
    }

    if (merchantProfileId) {
      where.merchantProfileId = merchantProfileId;
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

    if (search) {
      where.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { providerReference: { contains: search, mode: "insensitive" } },
        { bankReference: { contains: search, mode: "insensitive" } },
        { vpa: { contains: search, mode: "insensitive" } },
        { accountNumber: { contains: search, mode: "insensitive" } },
        { accountHolderName: { contains: search, mode: "insensitive" } },
        { merchantProfile: { businessName: { contains: search, mode: "insensitive" } } },
        { merchantProfile: { user: { email: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const [total, payouts] = await Promise.all([
      db.payout.count({ where }),
      db.payout.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          merchantProfileId: true,
          merchantProfile: {
            select: {
              businessName: true,
              user: { select: { email: true, name: true } },
            },
          },
          amount: true,
          fee: true,
          totalDebitAmount: true,
          paymentMode: true,
          status: true,
          accountNumber: true,
          ifscCode: true,
          vpa: true,
          accountHolderName: true,
          provider: true,
          providerReference: true,
          bankReference: true,
          failureReason: true,
          providerFailureDetails: true,
          createdAt: true,
          processedAt: true,
        },
      }),
    ]);

    // Mask sensitive account numbers for destination privacy
    const mapped = payouts.map((p) => {
      let maskedDestination = "";
      if (p.paymentMode === "UPI" && p.vpa) {
        const parts = p.vpa.split("@");
        const userPart = parts[0];
        const handle = parts[1] || "";
        maskedDestination = `${userPart.slice(0, 2)}***@${handle}`;
      } else if (p.accountNumber) {
        maskedDestination = `•••• •••• ${p.accountNumber.slice(-4)}`;
      }

      return {
        ...p,
        providerId: p.provider,
        providerReferenceId: p.providerReference,
        utrNumber: p.bankReference,
        maskedDestination,
        accountNumber: p.accountNumber ? `•••• •••• ${p.accountNumber.slice(-4)}` : null,
      };
    });

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
    logger.error("[GET /api/v1/admin/payouts]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
