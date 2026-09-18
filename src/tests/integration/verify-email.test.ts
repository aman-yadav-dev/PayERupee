import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { resolveAuthDestination } from "@/modules/auth/application/destination.service";
import { AccountStatus, KycStatus } from "@prisma/client";

describe("Email Verification Lifecycle", () => {
  describe("Destination Routing Enforcements", () => {
    it("routes unverified users to /verify-email", () => {
      const destination = resolveAuthDestination({
        session: {
          user: {
            id: "user_123",
            emailVerified: false, // Unverified
          },
        },
        profile: {
          accountStatus: "PENDING",
        },
      });

      expect(destination).toBe("/verify-email");
    });

    it("routes verified users to their expected destination (e.g. /kyc/start)", () => {
      const destination = resolveAuthDestination({
        session: {
          user: {
            id: "user_123",
            emailVerified: true, // Verified
          },
        },
        profile: {
          accountStatus: "PENDING",
          kycApplication: null, // No KYC started
        },
      });

      expect(destination).toBe("/kyc/start");
    });

    it("preserves Google Auth bypass (Google sets emailVerified to true natively)", () => {
      const destination = resolveAuthDestination({
        session: {
          user: {
            id: "user_123",
            emailVerified: true, // Google sets this immediately
          },
        },
        profile: null, // Google users lack a MerchantProfile initially
      });

      expect(destination).toBe("/onboarding");
    });

    it("preserves suspended account protection even if verified", () => {
      const destination = resolveAuthDestination({
        session: {
          user: {
            id: "user_123",
            emailVerified: true,
          },
        },
        profile: {
          accountStatus: "SUSPENDED",
        },
      });

      expect(destination).toBe("/login?error=account_suspended");
    });
  });
});
