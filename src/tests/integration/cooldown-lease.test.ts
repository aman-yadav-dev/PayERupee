import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/modules/auth/infrastructure/auth";
import { setSystemLease, getActiveSystemLease } from "@/modules/system/domain/lease.service";
import * as mailer from "@/infrastructure/notifications/mailer";
import { resendVerificationEmailAction } from "@/actions/auth/resend";
import { db } from "@/infrastructure/database/db";

// Mock the dependencies
vi.mock("@/infrastructure/notifications/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/notifications/mailer")>();
  return {
    ...actual,
    sendVerificationEmail: vi.fn(),
  };
});

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
}));

describe("Server-Side Email Dispatch Cooldown Architecture", () => {
  const mockUserId = "user_test_cooldown";
  const resourceKey = `email_verification_cooldown_${mockUserId}`;

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.systemLease.deleteMany({
      where: { owner: mockUserId }
    });

    // Mock session for the user
    vi.spyOn(auth.api, "getSession").mockResolvedValue({
      session: { id: "sess_1", userId: mockUserId, createdAt: new Date(), updatedAt: new Date(), expiresAt: new Date(), ipAddress: null, userAgent: null },
      user: { id: mockUserId, email: "test@example.com", name: "Test", emailVerified: false, createdAt: new Date(), updatedAt: new Date(), role: "MERCHANT" }
    } as any);
  });

  it("A. Successful mailer dispatch creates a 30-second cooldown lease", async () => {
    // Mock mailer to succeed
    vi.mocked(mailer.sendVerificationEmail).mockResolvedValueOnce(undefined);

    // Call the Better Auth sendVerificationEmail callback directly as it would run in background
    await auth.options.emailVerification?.sendVerificationEmail!({
      user: { id: mockUserId, email: "test@example.com", name: "Test" } as any,
      url: "http://localhost/verify?token=123",
      token: "123"
    });

    // Verify lease was created
    const lease = await getActiveSystemLease(resourceKey);
    expect(lease).not.toBeNull();
    expect(lease?.owner).toBe(mockUserId);

    // Should expire ~30s from now
    const timeDiff = lease!.expiresAt.getTime() - Date.now();
    expect(timeDiff).toBeGreaterThan(28000);
    expect(timeDiff).toBeLessThanOrEqual(30000);
  });

  it("B. Failed mailer dispatch does NOT create a cooldown lease", async () => {
    // Mock mailer to fail
    vi.mocked(mailer.sendVerificationEmail).mockRejectedValueOnce(new Error("SMTP failure"));

    try {
      await auth.options.emailVerification?.sendVerificationEmail!({
        user: { id: mockUserId, email: "test@example.com", name: "Test" } as any,
        url: "http://localhost/verify?token=123",
        token: "123"
      });
    } catch (e) {
      // Expected to throw natively before Better Auth swallows it
    }

    // Verify lease was NOT created
    const lease = await getActiveSystemLease(resourceKey);
    expect(lease).toBeNull();
  });

  it("C. Successful subsequent resend via Action refreshes the cooldown", async () => {
    // Setup initial expired lease
    await setSystemLease(resourceKey, mockUserId, -10); // Expired 10s ago

    vi.mocked(mailer.sendVerificationEmail).mockResolvedValueOnce(undefined);

    // Mock Better Auth's API to directly invoke the callback
    vi.spyOn(auth.api, "sendVerificationEmail").mockImplementationOnce(async () => {
      await auth.options.emailVerification?.sendVerificationEmail!({
        user: { id: mockUserId, email: "test@example.com", name: "Test" } as any,
        url: "http://localhost/verify?token=123",
        token: "123"
      });
      return { status: true } as any;
    });

    const res = await resendVerificationEmailAction("http://localhost/callback");

    if (!res.success) {
      console.error("Test C Failed: ", res.error);
    }
    expect(res.success).toBe(true);
    expect(res.expiresAt).toBeDefined();

    // Verify lease was refreshed
    const lease = await getActiveSystemLease(resourceKey);
    expect(lease).not.toBeNull();

    const timeDiff = lease!.expiresAt.getTime() - Date.now();
    expect(timeDiff).toBeGreaterThan(28000);
  });

  it("D. Failed subsequent resend via Action does NOT refresh/start the cooldown", async () => {
    // Start with no lease

    // Mock mailer to fail
    vi.mocked(mailer.sendVerificationEmail).mockRejectedValueOnce(new Error("SMTP failure"));

    // Mock Better Auth's API to directly invoke the callback
    vi.spyOn(auth.api, "sendVerificationEmail").mockImplementationOnce(async () => {
      try {
        await auth.options.emailVerification?.sendVerificationEmail!({
          user: { id: mockUserId, email: "test@example.com", name: "Test" } as any,
          url: "http://localhost/verify?token=123",
          token: "123"
        });
      } catch (e) {
        // swallow
      }
      return { status: true } as any;
    });

    const res = await resendVerificationEmailAction("http://localhost/callback");

    // Action should fail gracefully
    expect(res.success).toBe(false);
    expect(res.error).toContain("Failed");

    // Verify lease was still not created
    const lease = await getActiveSystemLease(resourceKey);
    expect(lease).toBeNull();
  });
});
