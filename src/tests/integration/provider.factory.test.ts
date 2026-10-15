
import { describe, it, expect } from "vitest";
import { getPayoutProvider } from "@/modules/provider/adapters/provider.factory";
import { InMemoryPayoutProvider } from "@/modules/provider/adapters/mock.provider";
import { PayMyQrPayoutProvider } from "@/modules/provider/adapters/paymyqr.provider";

describe("Provider Factory Fail-Safe Behavior", () => {
  it("should return InMemoryPayoutProvider for TEST environment", () => {
    const provider = getPayoutProvider("TEST");
    expect(provider).toBeInstanceOf(InMemoryPayoutProvider);
  });

  it("should return PayMyQrPayoutProvider when LIVE", () => {
    const provider = getPayoutProvider("LIVE");
    expect(provider).toBeInstanceOf(PayMyQrPayoutProvider);
  });
  
  it("should fail closed for invalid environment strings", () => {
    expect(() => getPayoutProvider("INVALID" as any)).toThrow("Invalid environment string for payout routing.");
  });
});

