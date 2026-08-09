import { NextRequest, NextResponse } from "next/server";
import { handlePayoutSuccess, failPayout, reversePayout, IllegalStateTransitionError } from "@/lib/services/payout.service";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("X-Provider-Signature");
    const secret = process.env.PROVIDER_WEBHOOK_SECRET || "test-secret";
    
    if (signature !== secret) {
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
    }

    const body = await req.json();
    const { providerReference, status, reason } = body;

    if (!providerReference || !status) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // 1. Map provider reference to internal payout
    const payout = await db.payout.findFirst({
      where: { providerReference }
    });

    if (!payout) {
      // Ignored - could be for another environment or system
      return NextResponse.json({ success: true, message: "Payout not found, ignored" }, { status: 200 });
    }

    // 2. Transition State safely and idempotently
    try {
      if (status === "SUCCESS") {
        await handlePayoutSuccess(payout.id, payout.merchantProfileId, providerReference);
      } else if (status === "FAILED") {
        await failPayout(payout.id, payout.merchantProfileId, reason);
      } else if (status === "REVERSED") {
        await reversePayout(payout.id, payout.merchantProfileId, reason);
      } else {
        return NextResponse.json({ success: false, error: "Unknown status" }, { status: 400 });
      }
    } catch (e) {
      if (e instanceof IllegalStateTransitionError) {
        // Harmless idempotent rejection or out-of-order rejection
        return NextResponse.json({ success: true, message: "Ignored invalid state transition" }, { status: 200 });
      }
      throw e;
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
