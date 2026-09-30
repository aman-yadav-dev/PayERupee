import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "@/infrastructure/database/db";
import { AccountStatus } from "@prisma/client";
import { getResolvedAuthDestination } from "@/modules/auth/application/destination-loader.service";
import LoginLayout from "@/app/(auth)/login/layout";
import RegisterLayout from "@/app/(auth)/register/layout";

const mockGetSession = vi.fn();
vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: {
      getSession: (...args: any[]) => mockGetSession(...args),
    },
  },
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: () => new Map(),
}));

// Mock next/navigation
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

describe("AUTH-LIFE-2: Existing-Session Auth Page Protection", () => {
  const userId = "test-auth-life-2-user";
  const profileId = "test-auth-life-2-profile";
  
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Isolated cleanup
    await db.kycApplication.deleteMany({ where: { merchantProfileId: profileId } });
    await db.merchantProfile.deleteMany({ where: { id: profileId } });
    await db.user.deleteMany({ where: { id: userId } });
  });

  afterEach(async () => {
    await db.kycApplication.deleteMany({ where: { merchantProfileId: profileId } });
    await db.merchantProfile.deleteMany({ where: { id: profileId } });
    await db.user.deleteMany({ where: { id: userId } });
  });

  async function createTestUser(accountStatus: AccountStatus | null, withKyc: boolean = false) {
    await db.user.create({
      data: {
        id: userId,
        email: "authlife2@example.com",
        name: "Auth Life 2",
        emailVerified: true
      }
    });

    if (accountStatus) {
      await db.merchantProfile.create({
        data: {
          id: profileId,
          userId,
          accountStatus,
          kycApplication: withKyc ? { create: { cycles: { create: { cycleNumber: 1, isCurrentCycle: true, status: "APPROVED", formVersion: { create: { status: "PUBLISHED", versionNumber: 1, form: { create: { name: "test-form" } } } } } } } } : undefined
        }
      });
    }

    mockGetSession.mockResolvedValue({
      user: { id: userId, emailVerified: true }
    });
  }

  it("1 & 2. unauthenticated /login and /register -> render forms natively", async () => {
    mockGetSession.mockResolvedValue(null);
    
    const loginRender = await LoginLayout({ children: "login-form" });
    expect(loginRender.props.children).toBe("login-form");
    
    const registerRender = await RegisterLayout({ children: "register-form" });
    expect(registerRender.props.children).toBe("register-form");
    
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("3 & 4. authenticated active+approved /login and /register -> /dashboard", async () => {
    await createTestUser("ACTIVE", true);
    
    await LoginLayout({ children: "login-form" });
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    
    mockRedirect.mockClear();
    
    await RegisterLayout({ children: "register-form" });
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("5 & 6. authenticated pending+no KYC /login and /register -> /kyc/start", async () => {
    await createTestUser("PENDING", false);
    
    await LoginLayout({ children: "login-form" });
    expect(mockRedirect).toHaveBeenCalledWith("/kyc/start");
    
    mockRedirect.mockClear();
    
    await RegisterLayout({ children: "register-form" });
    expect(mockRedirect).toHaveBeenCalledWith("/kyc/start");
  });

  it("7. authenticated suspended account cannot render auth form (redirects safely)", async () => {
    await createTestUser("SUSPENDED", false);
    
    // Register layout explicitly blocks suspended users and redirects to login error
    await RegisterLayout({ children: "register-form" });
    expect(mockRedirect).toHaveBeenCalledWith("/login?error=account_suspended");
    
    // Login layout renders the custom suspended UI, not the children, and does not redirect
    mockRedirect.mockClear();
    const loginRender = await LoginLayout({ children: "login-form" });
    expect(loginRender.props.children).not.toBe("login-form"); // It renders the Suspended div
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("8. authenticated deleted account cannot render auth form (redirects safely)", async () => {
    await createTestUser("DELETED", false);
    
    await RegisterLayout({ children: "register-form" });
    expect(mockRedirect).toHaveBeenCalledWith("/login?error=account_suspended");
  });

  it("9. authenticated user with no MerchantProfile resolves to /onboarding", async () => {
    await createTestUser(null);
    
    await LoginLayout({ children: "login-form" });
    expect(mockRedirect).toHaveBeenCalledWith("/onboarding");
    
    mockRedirect.mockClear();
    
    await RegisterLayout({ children: "register-form" });
    expect(mockRedirect).toHaveBeenCalledWith("/onboarding");
  });

  it("10. verify that login/register do not create or mutate records during layout check", async () => {
    await createTestUser("ACTIVE", true);
    
    // Count before
    const profileCountBefore = await db.merchantProfile.count();
    
    await LoginLayout({ children: "login-form" });
    await RegisterLayout({ children: "register-form" });
    
    // Count after
    const profileCountAfter = await db.merchantProfile.count();
    
    expect(profileCountBefore).toBe(profileCountAfter);
    expect(mockRedirect).toHaveBeenCalledTimes(2);
  });
});
