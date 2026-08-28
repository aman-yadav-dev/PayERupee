import { processPayout, failPayout, handlePayoutSuccess } from "@/modules/payout/domain/payout.service";
import { IPayoutProvider } from "@/modules/provider/core/provider.interface";
import { db } from "@/infrastructure/database/db";

/**
 * Orchestrates the dispatch of a payout to the external provider.
 * Ensures the database transaction completes fully BEFORE external network boundaries are crossed.
 */
export async function dispatchPayout(payoutId: string, merchantProfileId: string, provider: IPayoutProvider) {
  // 1. Database Boundary (Atomic processing and wallet deduction)
  // This creates the OutboxEvent atomically.
  const processedPayout = await processPayout(payoutId, merchantProfileId);

  // 2. Network Boundary (External Provider)
  try {
    const result = await provider.dispatch(
      processedPayout.id,
      processedPayout.amount.toString(),
      processedPayout.accountNumber,
      processedPayout.ifscCode,
      processedPayout.paymentMode,
      processedPayout.accountHolderName,
      processedPayout.beneficiaryPhone
    );

    // 3. Post-Dispatch Handling
    if (result.outcome === "REJECTED") {
      // Definitive rejection by provider. Safe to refund.
      await db.outboxEvent.update({
        where: { referenceId: processedPayout.id },
        data: { status: "COMPLETED", lockedBy: null, lockedUntil: null }
      });
      return await failPayout(processedPayout.id, merchantProfileId, result.failureReason || "Provider rejected payout");
    }

    if (result.outcome === "SUCCESS" || result.outcome === "QUEUED") {
      await db.outboxEvent.update({
        where: { referenceId: processedPayout.id },
        data: { status: "COMPLETED", lockedBy: null, lockedUntil: null }
      });

      let payoutToReturn = processedPayout;

      if (result.providerReference) {
        payoutToReturn = await db.payout.update({
          where: { id: processedPayout.id },
          data: { providerReference: result.providerReference }
        });
      }

      if (result.outcome === "SUCCESS") {
        return await handlePayoutSuccess(processedPayout.id, merchantProfileId, result.providerReference);
      }

      return payoutToReturn;
    }

    // For TIMEOUT or NETWORK_ERROR, mark as attempted and push far into future.
    // Reconciler will take over. DO NOT retry blindly.
    await db.outboxEvent.update({
      where: { referenceId: processedPayout.id },
      data: { 
        status: "EXHAUSTED",
        attempts: 1,
        lastError: result.failureReason || "TIMEOUT/NETWORK_ERROR",
        lockedBy: null, 
        lockedUntil: null,
        nextRunAt: new Date(Date.now() + 86400000) // retry after 24h (basically let reconciler do it)
      }
    });

    if (result.providerReference) {
      return await db.payout.update({
        where: { id: processedPayout.id },
        data: { providerReference: result.providerReference }
      });
    }

    return processedPayout;
  } catch (error) {
    // Network error, ambiguous timeout, or unexpected exception.
    console.error(`Network or dispatch error for payout ${payoutId}:`, error);
    
    await db.outboxEvent.update({
      where: { referenceId: processedPayout.id },
      data: { 
        status: "EXHAUSTED",
        attempts: 1,
        lastError: error instanceof Error ? error.message : "Unknown error",
        lockedBy: null, 
        lockedUntil: null,
        nextRunAt: new Date(Date.now() + 86400000)
      }
    });

    return processedPayout; // Returning the processing payout unmodified.
  }
}
