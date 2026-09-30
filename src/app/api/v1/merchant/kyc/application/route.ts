import { NextRequest, NextResponse } from "next/server";
import { requireMerchantContext, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { getMerchantKycApplication, initializeKycApplication, FormNotFoundError } from "@/modules/merchant/application/merchant-kyc.service";
import { z } from "zod";
import { MerchantType } from "@prisma/client";

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

const initializeSchema = z.object({
  merchantType: z.nativeEnum(MerchantType, {
    message: "Invalid merchant type selected"
  })
});

export async function POST(req: NextRequest) {
  try {
    const context = await requireMerchantContext(req);

    if (context.accountStatus === "SUSPENDED" || context.accountStatus === "DELETED") {
      throw new ForbiddenError("Account is suspended or deleted");
    }

    const body = await req.json();
    const parseResult = initializeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ success: false, error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const application = await initializeKycApplication(context.merchantProfileId, parseResult.data.merchantType);

    return NextResponse.json({ success: true, data: application });
  } catch (error: any) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (error instanceof FormNotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    
    if (error instanceof Error && error.message.includes("already established as")) {
       return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }

    console.error("[POST /api/v1/merchant/kyc/application]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const context = await requireMerchantContext(req);

    if (context.accountStatus === "SUSPENDED" || context.accountStatus === "DELETED") {
      throw new ForbiddenError("Account is suspended or deleted");
    }

    const body = await req.json();
    const parseResult = initializeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ success: false, error: parseResult.error.issues[0].message }, { status: 400 });
    }

    // Dynamic import to avoid circular dependencies if any, but since it's already in the file... wait, I need to import `updateKycMerchantType` or `KycStateError`.
    // I'll import it dynamically or just use it. Let's just import it at the top.
    const { updateKycMerchantType, KycStateError, ApplicationNotFoundError } = await import("@/modules/merchant/application/merchant-kyc.service");
    
    await updateKycMerchantType(context.merchantProfileId, parseResult.data.merchantType);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const { KycStateError, ApplicationNotFoundError } = await import("@/modules/merchant/application/merchant-kyc.service");
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (error instanceof ApplicationNotFoundError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    if (error instanceof KycStateError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }

    console.error("[PUT /api/v1/merchant/kyc/application]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
