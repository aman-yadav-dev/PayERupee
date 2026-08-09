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
          isPending: false,
          isSuccess: true,
          isFailure: false,
          providerReference: `MOCK_REF_${payoutId}`,
        };
      case "FAILED":
        return {
          isPending: false,
          isSuccess: false,
          isFailure: true,
          failureReason: "MOCK_INSUFFICIENT_PROVIDER_BALANCE",
        };
      case "TIMEOUT":
        return {
          isPending: true,
          isSuccess: false,
          isFailure: false,
          providerReference: `MOCK_PENDING_${payoutId}`,
        };
      case "NETWORK_ERROR":
        throw new Error("MOCK_NETWORK_ERROR - Connection Refused");
    }
  }

  async status(payoutId: string, providerReference?: string): Promise<ProviderDispatchResult> {
    return {
      isPending: false,
      isSuccess: true,
      isFailure: false,
      providerReference: providerReference || `MOCK_REF_${payoutId}`,
    };
  }
}
