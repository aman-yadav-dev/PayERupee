import { NextRequest, NextResponse } from "next/server";
import { db } from "@/infrastructure/database/db";
import { requireMerchantContext } from "@/modules/auth/application/session-auth.service";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const { merchantProfileId } = await requireMerchantContext(req);

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const [events, total] = await Promise.all([
      db.securityEvent.findMany({
        where: { merchantProfileId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      db.securityEvent.count({ where: { merchantProfileId } })
    ]);

    return NextResponse.json({
      success: true,
      data: events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    if (error.name === "UnauthorizedError") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
