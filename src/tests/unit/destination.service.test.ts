import { describe, it, expect } from "vitest";
import { resolveAuthDestination, DestinationContext } from "../../modules/auth/application/destination.service";
import { AccountStatus, KycStatus } from "@prisma/client";

describe("Destination Service (AUTH-LIFE-1)", () => {
  
  function buildContext(overrides: Partial<DestinationContext> = {}): DestinationContext {
    return {
      session: { user: { id: "user-1", emailVerified: true } },
      profile: {
        accountStatus: "PENDING" as AccountStatus,
        kycApplication: null,
      },
      ...overrides,
    };
  }

  it("returns /login when no session exists", () => {
    const ctx = buildContext({ session: null });
    expect(resolveAuthDestination(ctx)).toBe("/login");
  });

  it("returns /onboarding when session exists but no profile exists", () => {
    const ctx = buildContext({ profile: null });
    expect(resolveAuthDestination(ctx)).toBe("/onboarding");
  });

  it("returns /login?error=account_suspended for SUSPENDED accounts", () => {
    const ctx = buildContext({
      profile: { accountStatus: "SUSPENDED" as AccountStatus, kycApplication: null },
    });
    expect(resolveAuthDestination(ctx)).toBe("/login?error=account_suspended");
  });

  it("returns /login?error=account_suspended for DELETED accounts", () => {
    const ctx = buildContext({
      profile: { accountStatus: "DELETED" as AccountStatus, kycApplication: null },
    });
    expect(resolveAuthDestination(ctx)).toBe("/login?error=account_suspended");
  });

  it("returns /kyc/start for PENDING accounts with NO kyc application", () => {
    const ctx = buildContext({
      profile: { accountStatus: "PENDING" as AccountStatus, kycApplication: null },
    });
    expect(resolveAuthDestination(ctx)).toBe("/kyc/start");
  });

  it("returns /pending-approval for PENDING accounts with PENDING_SUBMISSION kyc (fallback)", () => {
    const ctx = buildContext({
      profile: { 
        accountStatus: "PENDING" as AccountStatus, 
        kycApplication: { status: "PENDING_SUBMISSION" as KycStatus, allowResubmission: false }
      },
    });
    expect(resolveAuthDestination(ctx)).toBe("/pending-approval");
  });

  it("returns /pending-approval for PENDING accounts with UNDER_REVIEW kyc (fallback)", () => {
    const ctx = buildContext({
      profile: { 
        accountStatus: "PENDING" as AccountStatus, 
        kycApplication: { status: "UNDER_REVIEW" as KycStatus, allowResubmission: false }
      },
    });
    expect(resolveAuthDestination(ctx)).toBe("/pending-approval");
  });

  it("returns /pending-approval for PENDING accounts with REJECTED kyc (resubmission allowed fallback)", () => {
    const ctx = buildContext({
      profile: { 
        accountStatus: "PENDING" as AccountStatus, 
        kycApplication: { status: "REJECTED" as KycStatus, allowResubmission: true }
      },
    });
    expect(resolveAuthDestination(ctx)).toBe("/pending-approval");
  });

  it("returns /pending-approval for PENDING accounts with REJECTED kyc (terminal fallback)", () => {
    const ctx = buildContext({
      profile: { 
        accountStatus: "PENDING" as AccountStatus, 
        kycApplication: { status: "REJECTED" as KycStatus, allowResubmission: false }
      },
    });
    expect(resolveAuthDestination(ctx)).toBe("/pending-approval");
  });

  it("returns /pending-approval for PENDING accounts with APPROVED kyc (awaiting admin)", () => {
    const ctx = buildContext({
      profile: { 
        accountStatus: "PENDING" as AccountStatus, 
        kycApplication: { status: "APPROVED" as KycStatus, allowResubmission: false }
      },
    });
    expect(resolveAuthDestination(ctx)).toBe("/pending-approval");
  });

  it("returns /dashboard for ACTIVE accounts with APPROVED kyc", () => {
    const ctx = buildContext({
      profile: { 
        accountStatus: "ACTIVE" as AccountStatus, 
        kycApplication: { status: "APPROVED" as KycStatus, allowResubmission: false }
      },
    });
    expect(resolveAuthDestination(ctx)).toBe("/dashboard");
  });

  it("returns /pending-approval for ACTIVE accounts with missing KYC (unsafe fallback)", () => {
    const ctx = buildContext({
      profile: { 
        accountStatus: "ACTIVE" as AccountStatus, 
        kycApplication: null
      },
    });
    expect(resolveAuthDestination(ctx)).toBe("/pending-approval");
  });

  it("returns /pending-approval for ACTIVE accounts with REJECTED KYC (unsafe fallback)", () => {
    const ctx = buildContext({
      profile: { 
        accountStatus: "ACTIVE" as AccountStatus, 
        kycApplication: { status: "REJECTED" as KycStatus, allowResubmission: false }
      },
    });
    expect(resolveAuthDestination(ctx)).toBe("/pending-approval");
  });

});
