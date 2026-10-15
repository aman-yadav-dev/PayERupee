import { db } from "@/infrastructure/database/db";
import { PayoutStatus } from "@prisma/client";
import { getPayoutProvider } from "@/modules/provider/adapters/provider.factory";
import { handlePayoutSuccess, failPayout, IllegalStateTransitionError } from "../domain/payout.service";
import { acquireSystemLease, releaseSystemLease } from "@/modules/system/domain/lease.service";
import { logger } from "@/infrastructure/logger/logger";

/**
 * Sweeps the database for stranded/stale payouts in PROCESSING state 
 * and safely attempts recovery via Provider status polling.
 */
export class PayoutReconciler {
  static async reconcileStalePayouts(workerId: string) {
    const LEASE_RESOURCE = "PAYOUT_RECONCILER";

    const acquired = await acquireSystemLease(LEASE_RESOURCE, workerId, 300); // 5 mins
    if (!acquired) {
      logger.info(`[${workerId}] Reconciler lease held by another worker. Skipping.`);
      return null;
    }

    try {
      // 1. Minimum 30-second delay for all processing payouts before FIRST check
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
      const testThresholdDate = new Date(Date.now() - 10 * 1000);

      // 2. Find PROCESSING payouts that haven't been updated recently AND whose Outbox is no longer PENDING.
      const processingPayouts = await db.payout.findMany({
        where: {
          status: PayoutStatus.PROCESSING,
          OR: [
            {
              environment: "LIVE",
              updatedAt: { lt: thirtySecondsAgo }
            },
            {
              environment: "TEST",
              updatedAt: { lt: testThresholdDate }
            }
          ]
        },
        select: {
          id: true,
          merchantProfileId: true,
          status: true,
          providerReference: true,
          environment: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const results = {
        processingSettled: 0,
        processingFailed: 0,
        processingUnresolved: 0,
        errors: 0
      };

      console.log(`Found ${processingPayouts.length} processing payouts`);
      for (const payout of processingPayouts) {
        if (payout.environment === "LIVE") {
          const elapsedSinceCreation = Date.now() - payout.createdAt.getTime();
          const timeSinceLastPoll = Date.now() - payout.updatedAt.getTime();
          
          let requiredBackoff = 30 * 1000;
          if (elapsedSinceCreation > 30 * 60 * 1000) requiredBackoff = 15 * 60 * 1000; // >30m -> 15m backoff
          else if (elapsedSinceCreation > 10 * 60 * 1000) requiredBackoff = 5 * 60 * 1000; // >10m -> 5m backoff
          else if (elapsedSinceCreation > 5 * 60 * 1000) requiredBackoff = 2 * 60 * 1000; // >5m -> 2m backoff
          else if (elapsedSinceCreation > 2 * 60 * 1000) requiredBackoff = 60 * 1000; // >2m -> 60s backoff
          
          console.log(`LIVE payout ${payout.id}: elapsed=${elapsedSinceCreation}, lastPoll=${timeSinceLastPoll}, required=${requiredBackoff}`);
          if (timeSinceLastPoll < requiredBackoff) {
            console.log(`Skipping payout ${payout.id} due to backoff`);
            continue; // Backoff period has not elapsed yet
          }
        }

        try {
          const provider = getPayoutProvider(payout.environment as "TEST" | "LIVE");
          // Verify Outbox state before polling
          const outbox = await db.outboxEvent.findUnique({ where: { referenceId: payout.id } });
          if (outbox && outbox.status === "PENDING") {
            // Outbox is still trying to dispatch. Skip polling to avoid NOT_FOUND false positives.
            continue;
          }

          // Reconcile via Provider status query
          const statusRes = await provider.status(payout.id, payout.providerReference ?? undefined);

          if (statusRes.outcome === "SUCCESS") {
            await handlePayoutSuccess(payout.id, payout.merchantProfileId, statusRes.providerReference);
            results.processingSettled++;
          } else if (statusRes.outcome === "REJECTED") {
            await failPayout(payout.id, payout.merchantProfileId, statusRes.failureReason || "Reconciled as failed", statusRes.providerFailureDetails);
            results.processingFailed++;
          } else {
            // "QUEUED", "TIMEOUT", "NETWORK_ERROR", "NOT_FOUND"
            // Ambiguous -> Remain PROCESSING. Never refund.
            // Advance updatedAt to backoff next poll.
            await db.payout.update({
              where: { id: payout.id },
              data: { updatedAt: new Date() }
            });
            results.processingUnresolved++;
          }
        } catch (error) {
          if (error instanceof IllegalStateTransitionError) {
            // Concurrency: Another webhook or worker resolved it first. Safe collision.
          } else {
            logger.error(`Error reconciling payout ${payout.id}:`, error);
            results.errors++;
          }
        }
      }

      return results;
    } finally {
      await releaseSystemLease(LEASE_RESOURCE, workerId);
    }
  }
}
