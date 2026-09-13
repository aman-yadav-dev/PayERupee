import { NextRequest, NextResponse } from "next/server";
import { requireMerchantContext } from "@/modules/auth/application/session-auth.service";
import { 
  deleteKycDocument, 
  ApplicationNotFoundError, 
  KycStateError, 
  KycValidationError 
} from "@/modules/merchant/application/merchant-kyc.service";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireMerchantContext(req);
    await deleteKycDocument(session.merchantProfileId, params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof ApplicationNotFoundError || error instanceof KycValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    if (error instanceof KycStateError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.message === "Forbidden") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
