import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { auth } from "@/modules/auth/infrastructure/auth";

describe("Real Registration Lifecycle", () => {
  beforeEach(async () => {
    await db.notificationPreference.deleteMany({ where: { user: { email: "newreg_lifecycle@test.com" } } });
    await db.user.deleteMany({ where: { email: "newreg_lifecycle@test.com" } });
  });

  afterEach(async () => {
    await db.notificationPreference.deleteMany({ where: { user: { email: "newreg_lifecycle@test.com" } } });
    await db.user.deleteMany({ where: { email: "newreg_lifecycle@test.com" } });
  });

  it("Automatically creates NotificationPreference during actual Better Auth registration", async () => {
    // Perform actual sign-up via Better Auth server API
    const response = await auth.api.signUpEmail({
      body: {
        name: "Lifecycle Test",
        email: "newreg_lifecycle@test.com",
        password: "Password123!"
      }
    });

    expect(response.user.id).toBeDefined();

    // Verify the user exists
    const user = await db.user.findUnique({ where: { email: "newreg_lifecycle@test.com" } });
    expect(user).not.toBeNull();

    // Verify the hook executed and persisted the preference
    const prefs = await db.notificationPreference.findUnique({ where: { userId: user!.id } });
    expect(prefs).not.toBeNull();
    expect(prefs!.loginEmailsEnabled).toBe(true);
    expect(prefs!.kycEmailsEnabled).toBe(true);
  });
});
