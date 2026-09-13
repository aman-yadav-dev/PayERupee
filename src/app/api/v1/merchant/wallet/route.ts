import { NextRequest, NextResponse } from "next/server";
import { requireFullMerchantAccess, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate & derive tenant context securely on the server
    const { merchantProfileId } = await requireFullMerchantAccess(req);

    // 2. Fetch scoped wallet
    const wallet = await db.wallet.findUnique({
      where: { merchantProfileId },
      select: {
        id: true,
        currency: true,
        balance: true,
        isActive: true,
        updatedAt: true,
      }
    });

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: "Wallet not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: wallet });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error("[GET /api/v1/merchant/wallet]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
