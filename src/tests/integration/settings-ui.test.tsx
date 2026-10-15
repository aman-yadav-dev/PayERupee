// @vitest-environment jsdom
import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NotificationsSettingsPage from '@/app/(merchant)/settings/notifications/page';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Topbar } from '@/components/dashboard/Topbar';
import { NAVIGATION_GROUPS } from '@/config/navigation';
import { redirect } from 'next/navigation';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings/notifications',
  useRouter: () => ({ push: mockPush }),
  redirect: vi.fn((url) => {
    const err = new Error('NEXT_REDIRECT') as Error & { digest?: string };
    err.digest = 'NEXT_REDIRECT';
    throw err;
  }),
}));

vi.mock('@/modules/auth/infrastructure/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: { user: { name: 'Test User' } }, isPending: false }),
    signOut: vi.fn(),
  },
  useSession: () => ({ data: { user: { name: 'Test User' } }, isPending: false }),
  signOut: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Settings UI & Navigation Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Legacy Notifications Page Migration', () => {
    it('1. /settings/notifications component correctly redirects to /settings/profile', () => {
      // Because Next.js redirect() throws an error to short-circuit rendering,
      // we mock it to throw and catch it here.
      try {
        render(<NotificationsSettingsPage />);
      } catch (e: any) {
        if (e.digest !== 'NEXT_REDIRECT') throw e;
      }
      
      // Verify redirect was called
      expect(redirect).toHaveBeenCalledWith('/settings/profile');
    });
  });

  describe('Canonical Navigation Structure', () => {
    it('2. Active sidebar contains Profile -> /settings/profile', () => {
      render(<Sidebar open={true} onClose={() => {}} collapsed={false} onToggleCollapse={() => {}} />);
      const profileLink = screen.getByRole('link', { name: /profile/i });
      expect(profileLink).toBeDefined();
      expect(profileLink.getAttribute('href')).toBe('/settings/profile');
    });

    it('3. Topbar menu contains Account Security -> /settings/security', () => {
      render(<Topbar onMenuClick={() => {}} />);
      
      // Open the profile dropdown by clicking the user button
      const userButton = screen.getByText('Test User').closest('button')!;
      fireEvent.click(userButton);
      
      // The menu is now open, query the security button
      const securityBtn = screen.getByRole('button', { name: /account security/i });
      expect(securityBtn).toBeDefined();
      
      // Click it and verify router.push
      fireEvent.click(securityBtn);
      expect(mockPush).toHaveBeenCalledWith('/settings/security');
    });

    it('4. /settings/notifications does not appear in the active merchant navigation/search configuration', () => {
      // Check the canonical configuration directly
      const allNavs = NAVIGATION_GROUPS.flatMap(g => g.items);
      
      const hasNotifications = allNavs.some(nav => nav.href === '/settings/notifications');
      expect(hasNotifications).toBe(false);

      // Verify the legacy "Settings" label for notifications is also absent
      const hasLegacySettings = allNavs.some(nav => nav.label === 'Settings' && nav.href === '/settings/notifications');
      expect(hasLegacySettings).toBe(false);
    });
  });
});
