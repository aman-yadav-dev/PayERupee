import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { forgotPasswordAction } from "@/actions/auth/forgot-password";
import { _resetTransporter, getTransporter } from "@/infrastructure/notifications/mailer";
import { db } from "@/infrastructure/database/db";

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
  cookies: vi.fn(() => ({
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock("@/config/env", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    env: { ...actual.env, SMTP_ENABLED: true },
  };
});

vi.mock("@/infrastructure/notifications/mailer", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    sendPasswordResetEmail: vi.fn(),
  };
});

describe("Forgot Password (Slice 1 - Backend)", () => {
  let mockSendResetMail: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mailer = await import("@/infrastructure/notifications/mailer");
    mockSendResetMail = vi.mocked(mailer.sendPasswordResetEmail);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await db.verification.deleteMany({});
    await db.user.deleteMany({});
  });

  it("should return generic success for unknown email (enumeration protection)", async () => {
    const res = await forgotPasswordAction({ email: "unknown@example.com" });

    expect(res.success).toBe(true);
    expect(res.message).toContain("If an account exists");

    // Better Auth simulates a verification token but DOES NOT send an email for unknown users
    expect(mockSendResetMail).not.toHaveBeenCalled();

    // Ensure no token was persisted
    const tokens = await db.verification.findMany();
    expect(tokens.length).toBe(0);
  });

  it("should invoke mailer and generate token for existing user", async () => {
    const user = await db.user.create({
      data: {
        name: "Test User",
        email: "existing@example.com",
        emailVerified: true,
      },
    });

    const res = await forgotPasswordAction({ email: "existing@example.com" });

    expect(res.success).toBe(true);
    expect(res.message).toContain("If an account exists");

    // Wait for the background task to complete
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Verify Mailer was called with the correct HTML and token
    expect(mockSendResetMail).toHaveBeenCalledTimes(1);

    const mailArgs = mockSendResetMail.mock.calls[0][0];
    expect(mailArgs.user.email).toBe("existing@example.com");
    expect(mailArgs.url).toContain("reset-password");
    expect(mailArgs.token).toBeDefined();

    // Verify the token was persisted in the database
    const tokenRecord = await db.verification.findFirst({
      where: { identifier: { startsWith: "reset-password:" } },
    });

    expect(tokenRecord).not.toBeNull();
    expect(tokenRecord?.value).toBe(user.id);
  });

  it("should reject malformed email", async () => {
    const res = await forgotPasswordAction({ email: "not-an-email" });

    expect(res.success).toBe(false);
    expect(res.errors?.email).toBeDefined();
    expect(mockSendResetMail).not.toHaveBeenCalled();
  });
});
