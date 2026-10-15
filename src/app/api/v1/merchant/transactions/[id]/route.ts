import { logger } from "@/infrastructure/logger/logger";
import { NextRequest, NextResponse } from "next/server";
import { requireFullMerchantAccess } from "@/modules/auth/application/session-auth.service";
import { db } from "@/infrastructure/database/db";
import { maskDestination } from "@/lib/masking";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { merchantProfileId } = await requireFullMerchantAccess(req);
    const { id } = await params;

    const payout = await db.payout.findUnique({
      where: { id },
      include: {
        ledgerEntries: true
      }
    });

    if (!payout || payout.merchantProfileId !== merchantProfileId) {
      return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
    }

    const mappedTransaction = {
      id: payout.id,
      type: "PAYOUT",
      reference: payout.merchantReference || payout.id,
      amount: payout.amount.toString(),
      fee: payout.fee.toString(),
      tax: payout.tax.toString(),
      totalDebitAmount: payout.totalDebitAmount.toString(),
      status: payout.status,
      createdAt: payout.createdAt.toISOString(),
      updatedAt: payout.updatedAt.toISOString(),
      paymentMode: payout.paymentMode,
      destination: {
        accountName: payout.accountHolderName,
        accountNumber: maskDestination(payout.accountNumber),
        ifscCode: payout.ifscCode,
        vpa: payout.vpa,
        phone: payout.beneficiaryPhone
      },
      failureReason: payout.failureReason,
      provider: payout.provider,
      ledgerEntries: payout.ledgerEntries.map(le => ({
        id: le.id,
        amount: le.amount.toString(),
        purpose: le.purpose,
        createdAt: le.createdAt.toISOString()
      }))
    };

    return NextResponse.json({
      success: true,
      data: mappedTransaction
    });

  } catch (error: any) {
    if (error.name === "UnauthorizedError") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (error.name === "ForbiddenError") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    logger.error("Transactions Detail API Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
