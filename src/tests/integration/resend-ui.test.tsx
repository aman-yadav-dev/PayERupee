// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { VerifyEmailClient } from "@/app/(auth)/verify-email/VerifyEmailClient";
import { authClient } from "@/modules/auth/infrastructure/auth-client";
import { resendVerificationEmailAction } from "@/actions/auth/resend";

const mockRouterPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() }
}));

vi.mock("framer-motion", () => {
  const React = require("react");
  return {
    motion: {
      div: ({ children, className }: any) => React.createElement("div", { className }, children),
      button: ({ children, className, disabled, type, onClick }: any) => React.createElement("button", { className, disabled, type, onClick }, children),
    },
    useReducedMotion: () => false,
  };
});

const mockGetSession = vi.fn();
const mockGetAuthDestinationAction = vi.fn();

vi.mock("@/actions/auth/destination", () => ({
  getAuthDestinationAction: (...args: any[]) => mockGetAuthDestinationAction(...args),
}));

vi.mock("@/actions/auth/resend", () => ({
  resendVerificationEmailAction: vi.fn(),
}));

vi.mock("@/modules/auth/infrastructure/auth-client", () => ({
  authClient: {
    getSession: (...args: any[]) => mockGetSession(...args),
  },
  useSession: () => ({ data: { user: { id: "user_123", email: "test@example.com" } } }),
}));

describe("VerifyEmailPage Resend UI (Slice 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetSession.mockResolvedValue({
      data: { user: { id: "user_test", email: "test@example.com", emailVerified: false }, session: {} as any },
      error: null
    });
    mockGetAuthDestinationAction.mockResolvedValue({ success: true, data: { destination: "/dashboard" } });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("J. failed resend -> cooldown does not falsely start", async () => {
    vi.mocked(resendVerificationEmailAction).mockResolvedValueOnce({
      success: false,
      error: "Rate limited from server"
    });

    render(<VerifyEmailClient serverExpiresAt={null} />);

    const button = screen.getByRole("button", { name: /resend/i });
    expect(button.hasAttribute("disabled")).toBe(false);

    await act(async () => {
      fireEvent.click(button);
    });

    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.textContent).toMatch(/Resend verification email/i);
    expect(resendVerificationEmailAction).toHaveBeenCalledTimes(1);
  });

  it("K. concurrent click -> only one resend request (loading state & ref)", async () => {
    let resolveSend: any;
    const sendPromise = new Promise((resolve) => {
      resolveSend = resolve;
    });

    vi.mocked(resendVerificationEmailAction).mockImplementation(() => sendPromise as any);

    render(<VerifyEmailClient serverExpiresAt={null} />);
    const button = screen.getByRole("button", { name: /resend/i });

    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });

    expect(resendVerificationEmailAction).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSend({ success: true, expiresAt: new Date(Date.now() + 30000).toISOString() });
    });
  });

  it("A. /verify-email detects a newly verified session and redirects", async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { emailVerified: true, id: "user_123" } }
    });
    mockGetAuthDestinationAction.mockResolvedValue({ success: true, data: { destination: "/kyc/start" } });

    await act(async () => {
      render(<VerifyEmailClient serverExpiresAt={null} />);
    });

    await waitFor(() => {
      expect(mockGetAuthDestinationAction).toHaveBeenCalled();
      expect(mockRouterPush).toHaveBeenCalledWith("/kyc/start");
    });
  });

  it("B. Manual Check verification action performs authoritative check", async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { emailVerified: false, id: "user_123" } }
    });

    await act(async () => {
      render(<VerifyEmailClient serverExpiresAt={null} />);
    });

    const checkButton = screen.getByRole("button", { name: /have verified/i });
    await waitFor(() => expect(checkButton.hasAttribute('disabled')).toBe(false));

    mockGetSession.mockResolvedValue({
      data: { user: { emailVerified: true, id: "user_123" } }
    });
    mockGetAuthDestinationAction.mockResolvedValue({ success: true, data: { destination: "/dashboard" } });

    await act(async () => {
      fireEvent.click(checkButton);
    });

    await waitFor(() => {
      expect(mockGetAuthDestinationAction).toHaveBeenCalled();
      expect(mockRouterPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("C. No duplicate redirects when multiple session-change signals occur", async () => {
    mockGetSession.mockResolvedValue({
      data: { user: { emailVerified: true, id: "user_123" } }
    });
    let destinationPromiseResolve: any;
    const destinationPromise = new Promise((res) => { destinationPromiseResolve = res; });
    mockGetAuthDestinationAction.mockReturnValue(destinationPromise);

    await act(async () => {
      render(<VerifyEmailClient serverExpiresAt={null} />);
    });

    await act(async () => {
      window.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("pageshow"));
    });

    await act(async () => {
      destinationPromiseResolve({ success: true, data: { destination: "/kyc/start" } });
    });

    await waitFor(() => {
      expect(mockGetAuthDestinationAction).toHaveBeenCalledTimes(1);
    });
  });
});
