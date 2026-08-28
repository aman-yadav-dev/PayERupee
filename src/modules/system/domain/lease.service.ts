import { db } from "@/infrastructure/database/db";

/**
 * Attempts to acquire a system lease.
 * @param resource The globally unique resource name (e.g. "OUTBOX_SWEEPER")
 * @param owner The unique identifier of the worker acquiring the lease
 * @param ttlSeconds How long the lease is valid
 * @returns true if lease was acquired, false if held by someone else
 */
export async function acquireSystemLease(resource: string, owner: string, ttlSeconds: number): Promise<boolean> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  // 1. Try to take over an expired lease or renew our own
  const updated = await db.systemLease.updateMany({
    where: {
      resource,
      OR: [
        { expiresAt: { lt: new Date() } },
        { owner: owner }
      ]
    },
    data: {
      owner,
      expiresAt
    }
  });

  if (updated.count > 0) {
    return true;
  }

  // 2. If no lease was updated, try to create it if it doesn't exist
  try {
    await db.systemLease.create({
      data: {
        resource,
        owner,
        expiresAt
      }
    });
    return true;
  } catch (error: any) {
    // P2002 means the resource already exists (and must be locked by someone else, since our updateMany failed)
    if (error.code === 'P2002') {
      return false;
    }
    throw error;
  }
}

/**
 * Releases a system lease held by the current owner.
 */
export async function releaseSystemLease(resource: string, owner: string): Promise<void> {
  await db.systemLease.updateMany({
    where: {
      resource,
      owner
    },
    data: {
      expiresAt: new Date(Date.now() - 1000) // Expire it immediately
    }
  });
}
