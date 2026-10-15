import { logger } from "@/infrastructure/logger/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireMerchantContext, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { getActiveKycForm, MerchantTypeMissingError, FormNotFoundError } from "@/modules/merchant/application/merchant-kyc.service";

export async function GET(req: NextRequest) {
  try {
    // 1. Authenticate & derive tenant context (Note: we use requireMerchantContext to allow pending/rejected KYC statuses)
    const context = await requireMerchantContext(req);

    if (context.accountStatus === "SUSPENDED" || context.accountStatus === "DELETED") {
      throw new ForbiddenError("Account is suspended or deleted");
    }

    // 2. Fetch scoped published KYC form
    const form = await getActiveKycForm(context.merchantProfileId);

    return NextResponse.json({ success: true, data: form });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      const fbErr = error as Error & { code?: string; details?: unknown; action?: unknown };
      return NextResponse.json({
        success: false,
        error: {
          code: fbErr.code || "FORBIDDEN",
          message: fbErr.message,
          details: fbErr.details,
          action: fbErr.action
        }
      }, { status: 403 });
    }
    if (error instanceof MerchantTypeMissingError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error instanceof FormNotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    logger.error("[GET /api/v1/merchant/kyc/form]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
