import { NextRequest, NextResponse } from "next/server";
import { requireFullMerchantAccess, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { generateApiKey, listApiKeys, KeyLimitExceededError } from "@/modules/auth/application/api-key.service";
import { z } from "zod";
import { Environment } from "@prisma/client";

const createKeySchema = z.object({
  name: z.string().min(1).max(50),
  environment: z.enum([Environment.TEST, Environment.LIVE])
});

export async function POST(req: NextRequest) {
  try {
    const { merchantProfileId } = await requireFullMerchantAccess(req);

    const body = await req.json();
    const parseResult = createKeySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request data", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, environment } = parseResult.data;

    const result = await generateApiKey(merchantProfileId, name, environment);

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (error instanceof KeyLimitExceededError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }

    console.error("[POST /api/v1/merchant/api-keys]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { merchantProfileId } = await requireFullMerchantAccess(req);

    const keys = await listApiKeys(merchantProfileId);

    return NextResponse.json({ success: true, data: keys }, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    console.error("[GET /api/v1/merchant/api-keys]", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
