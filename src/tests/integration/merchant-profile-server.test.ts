import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsProfilePage from '@/app/(merchant)/settings/profile/page';
import NotificationsSettingsPage from '@/app/(merchant)/settings/notifications/page';

const mockGetSession = vi.fn();
vi.mock("@/modules/auth/infrastructure/auth", () => ({
  auth: {
    api: {
      getSession: (...args: any[]) => mockGetSession(...args),
    },
  },
}));

const mockHeaders = vi.fn();
vi.mock("next/headers", () => ({
  headers: () => mockHeaders(),
}));

const mockRedirect = vi.fn();
class RedirectError extends Error {}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => { mockRedirect(url); throw new RedirectError("redirect"); },
}));

vi.mock("@/infrastructure/database/db", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    db: {
      $disconnect: vi.fn(),
      user: {
        findUnique: vi.fn(),
      },
      merchantProfile: {
        findUnique: vi.fn(),
      },
      session: {
        findFirst: vi.fn(),
      },
      wallet: {
        findUnique: vi.fn(),
      },
    },
  };
});

// Have to re-import db after mock
import { db } from '@/infrastructure/database/db';

vi.mock("@/app/(merchant)/settings/profile/ProfileClient", () => ({
  ProfileClient: (props: any) => {
    return {
      type: "ProfileClientMock",
      props,
    };
  },
}));

describe('Merchant Profile Server Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Map());
  });

  it('TEST 2 - Authentication protection', async () => {
    // Unauthenticated access
    mockGetSession.mockResolvedValue(null);

    const res = await SettingsProfilePage();

    expect(res).toBeNull(); 
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.merchantProfile.findUnique).not.toHaveBeenCalled();
  });

  it('TEST 3 - Merchant isolation (Uses session user ID)', async () => {
    const mockUserId = "user-123";
    const mockProfileId = "profile-456";

    mockGetSession.mockResolvedValue({ user: { id: mockUserId } });

    vi.mocked(db.user.findUnique).mockResolvedValue({ id: mockUserId, name: 'Test', email: 'test@test.com', createdAt: new Date() } as any);
    vi.mocked(db.merchantProfile.findUnique).mockResolvedValue({ id: mockProfileId, userId: mockUserId } as any);
    vi.mocked(db.session.findFirst).mockResolvedValue({ createdAt: new Date() } as any);
    vi.mocked(db.wallet.findUnique).mockResolvedValue({ balance: { toString: () => "1000" } } as any);

    await SettingsProfilePage();

    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { id: mockUserId } });
    expect(db.merchantProfile.findUnique).toHaveBeenCalledWith({ where: { userId: mockUserId } });
    expect(db.session.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: mockUserId } }));
    expect(db.wallet.findUnique).toHaveBeenCalledWith({ where: { merchantProfileId: mockProfileId } });
  });

  it('TEST 5 - Wallet balance (obtained from existing wallet source)', async () => {
    mockGetSession.mockResolvedValue({ user: { id: "u1" } });
    vi.mocked(db.user.findUnique).mockResolvedValue({ createdAt: new Date() } as any);
    vi.mocked(db.merchantProfile.findUnique).mockResolvedValue({ id: "p1" } as any);
    vi.mocked(db.session.findFirst).mockResolvedValue(null);
    vi.mocked(db.wallet.findUnique).mockResolvedValue({ balance: { toString: () => "4242.42" } } as any);

    const res: any = await SettingsProfilePage();
    
    expect(res.props.walletBalance).toBe("4242.42");
    expect(db.wallet.findUnique).toHaveBeenCalled();
  });

  it('TEST 7 - Legacy notifications route is inaccessible', async () => {
    try {
      await NotificationsSettingsPage();
    } catch (e) {
      // Expected
    }
    expect(mockRedirect).toHaveBeenCalledWith('/settings/profile');
  });
});
