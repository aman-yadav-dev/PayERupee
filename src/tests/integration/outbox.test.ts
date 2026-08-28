import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/infrastructure/database/db";
import { processOutbox } from "@/modules/payout/application/outbox.processor";
import { IPayoutProvider, ProviderDispatchResult, NormalizedWebhookEvent } from "@/modules/provider/core/provider.interface";
import { onboardMerchant } from "@/modules/merchant/domain/merchant.service";
import crypto from "crypto";
import { LedgerAccountType, LedgerEntryPurpose, ReferenceType } from "@prisma/client";

// A mock provider for deterministic testing
class TestProvider implements IPayoutProvider {
  public failDispatchNTimes = 0;
  public dispatchCount = 0;

  async dispatch(): Promise<ProviderDispatchResult> {
    this.dispatchCount++;
    if (this.failDispatchNTimes > 0) {
      this.failDispatchNTimes--;
      return { outcome: "NETWORK_ERROR", failureReason: "Simulated network error" };
    }
    return { outcome: "QUEUED", providerReference: "TEST_PROV_REF" };
  }

  async status(): Promise<ProviderDispatchResult> {
    return { outcome: "SUCCESS" };
  }
  verifyWebhookSignature() { return true; }
  parseWebhook() { return {} as NormalizedWebhookEvent; }
}

describe("Outbox Background Processor", () => {
  let merchantId: string;
  let provider = new TestProvider();

  beforeAll(async () => {
    // Basic setup to get a merchant
    const user = await db.user.create({ data: { email: `outbox-${Date.now()}@example.com`, name: "Outbox Test User" } });
    const { merchantProfile, wallet, liabilityAccount } = await onboardMerchant({ userId: user.id, businessName: "Outbox Business" });
    merchantId = merchantProfile.id;

    // Seed wallet
    const transit = await db.ledgerAccount.findFirst({ where: { type: LedgerAccountType.SYSTEM_TRANSIT } });
    const { createLedgerEntry } = await import("@/modules/ledger/domain/ledger.service");
    await createLedgerEntry({
      amount: "50000.0",
      creditAccountId: liabilityAccount.id,
      debitAccountId: transit!.id,
      purpose: LedgerEntryPurpose.MANUAL_ADJUSTMENT,
      referenceType: ReferenceType.SYSTEM,
      description: "Seed"
    });
    
    await db.wallet.update({ where: { id: wallet.id }, data: { balance: 50000.0, version: { increment: 1 } } });
  });

  it("should NOT retry network errors blindly, Reconciler takes over", async () => {
    // Manually insert an outbox and a payout
    const payout = await db.payout.create({
      data: {
        merchantProfileId: merchantId,
        idempotencyKey: `outbox-idem-${Date.now()}`,
        amount: 100,
        totalDebitAmount: 100,
        accountNumber: "123",
        ifscCode: "IFSC",
        accountHolderName: "Test",
        status: "PROCESSING"
      }
    });

    const outbox = await db.outboxEvent.create({
      data: {
        referenceType: "PAYOUT_DISPATCH",
        referenceId: payout.id,
        status: "PENDING"
      }
    });

    provider.failDispatchNTimes = 1;
    provider.dispatchCount = 0;

    // Sweep 1 -> Fails with NETWORK_ERROR
    await processOutbox("worker-1", provider);
    let event = await db.outboxEvent.findUnique({ where: { id: outbox.id } });
    
    // Status should be EXHAUSTED immediately, attempts = 1
    expect(event?.status).toBe("EXHAUSTED");
    expect(event?.attempts).toBe(1);
    
    const timeToNextRun = event!.nextRunAt.getTime() - Date.now();
    expect(timeToNextRun).toBeGreaterThan(80000000); // basically 24 hours into future

    // Sweep 2 -> Even if we time-travel, it should NOT blindly dispatch again!
    // Time travel bypass
    await db.outboxEvent.update({ where: { id: outbox.id }, data: { nextRunAt: new Date() } });

    await processOutbox("worker-1", provider);
    
    // Dispatch count should remain 1 because attempts > 0 triggers Reconciler handoff!
    expect(provider.dispatchCount).toBe(1);

    // Event should now be EXHAUSTED so Reconciler can pick it up
    event = await db.outboxEvent.findUnique({ where: { id: outbox.id } });
    expect(event?.status).toBe("EXHAUSTED");
    expect(event?.attempts).toBe(1); // Did not dispatch
  });

  it("should mark outbox as EXHAUSTED but NOT refund payout when max retries hit", async () => {
    const payout = await db.payout.create({
      data: {
        merchantProfileId: merchantId,
        idempotencyKey: `outbox-idem2-${Date.now()}`,
        amount: 100,
        totalDebitAmount: 100,
        accountNumber: "123",
        ifscCode: "IFSC",
        accountHolderName: "Test",
        status: "PROCESSING"
      }
    });

    const outbox = await db.outboxEvent.create({
      data: {
        referenceType: "PAYOUT_DISPATCH",
        referenceId: payout.id,
        status: "PENDING",
        attempts: 5, // Max retries reached
        nextRunAt: new Date(Date.now() - 1000)
      }
    });

    provider.failDispatchNTimes = 5; // Will definitely fail

    await processOutbox("worker-2", provider);
    
    const event = await db.outboxEvent.findUnique({ where: { id: outbox.id } });
    expect(event?.status).toBe("EXHAUSTED");

    // The payout MUST NOT be failed/refunded.
    // It remains PROCESSING so Reconciler can poll later.
    const updatedPayout = await db.payout.findUnique({ where: { id: payout.id } });
    expect(updatedPayout?.status).toBe("PROCESSING");
  });

  it("should process synchronous SUCCESS from provider correctly without crashing", async () => {
    // 1. Create a payout in PROCESSING state
    const payout = await db.payout.create({
      data: {
        merchantProfileId: merchantId,
        idempotencyKey: `outbox-success-${Date.now()}`,
        amount: 50,
        totalDebitAmount: 50,
        accountNumber: "456",
        ifscCode: "IFSC2",
        accountHolderName: "Success Test",
        status: "PROCESSING"
      }
    });

    // 2. Create the OutboxEvent that the worker will pick up
    const outbox = await db.outboxEvent.create({
      data: {
        referenceType: "PAYOUT_DISPATCH",
        referenceId: payout.id,
        status: "PENDING"
      }
    });

    // 3. Mock the provider to return SUCCESS instead of QUEUED
    class SuccessProvider extends TestProvider {
      async dispatch(): Promise<ProviderDispatchResult> {
        return { outcome: "SUCCESS", providerReference: "SYNC_SUCCESS_123" };
      }
    }

    const successProvider = new SuccessProvider();

    // 4. Run the processor
    await processOutbox("worker-success", successProvider);

    // 5. Verify the Outbox is COMPLETED
    const event = await db.outboxEvent.findUnique({ where: { id: outbox.id } });
    expect(event?.status).toBe("COMPLETED");

    // 6. Verify the Payout is SUCCESS and updated properly
    const updatedPayout = await db.payout.findUnique({ where: { id: payout.id } });
    expect(updatedPayout?.status).toBe("SUCCESS");
    expect(updatedPayout?.providerReference).toBe("SYNC_SUCCESS_123");
  });
});
