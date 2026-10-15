import { logger } from "@/infrastructure/logger/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireMerchantContext } from "@/modules/auth/application/session-auth.service";
import { 
  submitKycApplication, 
  ApplicationNotFoundError, 
  MerchantTypeMissingError, 
  FormNotFoundError, 
  KycStateError, 
  KycCompletenessError 
} from "@/modules/merchant/application/merchant-kyc.service";

export async function POST(req: NextRequest) {
  try {
    const context = await requireMerchantContext(req);
    const updatedApp = await submitKycApplication(context.merchantProfileId);
    return NextResponse.json({ success: true, application: updatedApp }, { status: 200 });
  } catch (error: any) {
    if (error.name === "UnauthorizedError") {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error.name === "ForbiddenError") {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (error instanceof ApplicationNotFoundError || error instanceof FormNotFoundError || error instanceof MerchantTypeMissingError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    if (error instanceof KycStateError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    if (error instanceof KycCompletenessError) {
      return NextResponse.json({ success: false, errors: error.errors }, { status: 422 });
    }
    logger.error("KYC Submission Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
