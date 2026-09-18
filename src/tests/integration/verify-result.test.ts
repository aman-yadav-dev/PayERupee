import { describe, it, expect, vi, beforeEach } from "vitest";
import VerifyResultPage from "@/app/(auth)/verify-result/page";

const mockGetSession = vi.fn();
vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: {
      getSession: (...args: any[]) => mockGetSession(...args),
    },
  },
}));

const mockHasCookie = vi.fn();
vi.mock("next/headers", () => ({
  headers: () => new Map(),
  cookies: () => Promise.resolve({
    has: (key: string) => mockHasCookie(key),
  }),
}));

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

const mockGetResolvedAuthDestination = vi.fn();
vi.mock("@/modules/auth/application/destination-loader.service", () => ({
  getResolvedAuthDestination: () => mockGetResolvedAuthDestination(),
}));

vi.mock("@/app/(auth)/verify-result/VerifyResultClient", () => ({
  VerifyResultClient: (props: any) => `VerifyResultClient isError=${props.isError} isAlreadyVerified=${props.isAlreadyVerified} userEmail=${props.userEmail}`,
}));

describe("Verify Result Transient Semantics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasCookie.mockReturnValue(false);
  });

  it("redirects manual access (no parameters) to authoritative destination", async () => {
    mockGetSession.mockResolvedValue({ user: { emailVerified: false } });
    mockGetResolvedAuthDestination.mockResolvedValue("/verify-email");
    const searchParams = Promise.resolve({});

    await VerifyResultPage({ searchParams }) as any;

    expect(mockGetResolvedAuthDestination).toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith("/verify-email");
  });

  it("forces error state if ?success=true but user is unverified (spoof attempt)", async () => {
    mockGetSession.mockResolvedValue({ user: { emailVerified: false, email: "test@test.com" } });
    const searchParams = Promise.resolve({ success: "true" });
    const res = await VerifyResultPage({ searchParams }) as any;
    expect(res.props.isError).toBe(true);
    expect(res.props.isAlreadyVerified).toBe(false);
    expect(res.props.userEmail).toBe("test@test.com");
  });

  it("forces error state if ?success=true but no session exists", async () => {
    mockGetSession.mockResolvedValue(null);
    const searchParams = Promise.resolve({ success: "true" });
    const res = await VerifyResultPage({ searchParams }) as any;
    expect(res.props.isError).toBe(true);
    expect(res.props.isAlreadyVerified).toBe(false);
    expect(res.props.userEmail).toBe(null);
  });

  it("allows fresh success state if ?success=true and user is verified AND cookie is present", async () => {
    mockGetSession.mockResolvedValue({ user: { emailVerified: true, email: "test@test.com" } });
    mockHasCookie.mockImplementation((key) => key === "payERupee_verification_fresh");
    const searchParams = Promise.resolve({ success: "true" });
    const res = await VerifyResultPage({ searchParams }) as any;
    expect(res.props.isError).toBe(false);
    expect(res.props.isAlreadyVerified).toBe(false);
    expect(res.props.userEmail).toBe("test@test.com");
  });

  it("forces already-verified state if ?success=true and user is verified BUT cookie is missing", async () => {
    mockGetSession.mockResolvedValue({ user: { emailVerified: true, email: "test@test.com" } });
    mockHasCookie.mockReturnValue(false);
    const searchParams = Promise.resolve({ success: "true" });
    const res = await VerifyResultPage({ searchParams }) as any;
    expect(res.props.isError).toBe(false);
    expect(res.props.isAlreadyVerified).toBe(true);
    expect(res.props.userEmail).toBe("test@test.com");
  });

  it("forces error state if ?error is present even if user is verified", async () => {
    mockGetSession.mockResolvedValue({ user: { emailVerified: true, email: "test@test.com" } });
    const searchParams = Promise.resolve({ error: "invalid_token" });
    const res = await VerifyResultPage({ searchParams }) as any;
    expect(res.props.isError).toBe(true);
    expect(res.props.isAlreadyVerified).toBe(false);
    expect(res.props.userEmail).toBe("test@test.com");
  });

  it("forces error state if ?error is present and ?success=true is simultaneously present", async () => {
    mockGetSession.mockResolvedValue({ user: { emailVerified: true, email: "test@test.com" } });
    const searchParams = Promise.resolve({ error: "invalid_token", success: "true" });
    const res = await VerifyResultPage({ searchParams }) as any;
    expect(res.props.isError).toBe(true);
    expect(res.props.isAlreadyVerified).toBe(false);
    expect(res.props.userEmail).toBe("test@test.com");
  });
});
