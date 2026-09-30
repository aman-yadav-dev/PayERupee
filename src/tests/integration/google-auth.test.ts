import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/(auth)/auth-sync/route";
import { db } from "@/infrastructure/database/db";
import { auth } from "@/modules/auth/infrastructure/auth";
import { AccountStatus, KycStatus } from "@prisma/client";

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
  cookies: vi.fn(() => ({
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  })),
}));

describe("Google Auth Dispatcher (Slice 1 - /auth-sync)", () => {
  beforeEach(async () => {
    await db.session.deleteMany({});
    await db.account.deleteMany({});
    await db.kycApplication.deleteMany({});
    await db.merchantProfile.deleteMany({});
    await db.user.deleteMany({});
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  // Helper to create a user and session simulating Better Auth OAuth outcome
  async function mockGoogleSession(emailVerified = true) {
    const user = await db.user.create({
      data: {
        name: "Google User",
        email: "google@example.com",
        emailVerified,
      },
    });
    const session = await db.session.create({
      data: {
        userId: user.id,
        token: "mock-session-token",
        expiresAt: new Date(Date.now() + 1000000),
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      },
    });
    // Mock the auth client session retrieval
    vi.spyOn(auth.api, "getSession").mockResolvedValueOnce({
      session: {
        id: session.id,
        userId: user.id,
        expiresAt: session.expiresAt,
        token: session.token,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
    return user;
  }

  async function mockNoSession() {
    vi.spyOn(auth.api, "getSession").mockResolvedValueOnce(null);
  }

  async function callDispatcher(url = "http://localhost/auth-sync") {
    const req = new Request(url);
    const res = await GET(req);
    return res.headers.get("location");
  }

  it("A. routes to /login when no session exists", async () => {
    await mockNoSession();
    const loc = await callDispatcher();
    expect(loc).toBe("http://localhost/login");
  });

  it("B. routes to /onboarding for new Google user (no MerchantProfile)", async () => {
    await mockGoogleSession();
    const loc = await callDispatcher();
    expect(loc).toBe("http://localhost/onboarding");
  });

  it("C. routes to /dashboard for existing user with APPROVED KYC and ACTIVE account", async () => {
    const user = await mockGoogleSession();
    await db.merchantProfile.create({
      data: {
        userId: user.id,
        accountStatus: AccountStatus.ACTIVE,
        kycApplication: {
          create: {
            cycles: { create: { cycleNumber: 1, formVersion: { create: { status: "PUBLISHED", versionNumber: 1, form: { create: { name: "Test Form" } } } }, status: KycStatus.APPROVED, isCurrentCycle: true } }
        },
        },
      },
    });
    const loc = await callDispatcher();
    expect(loc).toBe("http://localhost/dashboard");
  });

  it("D. routes to /kyc/start for pending KYC state (PENDING account, PENDING_SUBMISSION kyc)", async () => {
    const user = await mockGoogleSession();
    await db.merchantProfile.create({
      data: {
        userId: user.id,
        accountStatus: AccountStatus.PENDING,
        kycApplication: {
          create: {
            cycles: { create: { cycleNumber: 1, formVersion: { create: { status: "PUBLISHED", versionNumber: 1, form: { create: { name: "Test Form" } } } }, status: KycStatus.PENDING_SUBMISSION, isCurrentCycle: true } }
        },
        },
      },
    });
    const loc = await callDispatcher();
    expect(loc).toBe("http://localhost/kyc/start");
  });

  it("E. routes to /kyc/under-review for UNDER_REVIEW KYC", async () => {
    const user = await mockGoogleSession();
    await db.merchantProfile.create({
      data: {
        userId: user.id,
        accountStatus: AccountStatus.PENDING,
        kycApplication: {
          create: {
            cycles: { create: { cycleNumber: 1, formVersion: { create: { status: "PUBLISHED", versionNumber: 1, form: { create: { name: "Test Form" } } } }, status: KycStatus.UNDER_REVIEW, isCurrentCycle: true } }
        },
        },
      },
    });
    const loc = await callDispatcher();
    expect(loc).toBe("http://localhost/kyc/under-review");
  });

  it("F. routes to /kyc/rejected for REJECTED KYC", async () => {
    const user = await mockGoogleSession();
    await db.merchantProfile.create({
      data: {
        userId: user.id,
        accountStatus: AccountStatus.PENDING,
        kycApplication: {
          create: {
            cycles: { create: { cycleNumber: 1, formVersion: { create: { status: "PUBLISHED", versionNumber: 1, form: { create: { name: "Test Form" } } } }, status: KycStatus.REJECTED, isCurrentCycle: true } }
        },
        },
      },
    });
    const loc = await callDispatcher();
    expect(loc).toBe("http://localhost/kyc/rejected");
  });

  it("G. routes to /pending-approval for APPROVED KYC but PENDING account", async () => {
    const user = await mockGoogleSession();
    await db.merchantProfile.create({
      data: {
        userId: user.id,
        accountStatus: AccountStatus.PENDING,
        kycApplication: {
          create: {
            cycles: { create: { cycleNumber: 1, formVersion: { create: { status: "PUBLISHED", versionNumber: 1, form: { create: { name: "Test Form" } } } }, status: KycStatus.APPROVED, isCurrentCycle: true } }
        },
        },
      },
    });
    const loc = await callDispatcher();
    expect(loc).toBe("http://localhost/pending-approval");
  });

  it("H. routes to /login?error=account_suspended for SUSPENDED account", async () => {
    const user = await mockGoogleSession();
    await db.merchantProfile.create({
      data: {
        userId: user.id,
        accountStatus: AccountStatus.SUSPENDED,
      },
    });
    const loc = await callDispatcher();
    expect(loc).toBe("http://localhost/login?error=account_suspended");
  });

  it("I. ignores query string next parameter (prevent destination bypass)", async () => {
    await mockGoogleSession();
    // User attempts to bypass onboarding and go to dashboard
    const loc = await callDispatcher("http://localhost/auth-sync?next=/dashboard");
    expect(loc).toBe("http://localhost/onboarding"); // Authoritative state wins
  });

  it("J. ignores query string redirect parameter (prevent open redirect)", async () => {
    await mockGoogleSession();
    const loc = await callDispatcher("http://localhost/auth-sync?redirect=https://malicious.com");
    expect(loc).toBe("http://localhost/onboarding");
  });
});
