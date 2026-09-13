import { NextRequest, NextResponse } from "next/server";
import { requireMerchantContext } from "@/modules/auth/application/session-auth.service";
import { 
  uploadKycDocument, 
  listKycDocuments, 
  ApplicationNotFoundError, 
  KycStateError, 
  KycValidationError 
} from "@/modules/merchant/application/merchant-kyc.service";

export async function POST(req: NextRequest) {
  try {
    const session = await requireMerchantContext(req);
    
    // Absolute upper bound to prevent DoS via massive payload buffering.
    // The actual semantic limit is enforced by the domain service based on field configuration.
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > 50 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: "Payload exceeds server absolute maximum" }, { status: 413 });
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (err) {
      return NextResponse.json({ success: false, error: "Invalid form data" }, { status: 400 });
    }

    const fieldId = formData.get("fieldId");
    const file = formData.get("file");

    if (!fieldId || typeof fieldId !== "string") {
      return NextResponse.json({ success: false, error: "Missing or invalid fieldId" }, { status: 400 });
    }
    if (!file || typeof file === "string") { 
      return NextResponse.json({ success: false, error: "Missing or invalid file" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const document = await uploadKycDocument(session.merchantProfileId, fieldId, buffer, file.name);

    return NextResponse.json({ success: true, document }, { status: 201 });
  } catch (error: any) {
    if (error instanceof ApplicationNotFoundError || error.name === "FormNotFoundError") {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 });
    }
    if (error instanceof KycStateError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    if (error.name === "InvalidMagicBytesError") {
      return NextResponse.json({ success: false, error: error.message }, { status: 415 });
    }
    if (error instanceof KycValidationError) {
      // If the domain throws a size error, map it to 413
      if (error.message.includes("maximum allowed size")) {
        return NextResponse.json({ success: false, error: error.message }, { status: 413 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    if (error.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireMerchantContext(req);
    const documents = await listKycDocuments(session.merchantProfileId);
    return NextResponse.json({ success: true, documents });
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
