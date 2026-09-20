import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { completeMerchantOnboardingAction } from "@/actions/auth/onboarding";
import { db } from "@/infrastructure/database/db";
import { auth } from "@/modules/auth/infrastructure/auth";
import { AccountStatus } from "@prisma/client";

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
}));

describe("Google Onboarding Action (Slice 2)", () => {
  let mockUserId = "test-user-id";

  beforeEach(async () => {
    await db.session.deleteMany({});
    await db.account.deleteMany({});
    await db.wallet.deleteMany({});
    await db.ledgerAccount.deleteMany({});
    await db.merchantProfile.deleteMany({});
    await db.user.deleteMany({});

    const user = await db.user.create({
      data: {
        id: mockUserId,
        name: "Google User",
        email: "google-onboard@example.com",
      },
    });

    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      session: {
        id: "mock-session-id",
        userId: user.id,
        expiresAt: new Date(Date.now() + 100000),
        token: "mock-token",
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: true,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      } as any,
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  it("1 and 15. rejects unauthenticated requests", async () => {
    vi.spyOn(auth.api, "getSession").mockResolvedValue(null as any);
    const result = await completeMerchantOnboardingAction({
      phone: "9876543210",
      termsAccepted: true,
    } as any);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Authentication required");
  });

  it("3. rejects invalid phone server-side", async () => {
    const result = await completeMerchantOnboardingAction({
      phone: "123", // invalid
      termsAccepted: true,
    } as any);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveProperty("phone");
  });

  it("4. rejects if terms not accepted", async () => {
    const result = await completeMerchantOnboardingAction({
      phone: "9876543210",
      termsAccepted: false,
    } as any);
    expect(result.success).toBe(false);
    expect(result.errors).toHaveProperty("termsAccepted");
  });

  it("5, 6 and 10. businessName and address supplied by malicious client are ignored and remain null", async () => {
    const result = await completeMerchantOnboardingAction({
      phone: "9876543210",
      termsAccepted: true,
      businessName: "Malicious Company",
      address: "Fake Address",
      role: "ADMIN"
    } as any);
    
    expect(result.success).toBe(true);

    const profile = await db.merchantProfile.findUnique({
      where: { userId: mockUserId }
    });

    expect(profile).toBeDefined();
    expect(profile?.businessName).toBeNull();
    expect(profile?.address).toBeNull();
    expect(profile?.phone).toBe("9876543210");
  });

  it("2, 7, 8 and 9. valid phone and terms succeeds and atomically creates MerchantProfile, Wallet, LedgerAccount", async () => {
    const result = await completeMerchantOnboardingAction({
      phone: "9988776655",
      termsAccepted: true,
    } as any);

    expect(result.success).toBe(true);
    expect(result.data?.userId).toBe(mockUserId);

    const profile = await db.merchantProfile.findUnique({
      where: { userId: mockUserId },
      include: {
        wallet: true,
        ledgerAccounts: true
      }
    });

    expect(profile).toBeDefined();
    expect(profile?.accountStatus).toBe(AccountStatus.PENDING);
    expect(profile?.phone).toBe("9988776655");
    expect(profile?.wallet).toBeDefined();
    expect(profile?.ledgerAccounts.length).toBe(1);
    expect(profile?.ledgerAccounts[0].type).toBe("MERCHANT_LIABILITY");
  });

  it("11. safely rejects duplicate onboarding for the same user", async () => {
    await completeMerchantOnboardingAction({
      phone: "9988776655",
      termsAccepted: true,
    } as any);

    const result2 = await completeMerchantOnboardingAction({
      phone: "9988776655",
      termsAccepted: true,
    } as any);

    expect(result2.success).toBe(false);
    expect(result2.message).toContain("Merchant profile already exists");
  });

  it("12. safely rejects phone collision (P2002)", async () => {
    const otherUser = await db.user.create({
      data: {
        id: "other-user",
        name: "Other",
        email: "other@example.com",
      },
    });
    await db.merchantProfile.create({
      data: {
        userId: otherUser.id,
        phone: "9123456780",
        accountStatus: "PENDING"
      }
    });

    const result = await completeMerchantOnboardingAction({
      phone: "9123456780",
      termsAccepted: true,
    } as any);

    expect(result.success).toBe(false);
    expect(result.errors).toHaveProperty("phone");
    expect(result.message).toContain("already registered");
  });
});
