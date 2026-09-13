import { NextRequest, NextResponse } from "next/server";
import { requireMerchantContext, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { 
  saveKycAnswers, 
  MerchantTypeMissingError, 
  FormNotFoundError, 
  KycStateError, 
  KycValidationError 
} from "@/modules/merchant/application/merchant-kyc.service";
import { z } from "zod";

const draftAnswersSchema = z.object({
  answers: z.array(
    z.object({
      fieldId: z.string().min(1),
      value: z.any()
    })
  ).min(1, "At least one answer must be provided")
});

export async function PUT(req: NextRequest) {
  try {
    // 1. Authenticate & derive tenant context 
    const context = await requireMerchantContext(req);

    if (context.accountStatus === "SUSPENDED" || context.accountStatus === "DELETED") {
      throw new ForbiddenError("Account is suspended or deleted");
    }

    // 2. Parse request body
    const body = await req.json();
    const parseResult = draftAnswersSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ success: false, error: parseResult.error.issues[0].message }, { status: 400 });
    }

    // 3. Save answers
    const result = await saveKycAnswers(context.merchantProfileId, parseResult.data.answers);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (error instanceof MerchantTypeMissingError || error instanceof KycValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error instanceof KycStateError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    if (error instanceof FormNotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    console.error("[PUT /api/v1/merchant/kyc/answers]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
