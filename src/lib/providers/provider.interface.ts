export interface ProviderDispatchResult {
  isPending: boolean;
  isSuccess: boolean;
  isFailure: boolean;
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
}
