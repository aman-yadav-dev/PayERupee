import { IPayoutProvider, ProviderDispatchResult } from "./provider.interface";

type MockAction = "SUCCESS" | "FAILED" | "TIMEOUT" | "NETWORK_ERROR";

export class InMemoryPayoutProvider implements IPayoutProvider {
  // Configurable state to simulate different conditions in tests
  public static nextAction: MockAction = "SUCCESS";
  public static latencyMs = 0;

  public static reset() {
    this.nextAction = "SUCCESS";
    this.latencyMs = 0;
  }

  async dispatch(
    payoutId: string,
    amount: string,
    accountNumber: string,
    ifscCode: string,
    mode: string
  ): Promise<ProviderDispatchResult> {
    if (InMemoryPayoutProvider.latencyMs > 0) {
      await new Promise(r => setTimeout(r, InMemoryPayoutProvider.latencyMs));
    }

    switch (InMemoryPayoutProvider.nextAction) {
      case "SUCCESS":
        return {
          outcome: "ACCEPTED",
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
      outcome: "ACCEPTED",
      providerReference: providerReference || `MOCK_REF_${payoutId}`,
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean {
    // For mock testing, we just check if signature matches secret
    return signature === secret;
  }
}
