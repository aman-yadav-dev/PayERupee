import { NextRequest, NextResponse } from "next/server";
import { requireFullMerchantAccess, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { revokeApiKey, KeyNotFoundError } from "@/modules/auth/application/api-key.service";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { merchantProfileId } = await requireFullMerchantAccess(req);

    const result = await revokeApiKey(merchantProfileId, (await params).id);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (error instanceof KeyNotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }

    console.error(`[DELETE /api/v1/merchant/api-keys/${(await params).id}]`, error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
