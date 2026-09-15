import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { downloadAdminKycDocument } from "@/modules/admin/application/admin-kyc.service";
import { ApplicationNotFoundError, KycValidationError } from "@/modules/merchant/application/merchant-kyc.service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ applicationId: string, documentId: string }> }) {
  try {
    await requireAdmin(req);
    const result = await downloadAdminKycDocument((await params).applicationId, (await params).documentId);
    
    const safeName = result.originalFilename.replace(/[\r\n`"]/g, "");
    const encodedName = encodeURIComponent(safeName);

    return new NextResponse(result.buffer as any, {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": "attachment; filename*=UTF-8''" + encodedName
      }
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof ApplicationNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof KycValidationError) {
      if (error.message.includes("not uploaded") || error.message.includes("PENDING")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[GET /api/v1/admin/kyc/applications/[id]/documents/[docId]/download]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
