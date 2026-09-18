import { describe, it, expect, vi, beforeEach } from "vitest";
import VerifyEmailLayout from "@/app/(auth)/verify-email/layout";
import KycStartPage from "@/app/(setup)/kyc/start/page";
import MerchantLayout from "@/app/(merchant)/layout";
import { getResolvedAuthDestination } from "@/modules/auth/application/destination-loader.service";

const mockGetSession = vi.fn();
vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: {
      getSession: (...args: any[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("@/modules/auth/application/destination-loader.service", () => ({
  getResolvedAuthDestination: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: () => new Map(),
}));

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

// Provide minimal mocks for UI components so tests can run
vi.mock("@/components/merchant/kyc/KycShell", () => ({
  KycShell: () => "KycShell",
  AnimatedField: () => "AnimatedField"
}));

vi.mock("@/components/merchant/sidebar", () => ({ Sidebar: () => "Sidebar" }));
vi.mock("@/components/merchant/top-nav", () => ({ TopNav: () => "TopNav" }));

describe("Auth Lifecycle Guards (Root-Cause Fixes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("/verify-email guard", () => {
    it("redirects unauthenticated users", async () => {
      vi.mocked(getResolvedAuthDestination).mockResolvedValue("/login");
      await VerifyEmailLayout({ children: "test" });
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("renders for unverified authenticated users", async () => {
      vi.mocked(getResolvedAuthDestination).mockResolvedValue("/verify-email");
      const res = await VerifyEmailLayout({ children: "test" });
      expect(res.props.children).toBe("test");
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("redirects verified users to their destination", async () => {
      vi.mocked(getResolvedAuthDestination).mockResolvedValue("/kyc/start");
      await VerifyEmailLayout({ children: "test" });
      expect(mockRedirect).toHaveBeenCalledWith("/kyc/start");
    });
  });

  describe("/kyc/start guard", () => {
    it("redirects unverified users to /verify-email", async () => {
      vi.mocked(getResolvedAuthDestination).mockResolvedValue("/verify-email");
      mockGetSession.mockResolvedValue({ user: { id: "123", emailVerified: false } });
      await KycStartPage();
      expect(mockRedirect).toHaveBeenCalledWith("/verify-email");
    });

    it("allows verified users in PENDING state", async () => {
      vi.mocked(getResolvedAuthDestination).mockResolvedValue("/kyc/start");
      mockGetSession.mockResolvedValue({ user: { id: "123", emailVerified: true } });
      const res = await KycStartPage();
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  describe("/(merchant)/layout guard", () => {
    it("redirects unverified users to /verify-email", async () => {
      vi.mocked(getResolvedAuthDestination).mockResolvedValue("/verify-email");
      mockGetSession.mockResolvedValue({ user: { emailVerified: false } });
      await MerchantLayout({ children: "test" });
      expect(mockRedirect).toHaveBeenCalledWith("/verify-email");
    });

    it("allows ACTIVE APPROVED merchants", async () => {
      vi.mocked(getResolvedAuthDestination).mockResolvedValue("/dashboard");
      mockGetSession.mockResolvedValue({ user: { emailVerified: true } });
      const res = await MerchantLayout({ children: "test" });
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });
});
