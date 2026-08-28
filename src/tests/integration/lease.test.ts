import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { acquireSystemLease, releaseSystemLease } from "@/modules/system/domain/lease.service";
import { db } from "@/infrastructure/database/db";

describe("SystemLease Concurrency & Semantics", () => {
  beforeAll(async () => {
    await db.systemLease.deleteMany({});
  });

  afterAll(async () => {
    await db.systemLease.deleteMany({});
  });

  it("should successfully acquire a fresh lease", async () => {
    const res = await acquireSystemLease("TEST_RESOURCE", "worker-1", 60);
    expect(res).toBe(true);

    const lease = await db.systemLease.findUnique({ where: { resource: "TEST_RESOURCE" } });
    expect(lease).toBeDefined();
    expect(lease?.owner).toBe("worker-1");
  });

  it("should fail to acquire if held by another worker and not expired", async () => {
    const res = await acquireSystemLease("TEST_RESOURCE", "worker-2", 60);
    expect(res).toBe(false);

    const lease = await db.systemLease.findUnique({ where: { resource: "TEST_RESOURCE" } });
    expect(lease?.owner).toBe("worker-1"); // Still belongs to worker 1
  });

  it("should allow the same owner to extend/re-acquire the lease", async () => {
    const res = await acquireSystemLease("TEST_RESOURCE", "worker-1", 120);
    expect(res).toBe(true);
  });

  it("should allow another worker to acquire if lease is expired", async () => {
    // Manually expire the lease
    await db.systemLease.update({
      where: { resource: "TEST_RESOURCE" },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });

    const res = await acquireSystemLease("TEST_RESOURCE", "worker-3", 60);
    expect(res).toBe(true);

    const lease = await db.systemLease.findUnique({ where: { resource: "TEST_RESOURCE" } });
    expect(lease?.owner).toBe("worker-3");
  });

  it("should release the lease cleanly", async () => {
    await releaseSystemLease("TEST_RESOURCE", "worker-3");

    // Another worker can now grab it
    const res = await acquireSystemLease("TEST_RESOURCE", "worker-4", 60);
    expect(res).toBe(true);
    await releaseSystemLease("TEST_RESOURCE", "worker-4");
  });

  it("should only allow 1 worker to acquire concurrently", async () => {
    await db.systemLease.deleteMany({ where: { resource: "RACE_CONDITION_TEST" } });

    const workers = ["W1", "W2", "W3", "W4", "W5"];
    
    // Fire all at the EXACT same time
    const results = await Promise.all(
      workers.map(w => acquireSystemLease("RACE_CONDITION_TEST", w, 60))
    );

    const acquiredCount = results.filter(r => r === true).length;
    expect(acquiredCount).toBe(1);

    const lease = await db.systemLease.findUnique({ where: { resource: "RACE_CONDITION_TEST" } });
    expect(workers.includes(lease!.owner)).toBe(true);
  });
});
