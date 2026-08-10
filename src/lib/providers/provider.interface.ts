export type ProviderOutcome = "ACCEPTED" | "REJECTED" | "TIMEOUT" | "NETWORK_ERROR";

export interface ProviderDispatchResult {
  outcome: ProviderOutcome;
  providerReference?: string;
  failureReason?: string;
}

export interface IPayoutProvider {
  /**
   * Dispatches a payout to the external provider.
   * @param payoutId The internal payout ID (used for idempotency)
   * @param amount The total amount to send
   * @param accountNumber The destination account
   * @param ifscCode The destination IFSC
   * @param mode The payment mode (IMPS, UPI, etc.)
   */
  dispatch(
    payoutId: string,
    amount: string,
    accountNumber: string,
    ifscCode: string,
    mode: string
  ): Promise<ProviderDispatchResult>;

  /**
   * Checks the real-time status of a payout at the provider.
   */
  status(payoutId: string, providerReference?: string): Promise<ProviderDispatchResult>;

  /**
   * Verifies the cryptographic signature of an incoming webhook.
   * @param rawBody The exact, unparsed text string of the HTTP request body
   * @param signature The signature from the provider header
   * @param secret The webhook secret for this provider
   * @returns boolean true if valid, false if invalid
   */
  verifyWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean;
}
