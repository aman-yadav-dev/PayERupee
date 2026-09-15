import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { AccountStatus } from "@prisma/client";
import { POST as authHandler } from "@/app/api/v1/auth/[...all]/route";
import { NextRequest } from "next/server";

describe("Real Better Auth HTTP Boundary", () => {
  const uId = "http-bound-u1";
  const mId = "http-bound-m1";
  const testEmail = "httpbound@test.com";
  const testPassword = "password123";

  beforeEach(async () => {
    try {
      await db.session.deleteMany();
      await db.merchantProfile.deleteMany();
      await db.user.deleteMany();
    } catch (e) {}
  });

  afterEach(async () => {
    try {
      await db.session.deleteMany();
      await db.merchantProfile.deleteMany();
      await db.user.deleteMany();
    } catch (e) {}
  });

  async function createUserAndProfile(status: AccountStatus) {
    // Need to use the actual better-auth hash if we want it to validate the password,
    // or we can just create the user via Better Auth and then update the profile status.
    const req = new NextRequest("http://localhost/api/v1/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword, name: "Test" })
    });
    const res = await authHandler(req);
    const data = await res.json();
    if (!data.user) {
       console.error("Sign-up failed: ", data);
       throw new Error("Failed to create user in test");
    }
    const createdUserId = data.user.id;
    
    // Clear the session created by sign-up so we can test sign-in
    await db.session.deleteMany({ where: { userId: createdUserId } });

    await db.merchantProfile.create({
      data: { id: mId, userId: createdUserId, businessName: "B", accountStatus: status }
    });
    
    return createdUserId;
  }

  async function attemptSignIn() {
    const req = new NextRequest("http://localhost/api/v1/auth/sign-in/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, password: testPassword })
    });
    const res = await authHandler(req);
    return res;
  }

  it("A. ACTIVE merchant - authentication succeeds and Session exists", async () => {
    const userId = await createUserAndProfile(AccountStatus.ACTIVE);
    const res = await attemptSignIn();
    
    expect(res.status).toBe(200);

    const count = await db.session.count({ where: { userId } });
    expect(count).toBe(1);
  });

  it("B. SUSPENDED merchant - authentication fails and no Session exists", async () => {
    const userId = await createUserAndProfile(AccountStatus.SUSPENDED);
    const res = await attemptSignIn();
    
    expect(res.status).toBe(401);
    
    const count = await db.session.count({ where: { userId } });
    expect(count).toBe(0);
  });

  it("C. DELETED merchant - authentication fails and no Session exists", async () => {
    const userId = await createUserAndProfile(AccountStatus.DELETED);
    const res = await attemptSignIn();
    
    expect(res.status).toBe(401);
    
    const count = await db.session.count({ where: { userId } });
    expect(count).toBe(0);
  });
});
