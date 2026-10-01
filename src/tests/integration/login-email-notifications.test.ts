import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/infrastructure/database/db";
import { auth } from "@/modules/auth/infrastructure/auth";
import { emailOutboxPayloadSchema } from "@/infrastructure/notifications/mailer";
import * as outboxDispatcher from "@/modules/notifications/application/email-outbox.dispatcher";

vi.mock("@/modules/notifications/application/email-outbox.dispatcher", () => ({
  triggerImmediateEmailDispatch: vi.fn()
}));

describe("Login Email Notifications", () => {
  let user: any;

  beforeEach(async () => {
    await db.outboxEvent.deleteMany();
    await db.session.deleteMany();
    await db.notificationPreference.deleteMany();
    await db.user.deleteMany();

    user = await db.user.create({
      data: { name: "Login Test User", email: "login@test.com", emailVerified: true, createdAt: new Date(Date.now() - 120000) }
    });
  });

  afterEach(async () => {
    await db.outboxEvent.deleteMany();
    await db.session.deleteMany();
    await db.notificationPreference.deleteMany();
    await db.user.deleteMany();
  });

  it("1. Creates a LOGIN_NOTIFICATION outbox event and invokes triggerImmediateEmailDispatch", async () => {
    vi.clearAllMocks();
    await db.notificationPreference.create({
      data: { userId: user.id, loginEmailsEnabled: true, kycEmailsEnabled: true }
    });

    const session = await db.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 100000),
        token: "test-token-123",
        ipAddress: "127.0.0.1",
        userAgent: "Test"
      }
    });

    const hooks = (auth as any).options.databaseHooks.session.create;
    if (hooks && hooks.after) {
      await hooks.after(session);
    }

    const events = await db.outboxEvent.findMany();
    expect(events.length).toBe(1);
    expect(events[0].referenceType).toBe("EMAIL_DISPATCH");
    expect(events[0].referenceId).toBe("LOGIN_" + session.id);

    const payload = emailOutboxPayloadSchema.parse(events[0].payload);
    expect(payload.templateId).toBe("LOGIN_NOTIFICATION");
    expect((payload as any).templateVariables.name).toBe("Login Test User");

    expect(outboxDispatcher.triggerImmediateEmailDispatch).toHaveBeenCalled();
  });

  it("1b. Suppresses initial-registration login notification", async () => {
    vi.clearAllMocks();
    await db.notificationPreference.create({
      data: { userId: user.id, loginEmailsEnabled: true, kycEmailsEnabled: true }
    });

    const newRegistrationUser = await db.user.create({
      data: { name: "New Reg", email: "newreg@test.com", emailVerified: true, createdAt: new Date() }
    });

    const session = await db.session.create({
      data: {
        userId: newRegistrationUser.id,
        expiresAt: new Date(Date.now() + 100000),
        token: "test-token-initial",
        createdAt: new Date(), // Delta is < 60s
        ipAddress: "127.0.0.1",
        userAgent: "Test"
      }
    });

    const hooks = (auth as any).options.databaseHooks.session.create;
    if (hooks && hooks.after) {
      await hooks.after(session);
    }

    const events = await db.outboxEvent.findMany({ where: { referenceId: "LOGIN_" + session.id } });
    expect(events.length).toBe(0);
    expect(outboxDispatcher.triggerImmediateEmailDispatch).not.toHaveBeenCalled();
  });

  it("2. Does NOT create an event when loginEmailsEnabled = false", async () => {
    await db.notificationPreference.create({
      data: { userId: user.id, loginEmailsEnabled: false, kycEmailsEnabled: true }
    });

    const session = await db.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 100000),
        token: "test-token-456",
        ipAddress: "127.0.0.1",
        userAgent: "Test"
      }
    });

    const hooks = (auth as any).options.databaseHooks.session.create;
    if (hooks && hooks.after) {
      await hooks.after(session);
    }

    const events = await db.outboxEvent.findMany();
    expect(events.length).toBe(0);
  });

  it("3. Repeated invocation safely violate the unique constraint and do not duplicate events", async () => {
    await db.notificationPreference.create({
      data: { userId: user.id, loginEmailsEnabled: true, kycEmailsEnabled: true }
    });

    const session = await db.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 100000),
        token: "test-token-789",
        ipAddress: "127.0.0.1",
        userAgent: "Test"
      }
    });

    const hooks = (auth as any).options.databaseHooks.session.create;
    if (hooks && hooks.after) {
      await hooks.after(session);
      await hooks.after(session);
    }

    const events = await db.outboxEvent.findMany();
    expect(events.length).toBe(1);
  });
});
