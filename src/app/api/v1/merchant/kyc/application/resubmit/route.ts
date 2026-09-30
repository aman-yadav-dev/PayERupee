import { NextRequest, NextResponse } from "next/server";
import { requireMerchantContext, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { resubmitKycApplication, KycStateError, ApplicationNotFoundError, FormNotFoundError } from "@/modules/merchant/application/merchant-kyc.service";

export async function POST(req: NextRequest) {
  try {
    const context = await requireMerchantContext(req);

    if (context.accountStatus === "SUSPENDED" || context.accountStatus === "DELETED") {
      throw new ForbiddenError("Account is suspended or deleted");
    }

    const result = await resubmitKycApplication(context.merchantProfileId);

    return NextResponse.json({
      success: true,
      cycleId: result?.id,
      formVersionId: result?.formVersionId
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (error instanceof ApplicationNotFoundError || error instanceof FormNotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    if (error instanceof KycStateError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    
    console.error("[POST /api/v1/merchant/kyc/application/resubmit]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
