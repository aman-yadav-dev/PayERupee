import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resetPasswordAction } from "@/actions/auth/reset-password";
import { db } from "@/infrastructure/database/db";
import { generateId } from "@better-auth/core/utils/id";
import { auth } from "@/modules/auth/infrastructure/auth";

vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
  cookies: vi.fn(() => ({
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  })),
}));

describe("Reset Password (Slice 2 - Token Consumption)", () => {
  beforeEach(async () => {
    await db.session.deleteMany({});
    await db.verification.deleteMany({});
    await db.user.deleteMany({});
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await db.session.deleteMany({});
    await db.verification.deleteMany({});
    await db.user.deleteMany({});
  });

  it("should successfully reset password, consume token, and revoke sessions", async () => {
    const user = await db.user.create({
      data: {
        name: "Test User",
        email: "reset@example.com",
        emailVerified: true,
      },
    });

    const account = await db.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: "OldPassword123!",
      },
    });

    const session = await db.session.create({
      data: {
        userId: user.id,
        token: "old-session-token",
        expiresAt: new Date(Date.now() + 1000000),
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      },
    });

    const tokenValue = generateId(24);
    await db.verification.create({
      data: {
        identifier: `reset-password:${tokenValue}`,
        value: user.id,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const res = await resetPasswordAction({
      password: "NewPassword123!",
      confirmPassword: "NewPassword123!",
      token: tokenValue,
    });

    expect(res.success).toBe(true);

    // Assert Verification record consumed/deleted
    const tokens = await db.verification.findMany();
    expect(tokens.length).toBe(0);

    // Assert session revocation
    const sessions = await db.session.findMany({ where: { userId: user.id } });
    expect(sessions.length).toBe(0);

    // Assert password credential hash changed
    const updatedAccount = await db.account.findFirst({ where: { userId: user.id } });
    expect(updatedAccount?.password).not.toBe(account.password);

    // No auto-login
    const newSessions = await db.session.findMany();
    expect(newSessions.length).toBe(0);
  });

  it("should return INVALID_TOKEN for fake or malformed token", async () => {
    const res = await resetPasswordAction({
      password: "NewPassword123!",
      confirmPassword: "NewPassword123!",
      token: "fake-token",
    });

    expect(res.success).toBe(false);
    expect(res.message).toContain("invalid or has expired");
  });

  it("should return INVALID_TOKEN for expired token", async () => {
    const user = await db.user.create({
      data: { name: "Test User", email: "reset@example.com" },
    });

    const tokenValue = "expired-token";
    await db.verification.create({
      data: {
        identifier: `reset-password:${tokenValue}`,
        value: user.id,
        expiresAt: new Date(Date.now() - 3600000), // Past
      },
    });

    const res = await resetPasswordAction({
      password: "NewPassword123!",
      confirmPassword: "NewPassword123!",
      token: tokenValue,
    });

    expect(res.success).toBe(false);
    expect(res.message).toContain("invalid or has expired");
  });

  it("should return INVALID_TOKEN on second consumption attempt", async () => {
    const user = await db.user.create({
      data: { name: "Test User", email: "reset@example.com" },
    });

    await db.account.create({
      data: { userId: user.id, accountId: user.id, providerId: "credential", password: "OldPassword123!" },
    });

    const tokenValue = generateId(24);
    await db.verification.create({
      data: {
        identifier: `reset-password:${tokenValue}`,
        value: user.id,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    const firstRes = await resetPasswordAction({
      password: "NewPassword123!",
      confirmPassword: "NewPassword123!",
      token: tokenValue,
    });
    expect(firstRes.success).toBe(true);

    const secondRes = await resetPasswordAction({
      password: "NewPassword123!",
      confirmPassword: "NewPassword123!",
      token: tokenValue,
    });
    expect(secondRes.success).toBe(false);
    expect(secondRes.message).toContain("invalid or has expired");
  });

  it("should reject invalid schema without calling API (server-side validation bypass)", async () => {
    const apiSpy = vi.spyOn(auth.api, "resetPassword");

    // Missing uppercase and special char
    const res = await resetPasswordAction({
      password: "weakpassword123",
      confirmPassword: "weakpassword123",
      token: "some-token",
    });

    expect(res.success).toBe(false);
    // @ts-ignore
    expect(res.errors?.password).toBeDefined();

    // Mismatch
    const res2 = await resetPasswordAction({
      password: "StrongPassword123!",
      confirmPassword: "StrongPassword456!",
      token: "some-token",
    });

    expect(res2.success).toBe(false);
    // @ts-ignore
    expect(res2.errors?.confirmPassword).toBeDefined();

    expect(apiSpy).not.toHaveBeenCalled();
    apiSpy.mockRestore();
  });

  it("should handle multiple outstanding tokens correctly (Better Auth actual behavior)", async () => {
    const user = await db.user.create({
      data: { name: "Test User", email: "reset@example.com" },
    });

    await db.account.create({
      data: { userId: user.id, accountId: user.id, providerId: "credential", password: "OldPassword123!" },
    });

    const tokenA = generateId(24);
    const tokenB = generateId(24);

    await db.verification.create({
      data: { identifier: `reset-password:${tokenA}`, value: user.id, expiresAt: new Date(Date.now() + 3600000) },
    });
    await db.verification.create({
      data: { identifier: `reset-password:${tokenB}`, value: user.id, expiresAt: new Date(Date.now() + 3600000) },
    });

    // Consume A
    const resA = await resetPasswordAction({
      password: "NewPasswordA123!",
      confirmPassword: "NewPasswordA123!",
      token: tokenA,
    });
    expect(resA.success).toBe(true);

    // Check if B still exists in DB
    const verificationB = await db.verification.findFirst({ where: { identifier: `reset-password:${tokenB}` } });
    expect(verificationB).not.toBeNull();

    // B is still valid and consumable
    const resB = await resetPasswordAction({
      password: "NewPasswordB123!",
      confirmPassword: "NewPasswordB123!",
      token: tokenB,
    });
    expect(resB.success).toBe(true);
  });
});
