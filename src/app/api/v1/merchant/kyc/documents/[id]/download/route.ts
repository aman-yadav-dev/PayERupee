import { NextRequest, NextResponse } from "next/server";
import { requireMerchantContext } from "@/modules/auth/application/session-auth.service";
import { 
  getKycDocumentForDownload, 
  ApplicationNotFoundError, 
  KycValidationError 
} from "@/modules/merchant/application/merchant-kyc.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireMerchantContext(req);
    const doc = await getKycDocumentForDownload(session.merchantProfileId, (await params).id);
    
    // Sanitize filename to prevent HTTP Response Splitting
    const safeName = doc.originalFilename.replace(/[\r\n`"]/g, "");
    const encodedName = encodeURIComponent(safeName);

    return new NextResponse(doc.buffer as any, {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": "attachment; filename*=UTF-8''" + encodedName
      }
    });
  } catch (error: any) {
    if (error instanceof ApplicationNotFoundError || error instanceof KycValidationError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    if (error.message === "Unauthorized") return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    if (error.message === "Forbidden") return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });

    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
