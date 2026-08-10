import { env } from "@/config/env";
import { IPayoutProvider } from "@/modules/provider/core/provider.interface";
import { CashfreePayoutProvider } from "@/modules/provider/adapters/cashfree.provider";
import { InMemoryPayoutProvider } from "@/modules/provider/adapters/mock.provider";

export function getPayoutProvider(): IPayoutProvider {
  if (env.PROVIDER_NAME === "CASHFREE") {
    return new CashfreePayoutProvider();
  }
  
  if (env.PROVIDER_NAME === "MOCK" || env.NODE_ENV === "test") {
    return new InMemoryPayoutProvider();
  }

  if (env.NODE_ENV === "production") {
    throw new Error("Missing or invalid production provider configuration. System failed closed.");
  }

  // Fail closed by default if not explicitly MOCK in development
  throw new Error(`Unknown provider configuration: ${env.PROVIDER_NAME}`);
}
