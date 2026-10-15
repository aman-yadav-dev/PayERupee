import { NextResponse } from "next/server";
import { requireFullMerchantAccess } from "@/modules/auth/application/session-auth.service";
import { WithdrawalService, DuplicateWithdrawalError } from "@/modules/wallet/application/withdrawal.service";
import { Prisma } from "@prisma/client";
import { MerchantBankService } from "@/modules/merchant/application/merchant-bank.service";
import { db } from "@/infrastructure/database/db";

export async function GET(request: Request) {
  try {
    const auth = await requireFullMerchantAccess(request);
    if (auth instanceof NextResponse) return auth;
    const { merchantProfileId } = auth;

    const withdrawals = await db.withdrawal.findMany({
      where: { merchantProfileId },
      orderBy: { createdAt: 'desc' },
      include: { merchantBank: true }
    });
    return NextResponse.json({ success: true, data: withdrawals });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireFullMerchantAccess(request);
    if (auth instanceof NextResponse) return auth;
    const { merchantProfileId } = auth;

    const body = await request.json();
    if (!body.amount || !body.merchantBankId || !body.idempotencyKey) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // Verify bank ownership
    await MerchantBankService.getBankOrThrow(body.merchantBankId, merchantProfileId);

    const withdrawal = await WithdrawalService.createWithdrawal(merchantProfileId, {
      amount: new Prisma.Decimal(body.amount),
      merchantBankId: body.merchantBankId,
      idempotencyKey: body.idempotencyKey
    });

    return NextResponse.json({ success: true, data: withdrawal });
  } catch (error: any) {
    if (error instanceof DuplicateWithdrawalError || error.name === "DuplicateWithdrawalError") {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
