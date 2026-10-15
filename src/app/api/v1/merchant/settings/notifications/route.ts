import { logger } from "@/infrastructure/logger/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireMerchantContext, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { getNotificationPreferences, updateNotificationPreferences } from "@/modules/notifications/application/preference.service";
import { updateNotificationPreferenceSchema } from "@/modules/notifications/schemas/preference.schema";

export async function GET(req: NextRequest) {
  try {
    const context = await requireMerchantContext(req);

    if (context.accountStatus === "SUSPENDED" || context.accountStatus === "DELETED") {
      throw new ForbiddenError("Account is suspended or deleted");
    }

    const preferences = await getNotificationPreferences(context.userId);
    return NextResponse.json({ success: true, data: preferences });

  } catch (error: any) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      const fbErr = error as any;
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
    logger.error("[GET /api/v1/merchant/settings/notifications]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await requireMerchantContext(req);

    if (context.accountStatus === "SUSPENDED" || context.accountStatus === "DELETED") {
      throw new ForbiddenError("Account is suspended or deleted");
    }

    const body = await req.json().catch(() => ({}));

    // Strict validation
    const parsed = updateNotificationPreferenceSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues?.[0]?.message || "Validation failed";
      return NextResponse.json({ success: false, error: msg }, { status: 400 });
    }

    const input = parsed.data;

    if (Object.keys(input).length === 0) {
      return NextResponse.json({ success: false, error: "No valid fields provided for update" }, { status: 400 });
    }

    const updated = await updateNotificationPreferences(context.userId, input);
    return NextResponse.json({ success: true, data: updated });

  } catch (error: any) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof Error && error.name === "ForbiddenError") {
      const fbErr = error as any;
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
    logger.error("[PATCH /api/v1/merchant/settings/notifications]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
