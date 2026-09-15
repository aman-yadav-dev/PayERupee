import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { registerSchema } from "@/modules/auth/schemas/auth.schema";
import { registerMerchantAction } from "@/actions/auth/register";
import { db } from "@/infrastructure/database/db";
import { Prisma } from "@prisma/client";
import MerchantLayout from "@/app/(merchant)/layout";
import SetupLayout from "@/app/(setup)/layout";
import { auth } from "@/modules/auth/infrastructure/auth";
import { redirect } from "next/navigation";

// Mock Next.js utilities
vi.mock("next/headers", () => ({
  headers: vi.fn(() => new Headers()),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("Feature A1 - Registration Foundation", () => {
  // Test Email
  const testEmail = "test-a1-reg-user@example.com";
  const testPhone = "9998887776";

  beforeAll(async () => {
    const users = await db.user.findMany({ where: { email: testEmail } });
    for (const u of users) {
      const profile = await db.merchantProfile.findUnique({ where: { userId: u.id } });
      if (profile) {
        const ledgerAccounts = await db.ledgerAccount.findMany({ where: { merchantProfileId: profile.id } });
        const accountIds = ledgerAccounts.map(x => x.id);
        if (accountIds.length > 0) {
          await db.ledgerEntry.deleteMany({ 
            where: { 
              OR: [
                { debitAccountId: { in: accountIds } },
                { creditAccountId: { in: accountIds } }
              ] 
            } 
          });
        }
        await db.wallet.deleteMany({ where: { merchantProfileId: profile.id } });
        await db.ledgerAccount.deleteMany({ where: { merchantProfileId: profile.id } });
        await db.merchantProfile.delete({ where: { id: profile.id } });
      }
      await db.user.delete({ where: { id: u.id } });
    }
  });

  afterAll(async () => {
    const users = await db.user.findMany({ where: { email: testEmail } });
    for (const u of users) {
      const profile = await db.merchantProfile.findUnique({ where: { userId: u.id } });
      if (profile) {
        const ledgerAccounts = await db.ledgerAccount.findMany({ where: { merchantProfileId: profile.id } });
        const accountIds = ledgerAccounts.map(x => x.id);
        if (accountIds.length > 0) {
          await db.ledgerEntry.deleteMany({ 
            where: { 
              OR: [
                { debitAccountId: { in: accountIds } },
                { creditAccountId: { in: accountIds } }
              ] 
            } 
          });
        }
        await db.wallet.deleteMany({ where: { merchantProfileId: profile.id } });
        await db.ledgerAccount.deleteMany({ where: { merchantProfileId: profile.id } });
        await db.merchantProfile.delete({ where: { id: profile.id } });
      }
      await db.user.delete({ where: { id: u.id } });
    }
  });

  describe("Schema Validation", () => {
    it("accepts valid password", () => {
      const result = registerSchema.safeParse({
        name: "Test User",
        phone: "9998887776",
        email: "test@example.com",
        password: "ValidPassword123!",
        termsAccepted: true,
      });
      expect(result.success).toBe(true);
    });

    it("rejects password < 8 characters", () => {
      const result = registerSchema.safeParse({
        name: "Test", phone: "9998887776", email: "a@a.com",
        password: "Pass1!", termsAccepted: true
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors.password;
        expect(errors).toBeDefined();
        expect(errors?.some(e => e.includes("8 characters"))).toBe(true);
      }
    });

    it("rejects password without uppercase", () => {
      const result = registerSchema.safeParse({
        name: "Test", phone: "9998887776", email: "a@a.com",
        password: "password123!", termsAccepted: true
      });
      expect(result.success).toBe(false);
    });

    it("rejects password without lowercase", () => {
      const result = registerSchema.safeParse({
        name: "Test", phone: "9998887776", email: "a@a.com",
        password: "PASSWORD123!", termsAccepted: true
      });
      expect(result.success).toBe(false);
    });

    it("rejects password without number", () => {
      const result = registerSchema.safeParse({
        name: "Test", phone: "9998887776", email: "a@a.com",
        password: "Password!!", termsAccepted: true
      });
      expect(result.success).toBe(false);
    });

    it("rejects password without special character", () => {
      const result = registerSchema.safeParse({
        name: "Test", phone: "9998887776", email: "a@a.com",
        password: "Password123", termsAccepted: true
      });
      expect(result.success).toBe(false);
    });

    it("does not accept Company Name or Address", () => {
      const data = {
        name: "Test User",
        phone: "9998887776",
        email: "test@example.com",
        password: "ValidPassword123!",
        termsAccepted: true,
        businessName: "Acme", // Should be stripped
        address: "123 Street", // Should be stripped
      };
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty("businessName");
        expect(result.data).not.toHaveProperty("address");
      }
    });
  });

  describe("Backend Action", () => {
    it("successfully creates merchant foundation without KYC", async () => {
      const res = await registerMerchantAction({
        name: "Test User A1",
        email: testEmail,
        phone: testPhone,
        password: "ValidPassword123!",
        termsAccepted: true,
      });

      expect(res.success).toBe(true);

      // Verify User
      const user = await db.user.findUnique({ where: { email: testEmail } });
      expect(user).toBeDefined();

      // Verify Merchant Profile
      const profile = await db.merchantProfile.findUnique({
        where: { userId: user!.id },
        include: { kycApplication: true, wallet: true, ledgerAccounts: true },
      });

      expect(profile).toBeDefined();
      expect(profile!.accountStatus).toBe("PENDING");
      
      // Crucial: Must NOT have a KycApplication created
      expect(profile!.kycApplication).toBeNull();

      // Should have foundation created
      expect(profile!.wallet).toBeDefined();
      expect(profile!.ledgerAccounts.length).toBeGreaterThan(0);
    });

    it("returns error on duplicate email and does not duplicate merchant", async () => {
      const res = await registerMerchantAction({
        name: "Test User Duplicate",
        email: testEmail,
        phone: "5555555555",
        password: "ValidPassword123!",
        termsAccepted: true,
      });

      expect(res.success).toBe(false);
      expect(res.message).toMatch(/exists|failed/i);

      // Should still only have one user
      const count = await db.user.count({ where: { email: testEmail } });
      expect(count).toBe(1);
    });
  });

  describe("Routing Access", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("redirects PENDING merchant with no KycApplication to /kyc/start", async () => {
      const user = await db.user.findUnique({ where: { email: testEmail } });
      expect(user).toBeDefined();

      // Mock the session using the real newly created user
      vi.spyOn(auth.api, "getSession").mockResolvedValueOnce({
        session: {
          id: "mock-session",
          token: "mock-token",
          userId: user!.id,
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ipAddress: null,
          userAgent: null
        },
        user: {
          id: user!.id,
          name: "Test User A1",
          email: testEmail,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          image: null
        }
      });

      // Execute layout (which is a Server Component)
      await MerchantLayout({ children: null });

      // Assert redirect was called with exactly /kyc/start
      expect(redirect).toHaveBeenCalledWith("/kyc/start");
      expect(redirect).not.toHaveBeenCalledWith("/pending-approval");
      expect(redirect).not.toHaveBeenCalledWith("/dashboard");
    });

    it("allows PENDING merchant with no KycApplication to render SetupLayout without redirect loop", async () => {
      const user = await db.user.findUnique({ where: { email: testEmail } });
      expect(user).toBeDefined();

      vi.spyOn(auth.api, "getSession").mockResolvedValueOnce({
        session: {
          id: "mock-session-2",
          token: "mock-token",
          userId: user!.id,
          expiresAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          ipAddress: null,
          userAgent: null
        },
        user: {
          id: user!.id,
          name: "Test User A1",
          email: testEmail,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          image: null
        }
      });

      // Execute SetupLayout
      await SetupLayout({ children: null });

      // Assert no redirect was called
      expect(redirect).not.toHaveBeenCalled();
    });

    it("redirects unauthenticated users in SetupLayout", async () => {
      vi.spyOn(auth.api, "getSession").mockResolvedValueOnce(null);

      try {
        await SetupLayout({ children: null });
      } catch (e) {
        // Ignored
      }
      expect(redirect).toHaveBeenCalledWith("/login");
    });
  });
});
