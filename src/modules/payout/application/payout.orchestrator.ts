import { processPayout, failPayout, handlePayoutSuccess } from "@/modules/payout/domain/payout.service";
import { IPayoutProvider } from "@/modules/provider/core/provider.interface";
import { db } from "@/infrastructure/database/db";

/**
 * Orchestrates the dispatch of a payout to the external provider.
 * Ensures the database transaction completes fully BEFORE external network boundaries are crossed.
 */
export async function dispatchPayout(payoutId: string, merchantProfileId: string, provider: IPayoutProvider) {
  // 1. Database Boundary (Atomic processing and wallet deduction)
  // This will throw if the payout isn't PENDING, or if funds are insufficient.
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
      return await failPayout(processedPayout.id, merchantProfileId, result.failureReason || "Provider rejected payout");
    }

    if (result.outcome === "QUEUED") {
      // The transfer has been accepted for processing by the provider.
      // We MUST NOT assume it is successful yet. It remains in PROCESSING.
      // We only update the providerReference so we can track it.
      if (result.providerReference) {
        return await db.payout.update({
          where: { id: processedPayout.id },
          data: { providerReference: result.providerReference }
        });
      }
      return processedPayout;
    }



    // For TIMEOUT or NETWORK_ERROR, we also leave it in PROCESSING.
    // A background worker or status sync job will eventually reconcile it.
    if (result.providerReference) {
      return await db.payout.update({
        where: { id: processedPayout.id },
        data: { providerReference: result.providerReference }
      });
    }

    return processedPayout;
  } catch (error) {
    // Network error, ambiguous timeout, or unexpected exception.
    // DO NOT REFUND. Leave in PROCESSING. The background status checker or webhook will reconcile this.
    console.error(`Network or dispatch error for payout ${payoutId}:`, error);
    return processedPayout; // Returning the processing payout unmodified.
  }
}
