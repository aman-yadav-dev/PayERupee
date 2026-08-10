import { IPayoutProvider, ProviderDispatchResult, NormalizedWebhookEvent } from "@/modules/provider/core/provider.interface";

type MockAction = "QUEUED" | "FAILED" | "TIMEOUT" | "NETWORK_ERROR";

export class InMemoryPayoutProvider implements IPayoutProvider {
  // Configurable state to simulate different conditions in tests
  public static nextAction: MockAction = "QUEUED";
  public static latencyMs = 0;

  public static reset() {
    this.nextAction = "QUEUED";
    this.latencyMs = 0;
  }

  async dispatch(
    payoutId: string,
    amount: string,
    accountNumber: string,
    ifscCode: string,
    mode: string,
    accountHolderName: string,
    beneficiaryPhone?: string | null
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
      case "NETWORK_ERROR":
        // Simulated network error explicitly translates to a NETWORK_ERROR outcome
        // instead of throwing an unhandled exception for better orchestration control
        return {
          outcome: "NETWORK_ERROR",
          failureReason: "Connection Refused",
        };
    }
  }

  async status(payoutId: string, providerReference?: string): Promise<ProviderDispatchResult> {
    return {
      outcome: "QUEUED",
      providerReference: providerReference || `MOCK_REF_${payoutId}`,
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
