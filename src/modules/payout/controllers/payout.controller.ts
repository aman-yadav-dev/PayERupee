import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, UnauthorizedError } from "@/modules/auth/application/api-auth.service";
import { createPayout } from "@/modules/payout/domain/payout.service";
import { dispatchPayout } from "@/modules/payout/application/payout.orchestrator";
import { InMemoryPayoutProvider } from "@/modules/provider/adapters/mock.provider";
import { z } from "zod";
import { logger } from "@/infrastructure/logger/logger";
import { checkRateLimit } from "@/shared/utils/rate-limit";

// In the future this should be injected.
const provider = new InMemoryPayoutProvider();

export class PayoutController {
  static async create(req: NextRequest): Promise<NextResponse> {
    try {
      // 1. Authenticate & strictly extract merchantProfileId
      const merchantProfileId = await authenticateApiKey(req.headers.get("Authorization"));

      // 2. Conceptual Rate Limit Boundary
      const allowed = await checkRateLimit(merchantProfileId);
      if (!allowed) {
        logger.error(`Rate limit exceeded for merchant ${merchantProfileId}`);
        return NextResponse.json({ success: false, error: "Too Many Requests" }, { status: 429 });
      }

      // 3. Parse Body
      const body = await req.json();

      // 4. Create PENDING payout
      const { payout, isNew } = await createPayout(merchantProfileId, body);

      if (!isNew) {
        // Idempotent duplicate: simply return the existing payout state immediately
        logger.info(`Idempotent duplicate request returned for payout ${payout.id}`);
        return NextResponse.json({ success: true, payout }, { status: 200 });
      }

      // 5. Orchestrate
      const finalPayout = await dispatchPayout(payout.id, merchantProfileId, provider);

      return NextResponse.json({ success: true, payout: finalPayout }, { status: 201 });
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        logger.error("Unauthorized payout attempt", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 401 });
      }
      if (error instanceof z.ZodError) {
        const zodErr = error as any;
        logger.error("Validation failed", zodErr.errors);
        return NextResponse.json({ success: false, error: "Validation failed", details: zodErr.errors }, { status: 400 });
      }
      const message = error instanceof Error ? error.message : "Internal Server Error";
      logger.error("Internal server error during payout API", message);
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  }
}
