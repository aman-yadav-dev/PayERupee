import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getPayoutProvider } from "@/modules/provider/adapters/provider.factory";
import { CashfreePayoutProvider } from "@/modules/provider/adapters/cashfree.provider";
import { InMemoryPayoutProvider } from "@/modules/provider/adapters/mock.provider";
import { env } from "@/config/env";

describe("Provider Factory Fail-Safe Behavior", () => {
  let originalEnv: any;

  beforeEach(() => {
    originalEnv = {
      PROVIDER_NAME: env.PROVIDER_NAME,
      NODE_ENV: env.NODE_ENV,
    };
  });

  afterEach(() => {
    env.PROVIDER_NAME = originalEnv.PROVIDER_NAME;
    env.NODE_ENV = originalEnv.NODE_ENV;
  });

  it("should return CashfreePayoutProvider when PROVIDER_NAME is CASHFREE", () => {
    env.PROVIDER_NAME = "CASHFREE";
    const provider = getPayoutProvider();
    expect(provider).toBeInstanceOf(CashfreePayoutProvider);
  });

  it("should return InMemoryPayoutProvider in test environments", () => {
    env.PROVIDER_NAME = undefined;
    env.NODE_ENV = "test";
    const provider = getPayoutProvider();
    expect(provider).toBeInstanceOf(InMemoryPayoutProvider);
  });

  it("should return InMemoryPayoutProvider when explicitly mocked", () => {
    env.PROVIDER_NAME = "MOCK";
    env.NODE_ENV = "production"; // Even in production, if explicitly overridden (e.g. staging)
    const provider = getPayoutProvider();
    expect(provider).toBeInstanceOf(InMemoryPayoutProvider);
  });

  it("should fail closed (throw) in production with invalid/missing provider", () => {
    env.PROVIDER_NAME = undefined;
    env.NODE_ENV = "production";
    expect(() => getPayoutProvider()).toThrow("Missing or invalid production provider configuration. System failed closed.");
    
    env.PROVIDER_NAME = "UNKNOWN_PROVIDER";
    expect(() => getPayoutProvider()).toThrow("Missing or invalid production provider configuration. System failed closed.");
  });

  it("should fail closed (throw) in development with invalid/missing provider", () => {
    env.PROVIDER_NAME = undefined;
    env.NODE_ENV = "development";
    expect(() => getPayoutProvider()).toThrow("Unknown provider configuration: undefined");
  });
});
