import { db } from "@/infrastructure/database/db";
import { acquireSystemLease, releaseSystemLease } from "@/modules/system/domain/lease.service";
import { logger } from "@/infrastructure/logger/logger";
import { dispatchOutboxEmail, emailOutboxPayloadSchema } from "@/infrastructure/notifications/mailer";

const MAX_RETRIES = 5;

function sanitizeEmailError(error: unknown): string {
  if (!(error instanceof Error)) return "Unknown operational error";
  let msg = error.message;
  
  // Sanitize potential credentials/connection strings if present
  msg = msg.replace(/:\/\/[^:]+:[^@]+@/g, "://***:***@");
  msg = msg.replace(/password[:=]\s*[^\s&;]+/gi, "password=***");
  
  // Do not store arbitrary stack traces
  const lines = msg.split("\n");
  const firstLine = lines[0] || "Unknown error";
  
  return firstLine.substring(0, 250);
}

/**
 * Background worker to sweep and retry PENDING email OutboxEvents.
 * Safe to run concurrently across multiple processes due to SystemLease locking.
 */
export async function processEmailOutbox(workerId: string, options?: { skipLease?: boolean }) {
  const LEASE_RESOURCE = "EMAIL_SWEEPER";
  let acquired = false;
  
  if (!options?.skipLease) {
    // 1. Acquire Lease (30 seconds TTL for fast recovery)
    acquired = await acquireSystemLease(LEASE_RESOURCE, workerId, 30);
    if (!acquired) {
      logger.info(`[${workerId}] Email outbox sweeper lease held by another worker. Skipping.`);
      return;
    }
  }

  try {
    // 2. Find pending events ready to run
    const events = await db.outboxEvent.findMany({
      where: {
        referenceType: "EMAIL_DISPATCH",
        status: "PENDING",
        nextRunAt: { lte: new Date() }
      },
      take: 50,
      orderBy: { nextRunAt: "asc" }
    });

    for (const event of events) {
      const now = new Date();
      
      // Attempt to claim the event
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
        }
      });

      if (updatedEvent.count === 0) {
        continue; // Someone else claimed it or status changed
      }

      // Helper to finalize safely preserving lock ownership
      const finalizeEvent = async (data: any) => {
        return await db.outboxEvent.updateMany({
          where: { id: event.id, lockedBy: workerId },
          data
        });
      };

      // Check max retries
      if (event.attempts >= MAX_RETRIES) {
        await finalizeEvent({
          status: "EXHAUSTED",
          lastError: "Max retries reached",
          lockedBy: null,
          lockedUntil: null
        });
        continue;
      }

      // Parse Payload
      const parsedPayload = emailOutboxPayloadSchema.safeParse(event.payload);
      if (!parsedPayload.success) {
        await finalizeEvent({
          status: "EXHAUSTED",
          lastError: `Malformed payload: ${parsedPayload.error.message.substring(0, 200)}`,
          lockedBy: null,
          lockedUntil: null
        });
        continue;
      }

      // Increment attempts early (to track the attempt even if it crashes)
      await db.outboxEvent.updateMany({
        where: { id: event.id, lockedBy: workerId },
        data: { attempts: { increment: 1 } }
      });

      // Attempt dispatch
      try {
        await dispatchOutboxEmail(parsedPayload.data);

        // Success
        await finalizeEvent({
          status: "COMPLETED",
          lockedBy: null,
          lockedUntil: null,
          lastError: null
        });
      } catch (error: unknown) {
        const sanitizedError = sanitizeEmailError(error);
        
        // Retryable failure (calculate exponential backoff)
        const currentAttempt = event.attempts + 1; // +1 because we incremented it above
        
        if (currentAttempt >= MAX_RETRIES) {
          await finalizeEvent({
            status: "EXHAUSTED",
            lastError: sanitizedError,
            lockedBy: null,
            lockedUntil: null
          });
        } else {
          // Exponential backoff: 1 min, 4 min, 9 min, 16 min...
          const backoffMinutes = Math.pow(currentAttempt, 2);
          const nextRunAt = new Date(Date.now() + backoffMinutes * 60000);
          
          await finalizeEvent({
            lastError: sanitizedError,
            nextRunAt,
            lockedBy: null,
            lockedUntil: null
          });
        }
      }
    }
  } finally {
    // 3. Release Lease if acquired
    if (acquired) {
      await releaseSystemLease(LEASE_RESOURCE, workerId);
    }
  }
}
