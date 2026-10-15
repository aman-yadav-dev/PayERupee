import { db } from "@/infrastructure/database/db";
import { IPayoutProvider } from "@/modules/provider/core/provider.interface";
import { acquireSystemLease, releaseSystemLease } from "@/modules/system/domain/lease.service";
import { failPayout, handlePayoutSuccess } from "@/modules/payout/domain/payout.service";
import { logger } from "@/infrastructure/logger/logger";

import { getPayoutProvider } from "@/modules/provider/adapters/provider.factory";

const MAX_RETRIES = 5;

/**
 * Background worker to sweep and retry PENDING OutboxEvents.
 * Safe to run concurrently across multiple processes due to SystemLease locking.
 */
export async function processOutbox(workerId: string) {
  const LEASE_RESOURCE = "OUTBOX_SWEEPER";
  
  // 1. Acquire Lease
  const acquired = await acquireSystemLease(LEASE_RESOURCE, workerId, 300); // 5 minutes
  if (!acquired) {
    logger.info(`[${workerId}] Outbox sweeper lease held by another worker. Skipping.`);
    return;
  }

  try {
    // 2. Find pending events ready to run
    const events = await db.outboxEvent.findMany({
      where: {
        status: "PENDING",
        nextRunAt: { lte: new Date() }
      },
      take: 50,
      orderBy: { nextRunAt: "asc" }
    });

    for (const event of events) {
      if (event.referenceType !== "PAYOUT_DISPATCH") continue;

      const payout = await db.payout.findUnique({ where: { id: event.referenceId } });
      if (!payout) continue;

      // Attempt to claim the event
      const now = new Date();
      const updatedEvent = await db.outboxEvent.updateMany({
        where: {
          id: event.id,
          status: "PENDING",
          OR: [
            { lockedUntil: null },
            { lockedUntil: { lt: now } }
          ]
        },
        data: {
          lockedBy: workerId,
          lockedUntil: new Date(now.getTime() + 60000), // Lock for 60s
          attempts: { increment: 1 } // ATOMIC: Mark as attempted BEFORE network call to prevent double-dispatch on crash
        }
      });

      if (updatedEvent.count === 0) {
        continue; // Someone else claimed it or status changed
      }

      // Check status to prevent duplicate dispatch if it was left ambiguously
      // Reconciler is the only one who can verify if a timed out dispatch succeeded.
      // We DO NOT blindly retry dispatch on an outbox event.
      // The background processor simply sweeps them. Wait, if it's PENDING and unlocked,
      // it means it either hasn't been tried, or the last try crashed, or it's a retry.
      // If we don't assume provider idempotency, ANY retry is dangerous!
      // Therefore, if attempts > 0, we MUST NOT blindly retry. We must let the Reconciler
      // resolve it first.
      
      if (event.attempts > 0) {
          // It was tried before. We cannot safely retry.
          // Unlock it, set it to EXHAUSTED so Reconciler can sweep it.
          await db.outboxEvent.update({
            where: { id: event.id },
            data: { 
              status: "EXHAUSTED",
              lockedBy: null, 
              lockedUntil: null,
              nextRunAt: new Date(now.getTime() + 86400000) 
            }
          });
          continue;
      }

      // Attempt dispatch (Only if attempts == 0)
      try {
        const provider = getPayoutProvider(payout.environment as "TEST" | "LIVE");
        const result = await provider.dispatch(
          payout.id,
          payout.amount.toString(),
          payout.accountNumber,
          payout.ifscCode,
          payout.paymentMode,
          payout.accountHolderName,
          payout.beneficiaryPhone,
          payout.vpa
        );

        if (result.outcome === "REJECTED") {
          await db.outboxEvent.update({
            where: { id: event.id },
            data: { status: "COMPLETED", lockedBy: null, lockedUntil: null }
          });
          // Definitive failure -> Fail payout and refund wallet
          await failPayout(payout.id, payout.merchantProfileId, result.failureReason || "Provider rejected payout via outbox");
        } 
        else if (result.outcome === "SUCCESS" || result.outcome === "QUEUED") {
          await db.outboxEvent.update({
            where: { id: event.id },
            data: { status: "COMPLETED", lockedBy: null, lockedUntil: null }
          });
          if (result.providerReference) {
            await db.payout.update({
              where: { id: payout.id },
              data: { providerReference: result.providerReference }
            });
          }
          if (result.outcome === "SUCCESS") {
            await handlePayoutSuccess(payout.id, payout.merchantProfileId, result.providerReference);
          }
        } 
        else {
          // TIMEOUT or NETWORK_ERROR or NOT_FOUND (ambiguous)
          // Do NOT retry! Mark EXHAUSTED and attempts = 1 so we never retry, and unlock.
          // Reconciler will take over.
          await db.outboxEvent.update({
            where: { id: event.id },
            data: { 
              status: "EXHAUSTED",
              attempts: 1, // Marks it as having been attempted
              lastError: result.failureReason || "TIMEOUT/NETWORK_ERROR",
              lockedBy: null,
              lockedUntil: null,
              nextRunAt: new Date(now.getTime() + 86400000) // Reconciler will take over
            }
          });
        }
      } catch (error) {
        // Crash/Exception during dispatch. Might have reached provider.
        await db.outboxEvent.update({
          where: { id: event.id },
          data: { 
            status: "EXHAUSTED",
            attempts: 1, // Marks it as attempted
            lastError: error instanceof Error ? error.message : "Unknown error",
            lockedBy: null,
            lockedUntil: null,
            nextRunAt: new Date(now.getTime() + 86400000)
          }
        });
      }
    }
  } finally {
    // 3. Release Lease
    await releaseSystemLease(LEASE_RESOURCE, workerId);
  }
}
