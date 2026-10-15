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

    let activePayout = payout;
    if (activePayout.status === "PROCESSING") {
      try {
        const { getPayoutProvider } = await import("@/modules/provider/adapters/provider.factory");
        const { handlePayoutSuccess, failPayout } = await import("@/modules/payout/domain/payout.service");
        const provider = getPayoutProvider(activePayout.environment as "TEST" | "LIVE");
        const statusRes = await provider.status(activePayout.id, activePayout.providerReference ?? undefined);

        if (statusRes.outcome === "SUCCESS") {
          await handlePayoutSuccess(activePayout.id, activePayout.merchantProfileId, statusRes.providerReference);
          const updated = await db.payout.findUnique({
            where: { id },
            include: { ledgerEntries: true }
          });
          if (updated) activePayout = updated;
        } else if (statusRes.outcome === "REJECTED") {
          await failPayout(activePayout.id, activePayout.merchantProfileId, statusRes.failureReason || "Provider reported failure", statusRes.providerFailureDetails);
          const updated = await db.payout.findUnique({
            where: { id },
            include: { ledgerEntries: true }
          });
          if (updated) activePayout = updated;
        }
      } catch (err) {
        logger.warn(`On-demand payout reconciliation skipped for ${id}:`, err);
      }
    }

    const mappedTransaction = {
      id: activePayout.id,
      type: "PAYOUT",
      reference: activePayout.merchantReference || activePayout.id,
      amount: activePayout.amount.toString(),
      fee: activePayout.fee.toString(),
      tax: activePayout.tax.toString(),
      totalDebitAmount: activePayout.totalDebitAmount.toString(),
      status: activePayout.status,
      createdAt: activePayout.createdAt.toISOString(),
      updatedAt: activePayout.updatedAt.toISOString(),
      paymentMode: activePayout.paymentMode,
      destination: {
        accountName: activePayout.accountHolderName,
        accountNumber: maskDestination(activePayout.accountNumber),
        ifscCode: activePayout.ifscCode,
        vpa: activePayout.vpa,
        phone: activePayout.beneficiaryPhone
      },
      failureReason: activePayout.failureReason,
      provider: activePayout.provider,
      ledgerEntries: activePayout.ledgerEntries.map(le => ({
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
