import { expect, describe, it, beforeEach } from "vitest";
import { InMemoryPayoutProvider } from "@/modules/provider/adapters/mock.provider";
import { db } from "@/infrastructure/database/db";

describe("InMemoryPayoutProvider", () => {
  beforeEach(() => {
    InMemoryPayoutProvider.reset();
  });

  it("should return QUEUED for immediate status request", async () => {
    const provider = new InMemoryPayoutProvider();
    const result = await provider.status("test-id-1");
    expect(result.outcome).toBe("QUEUED");
  });

  it("should return SUCCESS after simulated completion threshold", async () => {
    // 1. Setup a test payout in the database created 6 seconds ago
    const user = await db.user.create({
      data: {
        email: `mock-test-${Date.now()}@example.com`,
        role: "MERCHANT",
        name: "Test Merchant",
      }
    });
    const merchant = await db.merchantProfile.create({
      data: {
        userId: user.id,
        businessName: "Mock Test",
      }
    });

    const payout = await db.payout.create({
      data: {
        merchantProfileId: merchant.id,
        idempotencyKey: `mock-sim-${Date.now()}`,
        amount: 100,
        totalDebitAmount: 100,
        status: "PROCESSING",
        paymentMode: "IMPS",
        environment: "TEST",
        createdAt: new Date(Date.now() - 6000), // 6 seconds ago
      }
    });

    // 2. Poll the provider status
    const provider = new InMemoryPayoutProvider();
    
    // nextStatusOutcome defaults to QUEUED, but age > 5s should simulate SUCCESS
    const result = await provider.status(payout.id);
    expect(result.outcome).toBe("SUCCESS");
  });

  it("explicit nextStatusOutcome override still works", async () => {
    // Create an old payout that WOULD normally trigger simulated SUCCESS
    const user = await db.user.create({
      data: {
        email: `mock-override-${Date.now()}@example.com`,
        role: "MERCHANT",
        name: "Test Merchant",
      }
    });
    const merchant = await db.merchantProfile.create({
      data: {
        userId: user.id,
        businessName: "Mock Test",
      }
    });

    const payout = await db.payout.create({
      data: {
        merchantProfileId: merchant.id,
        idempotencyKey: `mock-override-${Date.now()}`,
        amount: 100,
        totalDebitAmount: 100,
        status: "PROCESSING",
        paymentMode: "IMPS",
        environment: "TEST",
        createdAt: new Date(Date.now() - 6000), // 6 seconds ago
      }
    });

    const provider = new InMemoryPayoutProvider();
    
    // Explicit override
    InMemoryPayoutProvider.nextStatusOutcome = "REJECTED";

    // Since it's REJECTED, it should NOT simulate SUCCESS, despite age > 5s
    const result = await provider.status(payout.id);
    expect(result.outcome).toBe("REJECTED");
  });

  it("existing behavior for other outcomes remains intact", async () => {
    const provider = new InMemoryPayoutProvider();
    
    InMemoryPayoutProvider.nextStatusOutcome = "TIMEOUT";
    const res1 = await provider.status("test-id-1");
    expect(res1.outcome).toBe("TIMEOUT");

    InMemoryPayoutProvider.nextStatusOutcome = "NETWORK_ERROR";
    const res2 = await provider.status("test-id-1");
    expect(res2.outcome).toBe("NETWORK_ERROR");
  });
});
