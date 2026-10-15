import { NextResponse } from "next/server";
import { requireFullMerchantAccess } from "@/modules/auth/application/session-auth.service";
import { MerchantBankService } from "@/modules/merchant/application/merchant-bank.service";

export async function GET(request: Request) {
  try {
    const auth = await requireFullMerchantAccess(request);
    if (auth instanceof NextResponse) return auth;
    const { merchantProfileId } = auth;

    const banks = await MerchantBankService.getBanks(merchantProfileId);
    return NextResponse.json({ success: true, data: banks });
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
    if (!body.accountNumber || !body.ifscCode || !body.accountHolderName) {
      return NextResponse.json({ success: false, error: "Missing bank details" }, { status: 400 });
    }

    const bank = await MerchantBankService.addBank(merchantProfileId, body);
    return NextResponse.json({ success: true, data: bank });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
