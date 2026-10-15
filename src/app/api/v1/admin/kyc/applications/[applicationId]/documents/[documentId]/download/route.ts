import { logger } from "@/infrastructure/logger/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/modules/auth/application/session-auth.service";
import { downloadAdminKycDocument } from "@/modules/admin/application/admin-kyc.service";
import { ApplicationNotFoundError, KycValidationError } from "@/modules/merchant/application/merchant-kyc.service";
import { logAction } from "@/modules/audit/domain/audit.service";
import { AuditActorType, AuditEntity, AuditAction } from "@prisma/client";

export async function GET(req: NextRequest, { params }: { params: Promise<{ applicationId: string, documentId: string }> }) {
  try {
    const session = await requireAdmin(req);
    const resolvedParams = await params;
    const result = await downloadAdminKycDocument(resolvedParams.applicationId, resolvedParams.documentId);
    
    const safeName = result.originalFilename.replace(/[\r\n`"]/g, "");
    const encodedName = encodeURIComponent(safeName);

    await logAction({
      actorType: AuditActorType.ADMIN,
      actorId: session.user.id,
      entityType: AuditEntity.KYC_APPLICATION,
      entityId: resolvedParams.applicationId,
      action: AuditAction.PROCESS,
      metadata: {
        documentId: resolvedParams.documentId,
        filename: safeName,
        operation: "DOCUMENT_DOWNLOAD",
      },
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": "attachment; filename*=UTF-8''" + encodedName,
      },
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
    logger.error("[GET /api/v1/admin/kyc/applications/[id]/documents/[docId]/download]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
