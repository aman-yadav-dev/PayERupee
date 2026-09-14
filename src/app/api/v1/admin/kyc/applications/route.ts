import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { listKycApplications } from "@/modules/admin/application/admin-kyc.service";
import { KycValidationError } from "@/modules/merchant/application/merchant-kyc.service";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const status = url.searchParams.get("status") || undefined;

    const result = await listKycApplications(page, limit, status);
    
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof KycValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[GET /api/v1/admin/kyc/applications]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
