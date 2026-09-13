import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { approveMerchantAccount, AdminMerchantNotFoundError, AdminMerchantStateConflictError } from "@/modules/admin/domain/admin-merchant.service";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // 1. Authenticate & strictly enforce ADMIN role
    const session = await requireAdmin(req);

    // 2. Execute approval transaction
    const merchantId = params.id;
    const result = await approveMerchantAccount(session.user.id, merchantId);

    // 3. Return success
    return NextResponse.json({ success: true, data: result }, { status: 200 });

  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (error instanceof AdminMerchantNotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    if (error instanceof AdminMerchantStateConflictError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }

    console.error("[POST /api/v1/admin/merchants/[id]/approve]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
