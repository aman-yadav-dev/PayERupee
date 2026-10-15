import { NextResponse } from "next/server";
import { requireAdmin } from "@/modules/auth/application/session-auth.service";
import { WithdrawalService, InvalidStateError } from "@/modules/wallet/application/withdrawal.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireAdmin(request);

    const withdrawal = await WithdrawalService.approveWithdrawal(id, session.user.id);
    return NextResponse.json({ success: true, data: withdrawal });
  } catch (error: unknown) {
    if (error instanceof InvalidStateError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    const err = error as { name?: string; message?: string };
    if (err.name === "UnauthorizedError") {
      return NextResponse.json({ success: false, error: err.message || "Unauthorized" }, { status: 401 });
    }
    if (err.name === "ForbiddenError") {
      return NextResponse.json({ success: false, error: err.message || "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: err.message || "Error approving withdrawal" }, { status: 400 });
  }
}
