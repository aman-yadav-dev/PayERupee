import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { getKycApplicationDetail } from "@/modules/admin/application/admin-kyc.service";
import { ApplicationNotFoundError } from "@/modules/merchant/application/merchant-kyc.service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ applicationId: string }> }) {
  try {
    await requireAdmin(req);
    const result = await getKycApplicationDetail((await params).applicationId);
    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof ApplicationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    console.error("[GET /api/v1/admin/kyc/applications/[id]]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
