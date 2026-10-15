
import { IPayoutProvider } from "@/modules/provider/core/provider.interface";
import { InMemoryPayoutProvider } from "@/modules/provider/adapters/mock.provider";
import { PayMyQrPayoutProvider } from "@/modules/provider/adapters/paymyqr.provider";

export function getPayoutProvider(environment: "TEST" | "LIVE"): IPayoutProvider {
  if (environment === "TEST") {
    return new InMemoryPayoutProvider();
  }
  
  if (environment === "LIVE") {
    return new PayMyQrPayoutProvider();
  }

  throw new Error("Invalid environment string for payout routing.");
}

