import { logger } from "@/infrastructure/logger/logger";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import { processOutbox } from "@/modules/payout/application/outbox.processor";
import { getPayoutProvider } from "@/modules/provider/adapters/provider.factory";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerId = `cron-outbox-${randomUUID()}`;
  
  try {
    await processOutbox(workerId);
    return NextResponse.json({ success: true, workerId });
  } catch (e) {
    logger.error("Outbox Cron Error:", e);
    // Do not leak secrets or error details
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
