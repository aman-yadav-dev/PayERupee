import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import { PayoutReconciler } from "@/modules/payout/application/payout.reconciler";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerId = `cron-reconciler-${randomUUID()}`;
  
  try {
    await PayoutReconciler.reconcileStalePayouts(workerId);
    return NextResponse.json({ success: true, workerId });
  } catch (e) {
    console.error("Reconciler Cron Error:", e);
    // Do not leak secrets or error details
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
