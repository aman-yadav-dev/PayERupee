import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { approveKycApplication } from "@/modules/admin/application/admin-kyc.service";
import { ApplicationNotFoundError, KycStateError } from "@/modules/merchant/application/merchant-kyc.service";

export async function POST(req: NextRequest, { params }: { params: { applicationId: string } }) {
  try {
    const session = await requireAdmin(req);
    const result = await approveKycApplication(session.user.id, params.applicationId);
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof ApplicationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof KycStateError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("[POST /api/v1/admin/kyc/applications/[id]/approve]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
