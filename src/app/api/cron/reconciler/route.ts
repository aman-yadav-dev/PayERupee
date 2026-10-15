import { logger } from "@/infrastructure/logger/logger";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import { PayoutReconciler } from "@/modules/payout/application/payout.reconciler";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  
  let querySecret: string | null = null;
  try {
    if (req.nextUrl?.searchParams) {
      querySecret = req.nextUrl.searchParams.get("key") || req.nextUrl.searchParams.get("secret");
    } else if (req.url) {
      const parsed = new URL(req.url, "http://localhost");
      querySecret = parsed.searchParams.get("key") || parsed.searchParams.get("secret");
    }
  } catch {
    // Ignore URL parse failures
  }

  const isBearerValid = env.CRON_SECRET && authHeader === `Bearer ${env.CRON_SECRET}`;
  const isQueryValid = env.CRON_SECRET && querySecret === env.CRON_SECRET;

  let isAdmin = false;
  if (!isBearerValid && !isQueryValid) {
    try {
      const { requireAdmin } = await import("@/modules/auth/application/session-auth.service");
      await requireAdmin(req);
      isAdmin = true;
    } catch {
      // Session auth failed
    }
  }

  if (!isBearerValid && !isQueryValid && !isAdmin) {
    return NextResponse.json({
      error: "Unauthorized",
      message: "Payout reconciler requires authorization. Supply header 'Authorization: Bearer <CRON_SECRET>', query parameter '?key=<CRON_SECRET>', or sign in as an Administrator."
    }, { status: 401 });
  }

  const workerId = `cron-reconciler-${randomUUID()}`;
  
  try {
    const results = await PayoutReconciler.reconcileStalePayouts(workerId);
    return NextResponse.json({ 
      success: true, 
      workerId,
      results: results ?? { status: "lease_active_or_skipped" }
    });
  } catch (e) {
    logger.error("Reconciler Cron Error:", e);
    // Do not leak secrets or error details
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
