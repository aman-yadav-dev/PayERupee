import { logger } from "@/infrastructure/logger/logger";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/modules/auth/application/session-auth.service";
import { FundRequestService, InvalidStateError } from "@/modules/wallet/application/fund-request.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireAdmin(request);
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { reason?: string };

    const result = await FundRequestService.rejectRequest(id, user.id, body.reason);

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof InvalidStateError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    const err = error as { name?: string; message?: string };
    if (err.name === "UnauthorizedError") {
      return NextResponse.json({ success: false, error: err.message || "Unauthorized" }, { status: 401 });
    }
    if (err.name === "ForbiddenError") {
      return NextResponse.json({ success: false, error: err.message || "Forbidden" }, { status: 403 });
    }
    logger.error("[POST /api/v1/admin/fund-requests/[id]/reject]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

