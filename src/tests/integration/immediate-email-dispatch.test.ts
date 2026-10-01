import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { triggerImmediateEmailDispatch } from "@/modules/notifications/application/email-outbox.dispatcher";
import * as processor from "@/modules/notifications/application/email-outbox.processor";
import { randomUUID } from "crypto";

// Mock nodemailer exactly like the other tests to prevent real SMTP connections
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

describe("Immediate Email Dispatch", () => {
  beforeEach(async () => {
    // Clear previously tested events and leases
    await db.outboxEvent.deleteMany({ where: { referenceType: "EMAIL_DISPATCH" } });
    await db.systemLease.deleteMany();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("SUCCESS CASE: immediately dispatches and completes successfully", async () => {
    // Force SMTP to succeed
    __sendMailMock.mockResolvedValueOnce(true);
    
    const spy = vi.spyOn(processor, 'processEmailOutbox');

    // Create a valid EMAIL_DISPATCH event (GENERIC_NOTIFICATION is supported)
    const event = await db.outboxEvent.create({
      data: {
        referenceType: "EMAIL_DISPATCH",
        referenceId: `SUCCESS_TEST_${randomUUID()}`,
        payload: {
          to: "success@test.com",
          subject: "Success Test",
          templateId: "GENERIC_NOTIFICATION",
          templateVariables: { message: "Hello Success" }
        }
      }
    });

    // Trigger the immediate dispatcher
    triggerImmediateEmailDispatch();

    // Wait for the fire-and-forget promise to resolve
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(spy).toHaveBeenCalled();

    // Assert status became COMPLETED and attempts incremented
    const updatedEvent = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updatedEvent.status).toBe("COMPLETED");
    expect(updatedEvent.attempts).toBe(1);
    expect(updatedEvent.lastError).toBeNull();
  });

  it("FAILURE CASE: gracefully handles SMTP/processing failure without throwing to caller", async () => {
    // Force SMTP to fail with a retriable network/SMTP error
    __sendMailMock.mockRejectedValueOnce(new Error("Simulated SMTP timeout"));
    
    const spy = vi.spyOn(processor, 'processEmailOutbox');

    // Create a valid event (so it passes schema validation but fails at SMTP dispatch)
    const event = await db.outboxEvent.create({
      data: {
        referenceType: "EMAIL_DISPATCH",
        referenceId: `FAILURE_TEST_${randomUUID()}`,
        payload: {
          to: "fail@test.com",
          subject: "Failure Test",
          templateId: "GENERIC_NOTIFICATION",
          templateVariables: { message: "Hello Fail" }
        }
      }
    });

    // The business logic calling this must not throw
    expect(() => {
      triggerImmediateEmailDispatch();
    }).not.toThrow();

    await new Promise(resolve => setTimeout(resolve, 300));
    expect(spy).toHaveBeenCalled();

    const updatedEvent = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    
    // Status should remain PENDING for scheduled recovery
    expect(updatedEvent.status).toBe("PENDING");
    
    // Attempts incremented by the processor
    expect(updatedEvent.attempts).toBe(1);
    
    // Error recorded
    expect(updatedEvent.lastError).toContain("Failed to dispatch transactional email");
    
    // NextRunAt scheduled in the future (retry backoff)
    expect(updatedEvent.nextRunAt.getTime()).toBeGreaterThan(event.nextRunAt.getTime());
  });

  it("LEASE CONTENTION CASE: degrades gracefully if another worker holds the EMAIL_SWEEPER lease", async () => {
    // Acquire the lease manually to simulate cron/other instance running
    const { acquireSystemLease } = await import("@/modules/system/domain/lease.service");
    await acquireSystemLease("EMAIL_SWEEPER", "cron-worker-id", 300);

    const spy = vi.spyOn(processor, 'processEmailOutbox');

    const event = await db.outboxEvent.create({
      data: {
        referenceType: "EMAIL_DISPATCH",
        referenceId: `LEASE_TEST_${randomUUID()}`,
        payload: {
          to: "lease@test.com",
          subject: "Lease Test",
          templateId: "GENERIC_NOTIFICATION",
          templateVariables: { message: "Hello Lease" }
        }
      }
    });

    triggerImmediateEmailDispatch();
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(spy).toHaveBeenCalled();

    // Event should remain completely untouched because the lease prevented processing
    const updatedEvent = await db.outboxEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(updatedEvent.status).toBe("PENDING");
    expect(updatedEvent.attempts).toBe(0);
    expect(updatedEvent.lastError).toBeNull();
  });
});
