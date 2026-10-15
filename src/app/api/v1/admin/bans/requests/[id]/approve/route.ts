import { NextRequest, NextResponse } from "next/server";
import {
  requireAdmin,
  UnauthorizedError,
  ForbiddenError,
} from "@/modules/auth/application/session-auth.service";
import {
  BanService,
  BanValidationError,
  BanNotFoundError,
  DuplicateBanError,
  InvalidBanStateError,
  BanAuthorizationError,
  BanAuditContext,
} from "@/modules/ban/domain/ban.service";
import { BanCryptoValidationError } from "@/modules/ban/application/ban-crypto.service";
import { logger } from "@/infrastructure/logger/logger";

function extractAuditContext(req: Request | NextRequest): BanAuditContext {
  const forwarded = req.headers.get("x-forwarded-for");
  const ipAddress = forwarded
    ? forwarded.split(",")[0].trim()
    : req.headers.get("x-real-ip") || undefined;
  const userAgent = req.headers.get("user-agent") || undefined;
  return { ipAddress, userAgent };
}

function handleBanError(error: unknown, route: string) {
  const errName = error instanceof Error ? error.name : "";
  const errMessage = error instanceof Error ? error.message : "Internal Server Error";

  if (error instanceof UnauthorizedError || errName === "UnauthorizedError") {
    return NextResponse.json(
      { success: false, error: errMessage || "Unauthorized" },
      { status: 401 }
    );
  }
  if (
    error instanceof ForbiddenError ||
    error instanceof BanAuthorizationError ||
    errName === "ForbiddenError" ||
    errName === "BanAuthorizationError"
  ) {
    return NextResponse.json(
      { success: false, error: errMessage || "Forbidden" },
      { status: 403 }
    );
  }
  if (
    error instanceof BanValidationError ||
    error instanceof BanCryptoValidationError ||
    errName === "BanValidationError" ||
    errName === "BanCryptoValidationError"
  ) {
    return NextResponse.json(
      { success: false, error: errMessage },
      { status: 400 }
    );
  }
  if (error instanceof BanNotFoundError || errName === "BanNotFoundError") {
    return NextResponse.json(
      { success: false, error: errMessage },
      { status: 404 }
    );
  }
  if (
    error instanceof DuplicateBanError ||
    error instanceof InvalidBanStateError ||
    errName === "DuplicateBanError" ||
    errName === "InvalidBanStateError"
  ) {
    return NextResponse.json(
      { success: false, error: errMessage },
      { status: 409 }
    );
  }
  logger.error(`[${route}] error:`, error);
  return NextResponse.json({ success: false, error: errMessage }, { status: 500 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin(req);
    const { id } = await params;
    let body: { reviewNotes?: string } | undefined;
    try {
      const text = await req.text();
      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const auditContext = extractAuditContext(req);
    const globalBan = await BanService.approveGlobalBanRequest(
      session.user.id,
      id,
      body?.reviewNotes,
      auditContext
    );
    return NextResponse.json({ success: true, data: globalBan }, { status: 200 });
  } catch (error) {
    return handleBanError(error, "POST /api/v1/admin/bans/requests/[id]/approve");
  }
}
