import { NextRequest, NextResponse } from "next/server";
import {
  requireFullMerchantAccess,
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
import { BanRequestStatus } from "@prisma/client";
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

export async function GET(req: NextRequest) {
  try {
    const auth = await requireFullMerchantAccess(req);
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");

    let status: BanRequestStatus | undefined;
    if (statusParam) {
      const upper = statusParam.toUpperCase();
      if (upper in BanRequestStatus) {
        status = upper as BanRequestStatus;
      } else {
        return NextResponse.json(
          { success: false, error: `Invalid status parameter. Must be one of: ${Object.values(BanRequestStatus).join(", ")}` },
          { status: 400 }
        );
      }
    }

    const requests = await BanService.listMerchantGlobalBanRequests(auth, status ? { status } : undefined);
    return NextResponse.json({ success: true, data: requests }, { status: 200 });
  } catch (error) {
    return handleBanError(error, "GET /api/v1/merchant/bans/requests");
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireFullMerchantAccess(req);
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const auditContext = extractAuditContext(req);
    const result = await BanService.createGlobalBanRequest(auth, body as Parameters<typeof BanService.createGlobalBanRequest>[1], auditContext);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return handleBanError(error, "POST /api/v1/merchant/bans/requests");
  }
}
