import { NextRequest, NextResponse } from "next/server";
import { handlePayoutSuccess, failPayout, reversePayout, IllegalStateTransitionError } from "@/modules/payout/domain/payout.service";
import { db } from "@/infrastructure/database/db";
import { getPayoutProvider } from "@/modules/provider/adapters/provider.factory";
import { env } from "@/config/env";

export class PayoutWebhookController {
  static async handleWebhook(req: NextRequest): Promise<NextResponse> {
    try {
      const provider = getPayoutProvider();
      
      const headersObj: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        headersObj[key.toLowerCase()] = value;
      });

      // 1. Fetch raw body EXACTLY once to preserve bytes for crypto
      const rawBody = await req.text();

      // 2. Signature verification BEFORE parsing
      const isValid = provider.verifyWebhookSignature(rawBody, headersObj);

      if (!isValid) {
        return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
      }

      // 3. Normalize webhook payload via provider
      let normalizedEvent;
      try {
        normalizedEvent = provider.parseWebhook(rawBody);
      } catch (e) {
        return NextResponse.json({ success: false, error: "Malformed payload or parsing error" }, { status: 400 });
      }

      // 1. Map provider reference to internal payout
      const payout = await db.payout.findUnique({
        where: { id: normalizedEvent.payoutId }
      });

      if (!payout) {
        // Ignored - could be for another environment or system
        return NextResponse.json({ success: true, message: "Payout not found, ignored" }, { status: 200 });
      }

      if (normalizedEvent.providerReference && !payout.providerReference) {
        // Opportunistically save the provider reference if we didn't have it yet
        // (e.g. if the webhook beat the synchronous API response)
        await db.payout.update({
          where: { id: payout.id },
          data: { providerReference: normalizedEvent.providerReference }
        });
      }

      const { status, reason, providerReference } = normalizedEvent;

      if (!status) {
        return NextResponse.json({ success: false, error: "Missing required status in normalized event" }, { status: 400 });
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
}
