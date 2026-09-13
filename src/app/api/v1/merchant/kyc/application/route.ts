import { NextRequest, NextResponse } from "next/server";
import { requireMerchantContext, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { getMerchantKycApplication } from "@/modules/merchant/application/merchant-kyc.service";

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate & derive tenant context (Note: we use requireMerchantContext to allow pending/rejected KYC statuses)
    const context = await requireMerchantContext(req);

    if (context.accountStatus === "SUSPENDED" || context.accountStatus === "DELETED") {
      throw new ForbiddenError("Account is suspended or deleted");
    }

    // 2. Fetch scoped KYC application
    const application = await getMerchantKycApplication(context.merchantProfileId);

    return NextResponse.json({ success: true, data: application });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error("[GET /api/v1/merchant/kyc/application]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
