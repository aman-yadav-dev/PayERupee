import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { processEmailOutbox } from "@/modules/notifications/application/email-outbox.processor";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/cron/email-outbox/route";
import { dispatchOutboxEmail, _resetTransporter } from "@/infrastructure/notifications/mailer";

vi.mock("@/config/env", () => ({
  env: { 
    CRON_SECRET: "test-secret",
    SMTP_HOST: "smtp.test.local",
    SMTP_ENABLED: "true",
    SMTP_PORT: 587,
    SMTP_USER: "user",
    SMTP_PASSWORD: "pass"
  }
}));

import * as leaseService from "@/modules/system/domain/lease.service";
vi.mock("@/modules/system/domain/lease.service", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/modules/system/domain/lease.service")>();
  return {
    ...mod,
    acquireSystemLease: vi.fn(mod.acquireSystemLease)
  };
});

import * as nodemailer from "nodemailer";
const mockSendMail = vi.fn().mockResolvedValue(true);
vi.mock("nodemailer", () => {
  const innerMockSendMail = vi.fn().mockResolvedValue(true);
  return {
    createTransport: vi.fn().mockReturnValue({
      sendMail: innerMockSendMail,
    }),
    __sendMailMock: innerMockSendMail
  };
});
const { __sendMailMock } = vi.mocked(nodemailer as any);


describe("Email Outbox Processor - Concurrency & Locking", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    _resetTransporter();
    __sendMailMock.mockResolvedValue(true);
    await db.outboxEvent.deleteMany({ where: { referenceType: "EMAIL_DISPATCH" } });
  });

  const createEvent = async (payload: any = {}, overrides: any = {}) => {
    return await db.outboxEvent.create({
      data: {
        referenceType: "EMAIL_DISPATCH",
        referenceId: `email_test_${Date.now()}_${Math.random()}`,
        status: "PENDING",
        payload: {
          to: "test@example.com",
          subject: "Test Subject",
          templateId: "TEST_TEMPLATE",
          ...payload
        },
        ...overrides
      }
    });
  };

  it("1. success -> COMPLETED", async () => {
    const event = await createEvent();
    await processEmailOutbox("worker-1");
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.status).toBe("COMPLETED");
  });

  it("2. attempts increment", async () => {
    const event = await createEvent();
    await processEmailOutbox("worker-1");
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.attempts).toBe(1);
  });

  it("3. lock cleared after success", async () => {
    const event = await createEvent();
    await processEmailOutbox("worker-1");
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.lockedBy).toBeNull();
    expect(updated.lockedUntil).toBeNull();
  });

  it("4. SMTP failure -> PENDING", async () => {
    const event = await createEvent();
    __sendMailMock.mockRejectedValueOnce(new Error("SMTP Server Down"));
    await processEmailOutbox("worker-2");
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.status).toBe("PENDING");
  });

  it("5. retry nextRunAt", async () => {
    const event = await createEvent();
    __sendMailMock.mockRejectedValueOnce(new Error("SMTP Server Down"));
    await processEmailOutbox("worker-2");
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    const diff = updated.nextRunAt.getTime() - Date.now();
    expect(diff).toBeGreaterThan(59000); // ~1 min
    expect(diff).toBeLessThan(61000);
  });

  it("6. retry attempts increment", async () => {
    const event = await createEvent({}, { attempts: 2 });
    __sendMailMock.mockRejectedValueOnce(new Error("SMTP Server Down"));
    await processEmailOutbox("worker-2");
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.attempts).toBe(3);
  });

  it("7. final retry -> EXHAUSTED", async () => {
    const event = await createEvent({}, { attempts: 4 });
    __sendMailMock.mockRejectedValueOnce(new Error("SMTP Server Down"));
    await processEmailOutbox("worker-3");
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.status).toBe("EXHAUSTED");
    expect(updated.attempts).toBe(5);
  });

  it("8. malformed payload -> EXHAUSTED", async () => {
    const event = await createEvent({ to: undefined });
    await processEmailOutbox("worker-4");
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.status).toBe("EXHAUSTED");
    expect(updated.lastError).toMatch(/Malformed payload/);
    expect(__sendMailMock).not.toHaveBeenCalled();
  });

  it("9. unsupported template -> EXHAUSTED", async () => {
    const event = await createEvent({ templateId: "INVALID_TEMPLATE" });
    await processEmailOutbox("worker-5");
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.status).toBe("EXHAUSTED");
    expect(updated.lastError).toMatch(/Malformed payload/);
    expect(__sendMailMock).not.toHaveBeenCalled();
  });

  it("10. payout event ignored", async () => {
    const event = await db.outboxEvent.create({
      data: {
        referenceType: "PAYOUT_DISPATCH",
        referenceId: `payout_test_${Date.now()}_${Math.random()}`,
        status: "PENDING",
      }
    });
    await processEmailOutbox("worker-6");
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.lockedBy).toBeNull();
  });

  it("11. completed event ignored", async () => {
    const event = await createEvent({}, { status: "COMPLETED" });
    await processEmailOutbox("worker-7");
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.status).toBe("COMPLETED");
  });

  it("12. future nextRunAt ignored", async () => {
    const event = await createEvent({}, { nextRunAt: new Date(Date.now() + 60000) });
    await processEmailOutbox("worker-8");
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.attempts).toBe(0); 
  });

  it("13. active lock ignored", async () => {
    const event = await createEvent({}, { lockedUntil: new Date(Date.now() + 60000), lockedBy: "other-worker" });
    await processEmailOutbox("worker-9");
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.lockedBy).toBe("other-worker"); 
  });

  it("14. stale lock recovery", async () => {
    const event = await createEvent({}, { lockedUntil: new Date(Date.now() - 60000), lockedBy: "dead-worker" });
    await processEmailOutbox("worker-10");
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.status).toBe("COMPLETED"); 
  });

  it("15. lock ownership cannot be incorrectly finalized", async () => {
    const event = await createEvent();
    
    __sendMailMock.mockImplementationOnce(async () => {
      await db.outboxEvent.updateMany({
        where: { id: event.id },
        data: { lockedBy: "thief-worker", lockedUntil: new Date(Date.now() + 60000) }
      });
      return true;
    });

    await processEmailOutbox("worker-11");
    
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.status).toBe("PENDING");
    expect(updated.lockedBy).toBe("thief-worker");
  });

  it("16. cron rejects missing/invalid secret", async () => {
    const req = new NextRequest("http://localhost/api/cron/email-outbox"); 
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("17. cron accepts valid secret and processes EMAIL_DISPATCH only", async () => {
    const req = new NextRequest("http://localhost/api/cron/email-outbox", {
      headers: { "Authorization": `Bearer test-secret` }
    });
    const event = await createEvent();
    const res = await GET(req);
    expect(res.status).toBe(200);
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.status).toBe("COMPLETED");
  });

  it("18. error sanitization strips secrets", async () => {
    const event = await createEvent();
    
    // We mock dispatchOutboxEmail directly here to bypass the generic error wrapper in sendEmail
    // to prove the processor's own sanitization works for any thrown errors.
    const mailer = await import("@/infrastructure/notifications/mailer");
    vi.spyOn(mailer, "dispatchOutboxEmail").mockRejectedValueOnce(
      new Error("Failed connecting to smtp://admin:password123@smtp.mail.com due to network error")
    );
    
    await processEmailOutbox("worker-12");
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.lastError).toContain("smtp://***:***@smtp.mail.com");
    expect(updated.lastError).not.toContain("password123");
    expect(updated.lastError).not.toContain("admin");
  });

  it("19. lease failure prevents processing", async () => {
    const event = await createEvent();
    vi.mocked(leaseService.acquireSystemLease).mockResolvedValueOnce(false);
    
    await processEmailOutbox("worker-13");
    
    const updated = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updated.attempts).toBe(0);
    expect(__sendMailMock).not.toHaveBeenCalled();
  });
});

