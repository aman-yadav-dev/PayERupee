import { logger } from "@/infrastructure/logger/logger";

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import { processEmailOutbox } from "@/modules/notifications/application/email-outbox.processor";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerId = `cron-email-${randomUUID()}`;
  
  try {
    await processEmailOutbox(workerId);
    return NextResponse.json({ success: true });
  } catch (e) {
    logger.error("Email Outbox Cron Error:", e);
    // Do not leak secrets or error details
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

