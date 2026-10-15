import { logger } from "@/infrastructure/logger/logger";
import { NextResponse } from "next/server";
import { requireFullMerchantAccess } from "@/modules/auth/application/session-auth.service";
import { FundRequestService, DuplicateUtrError } from "@/modules/wallet/application/fund-request.service";
import { db } from "@/infrastructure/database/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const fundRequestSchema = z.object({
  amount: z.number().positive(),
  utrNumber: z.string().min(5).max(50),
  paymentMode: z.enum(["UPI", "IMPS", "NEFT", "RTGS"]),
  receiptUrl: z.string().url().optional(),
  remarks: z.string().max(255).optional()
});

export async function POST(request: Request) {
  try {
    const { merchantProfileId } = await requireFullMerchantAccess(request as any);
    const body = await request.json();

    const parsed = fundRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    const fundRequest = await FundRequestService.createRequest(merchantProfileId, {
      ...parsed.data,
      amount: new Prisma.Decimal(parsed.data.amount)
    });

    return NextResponse.json({ success: true, data: fundRequest }, { status: 201 });

  } catch (error: any) {
    if (error instanceof DuplicateUtrError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    if (error.name === "UnauthorizedError") {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error.name === "ForbiddenError") {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    logger.error("[POST /api/v1/merchant/fund-requests]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