describe("dispatchOutboxEmail - Dispatcher Behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetTransporter();
  });

  it("TEST_TEMPLATE resolves correctly", async () => {
    await dispatchOutboxEmail({
      to: "a@b.com",
      subject: "Test",
      templateId: "TEST_TEMPLATE",
      templateVariables: {}
    });
    expect(__sendMailMock).toHaveBeenCalled();
    const args = __sendMailMock.mock.calls[0][0];
    expect(args.html).toContain("Test Email");
  });

  it("GENERIC_NOTIFICATION resolves correctly and escapes HTML", async () => {
    await dispatchOutboxEmail({
      to: "a@b.com",
      subject: "Test",
      templateId: "GENERIC_NOTIFICATION",
      templateVariables: { message: "<script>alert('xss')</script>" }
    });
    expect(__sendMailMock).toHaveBeenCalled();
    const args = __sendMailMock.mock.calls[0][0];
    expect(args.html).toContain("&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
    expect(args.html).not.toContain("<script>");
  });

  it("unsupported template cannot be dispatched (type cast bypass)", async () => {
    await expect(dispatchOutboxEmail({
      to: "a@b.com",
      subject: "Test",
      templateId: "UNKNOWN_TEMPLATE" as any,
      templateVariables: {}
    })).rejects.toThrow("Unsupported templateId");
  });
});
