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

    const result = await FundRequestService.approveRequest(id, user.id);

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
    if (err.message === "Not Found") {
      return NextResponse.json({ success: false, error: "Fund request not found" }, { status: 404 });
    }
    logger.error("[POST /api/v1/admin/fund-requests/[id]/approve]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

