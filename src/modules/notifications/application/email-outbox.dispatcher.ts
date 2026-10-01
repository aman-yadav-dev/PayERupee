import { randomUUID } from "crypto";
import { logger } from "@/infrastructure/logger/logger";
import { processEmailOutbox } from "./email-outbox.processor";

/**
 * Provides immediate, best-effort dispatch of email outbox events.
 * It strictly acts as a fire-and-forget trigger and must be called ONLY 
 * AFTER a database transaction containing an EMAIL_DISPATCH outbox event has successfully committed.
 * 
 * Failure isolation: 
 * If the dispatch fails to start (e.g. lease contention or network error), 
 * it degrades gracefully. The original business transaction is not affected,
 * and the durable OutboxEvent remains PENDING to be swept by the scheduled recovery cron.
 */
export function triggerImmediateEmailDispatch(): void {
  const workerId = `immediate-${randomUUID()}`;
  
  Promise.resolve()
    .then(() => processEmailOutbox(workerId))
    .catch((error) => {
      logger.error(`[ImmediateDispatch] Unhandled error during immediate email dispatch:`, error);
    });
}
