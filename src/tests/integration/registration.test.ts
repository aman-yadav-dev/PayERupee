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
    const validBaseData = {
      name: "Test User",
      phone: "9876543210",
      email: "test@example.com",
      password: "ValidPassword123!",
      confirmPassword: "ValidPassword123!",
      termsAccepted: true,
    };

    it("accepts valid registration data", () => {
      const result = registerSchema.safeParse({
        name: "Test User",
        phone: "9876543210",
        email: "test@example.com",
        password: "ValidPassword123!", confirmPassword: "ValidPassword123!",
        termsAccepted: true,
      });
      expect(result.success).toBe(true);
    });

    describe("Phone Validation", () => {
      it("accepts valid Indian format", () => {
        expect(registerSchema.safeParse({ ...validBaseData, phone: "9876543210" }).success).toBe(true);
        expect(registerSchema.safeParse({ ...validBaseData, phone: "8123456789" }).success).toBe(true);
        expect(registerSchema.safeParse({ ...validBaseData, phone: "7001234567" }).success).toBe(true);
        expect(registerSchema.safeParse({ ...validBaseData, phone: "6987654321" }).success).toBe(true);
      });

      it("rejects invalid leading digits", () => {
        expect(registerSchema.safeParse({ ...validBaseData, phone: "1234567890" }).success).toBe(false);
        expect(registerSchema.safeParse({ ...validBaseData, phone: "0123456789" }).success).toBe(false);
        expect(registerSchema.safeParse({ ...validBaseData, phone: "5555555555" }).success).toBe(false);
      });

      it("rejects repeated fake numbers", () => {
        expect(registerSchema.safeParse({ ...validBaseData, phone: "0000000000" }).success).toBe(false);
        expect(registerSchema.safeParse({ ...validBaseData, phone: "1111111111" }).success).toBe(false);
        expect(registerSchema.safeParse({ ...validBaseData, phone: "9999999999" }).success).toBe(false);
        expect(registerSchema.safeParse({ ...validBaseData, phone: "8888888888" }).success).toBe(false);
      });

      it("rejects phone with < 10 digits", () => {
        expect(registerSchema.safeParse({ ...validBaseData, phone: "987654321" }).success).toBe(false);
      });

      it("rejects phone with > 10 digits", () => {
        expect(registerSchema.safeParse({ ...validBaseData, phone: "98765432101" }).success).toBe(false);
      });

      it("rejects phone with alphabetic characters", () => {
        expect(registerSchema.safeParse({ ...validBaseData, phone: "98765abcde" }).success).toBe(false);
      });
    });

    describe("Email Validation", () => {
      it("accepts normal valid addresses", () => {
        expect(registerSchema.safeParse({ ...validBaseData, email: "user@example.com" }).success).toBe(true);
        expect(registerSchema.safeParse({ ...validBaseData, email: "first.last+tag@domain.co.in" }).success).toBe(true);
      });

      it("rejects clearly malformed addresses", () => {
        expect(registerSchema.safeParse({ ...validBaseData, email: "userexample.com" }).success).toBe(false);
        expect(registerSchema.safeParse({ ...validBaseData, email: "user@example" }).success).toBe(false); // missing TLD
        expect(registerSchema.safeParse({ ...validBaseData, email: "user@" }).success).toBe(false);
        expect(registerSchema.safeParse({ ...validBaseData, email: "@example.com" }).success).toBe(false);
      });
    });

    it("rejects short password", () => {
      const result = registerSchema.safeParse({
        ...validBaseData,
        password: "Pass1!", confirmPassword: "Pass1!"
      });
      expect(result.success).toBe(false);
    });

    it("does not accept Company Name or Address", () => {
      const data = {
        name: "Test User",
        phone: "9998887776",
        email: "test@example.com",
        password: "ValidPassword123!", confirmPassword: "ValidPassword123!",
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

    it("rejects mismatched confirmPassword", () => {
      const result = registerSchema.safeParse({
        name: "Test User",
        phone: "9998887776",
        email: "test@example.com",
        password: "ValidPassword123!",
        confirmPassword: "WrongPassword123!",
        termsAccepted: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects phone with < 10 digits", () => {
      const result = registerSchema.safeParse({
        name: "Test", phone: "999888777", email: "a@a.com",
        password: "ValidPassword123!", confirmPassword: "ValidPassword123!", termsAccepted: true
      });
      expect(result.success).toBe(false);
    });

    it("rejects phone with > 10 digits", () => {
      const result = registerSchema.safeParse({
        name: "Test", phone: "99988877765", email: "a@a.com",
        password: "ValidPassword123!", confirmPassword: "ValidPassword123!", termsAccepted: true
      });
      expect(result.success).toBe(false);
    });

    it("rejects phone with alphabetic characters", () => {
      const result = registerSchema.safeParse({
        name: "Test", phone: "999888777a", email: "a@a.com",
        password: "ValidPassword123!", confirmPassword: "ValidPassword123!", termsAccepted: true
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Backend Action", () => {
    it("successfully creates merchant foundation without KYC", async () => {
      const res = await registerMerchantAction({
        name: "Test User A1",
        email: testEmail,
        phone: testPhone,
        password: "ValidPassword123!", confirmPassword: "ValidPassword123!",
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
        password: "ValidPassword123!", confirmPassword: "ValidPassword123!",
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
          emailVerified: true,
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
          emailVerified: true,
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
