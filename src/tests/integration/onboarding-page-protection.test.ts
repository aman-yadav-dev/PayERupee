import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { AccountStatus } from "@prisma/client";
import OnboardingLayout from "@/app/(auth)/onboarding/layout";

const mockGetSession = vi.fn();
vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: {
      getSession: (...args: any[]) => mockGetSession(...args),
    },
  },
}));

// Mock next/headers

vi.mock("next/headers", () => ({
  headers: () => new Map(),
}));

// Mock next/navigation
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error("NEXT_REDIRECT");
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useTransition: () => [false, vi.fn()], useState: () => [false, vi.fn()] };
});

// Mock OnboardingClient so it doesn't crash from React hooks in test
vi.mock("@/app/(auth)/onboarding/OnboardingClient", () => ({
  default: () => "OnboardingClient Component",
}));

describe("Onboarding Page Server Boundary", () => {
  const userId = "test-onboarding-user";
  const profileId = "test-onboarding-profile";
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Isolated cleanup
    await db.kycApplication.deleteMany({ where: { merchantProfileId: profileId } });
    await db.merchantProfile.deleteMany({ where: { id: profileId } });
    await db.user.deleteMany({ where: { id: userId } });
  });

  afterEach(async () => {
    await db.kycApplication.deleteMany({ where: { merchantProfileId: profileId } });
    await db.merchantProfile.deleteMany({ where: { id: profileId } });
    await db.user.deleteMany({ where: { id: userId } });
  });

  async function createTestUser(accountStatus: AccountStatus | null, emailVerified: boolean = true, withKyc: boolean = false) {
    await db.user.create({
      data: {
        id: userId,
        email: "onboarding-test@example.com",
        name: "Onboarding User",
        emailVerified
      }
    });

    if (accountStatus) {
      await db.merchantProfile.create({
        data: {
          id: profileId,
          userId,
          accountStatus,
          kycApplication: withKyc ? {
            create: { cycles: { create: { cycleNumber: 1, formVersion: { create: { status: "PUBLISHED", versionNumber: 1, form: { create: { name: "Test Form" } } } }, status: "APPROVED", isCurrentCycle: true } } }
          } : undefined
        }
      });
    }

    mockGetSession.mockResolvedValue({
      user: { id: userId, emailVerified }
    });
  }

  it("1. unauthenticated user cannot access /onboarding -> /login", async () => {
    mockGetSession.mockResolvedValue(null);
    try { await OnboardingLayout({ children: "test" }); } catch (e) {}
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("2. unverified authenticated user cannot access /onboarding -> /verify-email", async () => {
    await createTestUser(null, false);
    try { await OnboardingLayout({ children: "test" }); } catch (e) {}
    expect(mockRedirect).toHaveBeenCalledWith("/verify-email");
  });

  it("3. user without MerchantProfile can access /onboarding -> Renders Client", async () => {
    await createTestUser(null, true);
    const render = await OnboardingLayout({ children: "test" });
    expect(mockRedirect).not.toHaveBeenCalled();
    // It should render children
  });

  it("4. existing onboarded merchant cannot restart onboarding -> /kyc/start", async () => {
    await createTestUser("PENDING", true, false);
    try { await OnboardingLayout({ children: "test" }); } catch (e) {}
    expect(mockRedirect).toHaveBeenCalledWith("/kyc/start");
  });

  it("5. KYC-state merchant is routed according to lifecycle -> /dashboard", async () => {
    await createTestUser("ACTIVE", true, true);
    try { await OnboardingLayout({ children: "test" }); } catch (e) {}
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("6. suspended/deleted account remains blocked", async () => {
    await createTestUser("SUSPENDED", true, false);
    try { await OnboardingLayout({ children: "test" }); } catch (e) {}
    expect(mockRedirect).toHaveBeenCalledWith("/login?error=account_suspended");
  });

  it("7. redirect manipulation cannot create an open redirect", async () => {
    await createTestUser("PENDING", true, false);
    try { await (OnboardingLayout as any)({ children: "test", searchParams: { next: "http://evil.com" } }); } catch (e) {}
    expect(mockRedirect).not.toHaveBeenCalledWith("http://evil.com");
    expect(mockRedirect).toHaveBeenCalledWith("/kyc/start");
  });
});
