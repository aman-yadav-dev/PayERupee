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
} from "@/modules/ban/domain/ban.service";
import { BanCryptoValidationError } from "@/modules/ban/application/ban-crypto.service";
import { BanRequestStatus } from "@prisma/client";
import { logger } from "@/infrastructure/logger/logger";

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
    const session = await requireAdmin(req);
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

    const requests = await BanService.listGlobalBanRequests(
      session.user.id,
      status ? { status } : undefined
    );
    return NextResponse.json({ success: true, data: requests }, { status: 200 });
  } catch (error) {
    return handleBanError(error, "GET /api/v1/admin/bans/requests");
  }
}
