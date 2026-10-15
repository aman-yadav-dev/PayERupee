import { IPayoutProvider, ProviderDispatchResult, NormalizedWebhookEvent, ProviderOutcome } from "@/modules/provider/core/provider.interface";

type MockAction = "QUEUED" | "FAILED" | "TIMEOUT" | "NETWORK_ERROR" | "SUCCESS";

export class InMemoryPayoutProvider implements IPayoutProvider {
  // Configurable state to simulate different conditions in tests
  public static nextAction: MockAction = "QUEUED";
  public static latencyMs = 0;

  public static reset() {
    this.nextAction = "QUEUED";
    this.nextStatusOutcome = "QUEUED";
    this.latencyMs = 0;
  }

  async dispatch(
    payoutId: string,
    amount: string,
    accountNumber: string | null,
    ifscCode: string | null,
    mode: string,
    accountHolderName: string | null,
    beneficiaryPhone?: string | null,
    vpa?: string | null
  ): Promise<ProviderDispatchResult> {
    if (InMemoryPayoutProvider.latencyMs > 0) {
      await new Promise(r => setTimeout(r, InMemoryPayoutProvider.latencyMs));
    }

    switch (InMemoryPayoutProvider.nextAction) {
      case "QUEUED":
        return {
          outcome: "QUEUED",
          providerReference: `MOCK_REF_${payoutId}`,
        };
      case "FAILED":
        return {
          outcome: "REJECTED",
          failureReason: "MOCK_INSUFFICIENT_PROVIDER_BALANCE",
        };
      case "TIMEOUT":
        return {
          outcome: "TIMEOUT",
          providerReference: `MOCK_PENDING_${payoutId}`,
        };
      case "SUCCESS":
        return {
          outcome: "SUCCESS",
          providerReference: `MOCK_REF_${payoutId}`,
        };
      case "NETWORK_ERROR":
        // Simulated network error explicitly translates to a NETWORK_ERROR outcome
        // instead of throwing an unhandled exception for better orchestration control
        return {
          outcome: "NETWORK_ERROR",
          failureReason: "Connection Refused",
        };
    }
  }

  // Simulate status outcomes
  public static nextStatusOutcome: ProviderOutcome = "QUEUED";

  async status(payoutId: string, providerReference?: string): Promise<ProviderDispatchResult> {
    if (InMemoryPayoutProvider.latencyMs > 0) {
      await new Promise(r => setTimeout(r, InMemoryPayoutProvider.latencyMs));
    }
    
    let outcome = InMemoryPayoutProvider.nextStatusOutcome;

    // Simulate asynchronous completion for manual TEST transactions 
    // without breaking explicit test overrides
    if (outcome === "QUEUED") {
      try {
        // We import dynamically to avoid initialization issues if provider is imported outside Next.js
        const { db } = await import("@/infrastructure/database/db");
        const payout = await db.payout.findUnique({ 
          where: { id: payoutId }, 
          select: { createdAt: true } 
        });
        
        if (payout) {
          const ageMs = Date.now() - payout.createdAt.getTime();
          if (ageMs >= 5000) { // 5 second simulated delay
            outcome = "SUCCESS";
          }
        }
      } catch (e) {
        // Fallback to QUEUED if DB access fails in a mocked test environment
      }
    }

    return {
      outcome,
      providerReference: providerReference || `MOCK_REF_${payoutId}`,
      failureReason: outcome === "REJECTED" ? "Mock status failed" : undefined
    };
  }

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): boolean {
    const secret = process.env.PROVIDER_WEBHOOK_SECRET || "test-secret";
    return headers["x-provider-signature"] === secret;
  }

  parseWebhook(rawBody: string): NormalizedWebhookEvent {
    const body = JSON.parse(rawBody);
    return {
      payoutId: body.payoutId || body.providerReference, // fallback for simple tests
      providerReference: body.providerReference,
      status: body.status,
      reason: body.reason,
    };
  }
}
