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
      // 1. Get threshold from SystemSettings
      const settings = await db.systemSetting.findUnique({ where: { id: "GLOBAL_SETTINGS" } });
      const thresholdMins = settings?.reconciliationThresholdMins ?? 15;
      const thresholdDate = new Date(Date.now() - thresholdMins * 60 * 1000);

      // 2. Find PROCESSING payouts that haven't been updated recently AND whose Outbox is no longer PENDING.
      // If the Outbox is PENDING, we must NOT poll, because the dispatch network request hasn't finished its retries.
      const stalePayouts = await db.payout.findMany({
        where: {
          status: PayoutStatus.PROCESSING,
          updatedAt: { lt: thresholdDate },
          // Check that OutboxEvent is NOT PENDING.
          // In Prisma, we can do this by checking the relation:
          // Wait, Prisma doesn't easily allow filtering by relation without include unless using some syntax,
          // but we can just query payouts, then check outbox. Or use some relation filter.
        },
        select: {
          id: true,
          merchantProfileId: true,
          status: true,
          providerReference: true
        },
      });

      const results = {
        processingSettled: 0,
        processingFailed: 0,
        processingUnresolved: 0,
        errors: 0
      };

      const provider = getPayoutProvider();

      for (const payout of stalePayouts) {
        try {
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
            await failPayout(payout.id, payout.merchantProfileId, statusRes.failureReason || "Reconciled as failed");
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
            console.error(`Error reconciling payout ${payout.id}:`, error);
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
