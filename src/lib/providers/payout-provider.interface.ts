import { Payout } from "@prisma/client";

export type ProviderStatus = "PENDING" | "SUCCESS" | "FAILED" | "REVERSED";

export interface ProviderResponse {
  success: boolean;
  providerReference?: string;
  errorReason?: string;
}

export interface IPayoutProvider {
  dispatch(payout: Payout): Promise<ProviderResponse>;
  statusCheck(reference: string): Promise<ProviderStatus>;
}
