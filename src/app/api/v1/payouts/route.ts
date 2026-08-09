import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, UnauthorizedError } from "@/lib/api-auth";
import { createPayout } from "@/lib/services/payout.service";
import { dispatchPayout } from "@/lib/orchestrators/payout.orchestrator";
import { InMemoryPayoutProvider } from "@/lib/providers/mock.provider";
import { z } from "zod";

const provider = new InMemoryPayoutProvider();

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate & strictly extract merchantProfileId
    const merchantProfileId = await authenticateApiKey(req.headers.get("Authorization"));

    // 2. Parse Body
    const body = await req.json();

    // 3. Create PENDING payout
    const { payout, isNew } = await createPayout(merchantProfileId, body);

    if (!isNew) {
      // Idempotent duplicate: simply return the existing payout state immediately
      return NextResponse.json({ success: true, payout }, { status: 200 });
    }

    // 4. Orchestrate
    const finalPayout = await dispatchPayout(payout.id, merchantProfileId, provider);

    return NextResponse.json({ success: true, payout: finalPayout }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Validation failed", details: error.errors }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
