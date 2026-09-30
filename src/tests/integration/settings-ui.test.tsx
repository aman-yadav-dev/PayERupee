// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import NotificationsSettingsPage from '@/app/(merchant)/settings/notifications/page';
import { Sidebar } from '@/components/merchant/sidebar';
import { toast } from 'sonner';

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings/notifications',
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Settings UI & Navigation', () => {
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Sidebar Navigation', () => {
    it('14. Settings navigation link exists & 15. Settings link points to /settings/notifications', () => {
      render(<Sidebar />);
      const settingsLink = screen.getByRole('link', { name: /settings/i });
      expect(settingsLink).toBeDefined();
      expect(settingsLink.getAttribute('href')).toBe('/settings/notifications');
    });
  });

  describe('NotificationsSettingsPage', () => {
    it('1. page renders loading state initially', async () => {
      fetchMock.mockReturnValue(new Promise(() => {})); // Never resolves to keep loading state
      render(<NotificationsSettingsPage />);
      expect(screen.getByText('Loading settings...')).toBeDefined();
    });

    it('2. GET loads TRUE/TRUE and 13. mandatory security-email notice is visible', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ success: true, data: { loginEmailsEnabled: true, kycEmailsEnabled: true } })
      });
      render(<NotificationsSettingsPage />);

      await waitFor(() => {
        expect(screen.queryByText('Loading settings...')).toBeNull();
      });

      expect(screen.getByText(/Email verification and password reset emails cannot be disabled./i)).toBeDefined();

      const loginSwitch = screen.getByRole('switch', { name: /toggle login notifications/i });
      const kycSwitch = screen.getByRole('switch', { name: /toggle kyc notifications/i });

      // 3. login toggle reflects server state
      expect(loginSwitch.getAttribute('aria-checked')).toBe('true');
      // 4. KYC toggle reflects server state
      expect(kycSwitch.getAttribute('aria-checked')).toBe('true');
      // 16. accessible labels/states exist for both toggles
      expect(loginSwitch).toBeDefined();
    });

    it('11. retry after GET failure works', async () => {
      // First fails
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ success: false, error: 'Server error' })
      });
      const { rerender } = render(<NotificationsSettingsPage />);

      await waitFor(() => {
        expect(screen.getByText(/Unable to load notification settings./i)).toBeDefined();
      });

      // Click retry
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ success: true, data: { loginEmailsEnabled: false, kycEmailsEnabled: true } })
      });
      const retryBtn = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(screen.queryByText(/Unable to load notification settings./i)).toBeNull();
      });
      const loginSwitch = screen.getByRole('switch', { name: /toggle login notifications/i });
      expect(loginSwitch.getAttribute('aria-checked')).toBe('false');
    });

    it('5. changing login sends correct PATCH body (7, 8. no userId or merchantProfileId)', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ success: true, data: { loginEmailsEnabled: true, kycEmailsEnabled: true } })
      });
      render(<NotificationsSettingsPage />);

      await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

      const loginSwitch = screen.getByRole('switch', { name: /toggle login notifications/i });

      fetchMock.mockResolvedValueOnce({
        json: async () => ({ success: true, data: { loginEmailsEnabled: false, kycEmailsEnabled: true } })
      });

      await userEvent.click(loginSwitch);

      // Verify the fetch call
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const patchCall = fetchMock.mock.calls[1];
      expect(patchCall[0]).toBe('/api/v1/merchant/settings/notifications');
      expect(patchCall[1].method).toBe('PATCH');

      const body = JSON.parse(patchCall[1].body);
      expect(body).toEqual({ loginEmailsEnabled: false }); // Exactly and only the changed key
      expect(body.userId).toBeUndefined();
      expect(body.merchantProfileId).toBeUndefined();

      // 9. successful update preserves changed state
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Preferences updated successfully');
      });
      expect(loginSwitch.getAttribute('aria-checked')).toBe('false');
    });

    it('6. changing KYC sends correct PATCH body', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ success: true, data: { loginEmailsEnabled: true, kycEmailsEnabled: true } })
      });
      render(<NotificationsSettingsPage />);
      await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

      const kycSwitch = screen.getByRole('switch', { name: /toggle kyc notifications/i });

      fetchMock.mockResolvedValueOnce({
        json: async () => ({ success: true, data: { loginEmailsEnabled: true, kycEmailsEnabled: false } })
      });

      await userEvent.click(kycSwitch);

      const patchCall = fetchMock.mock.calls[1];
      const body = JSON.parse(patchCall[1].body);
      expect(body).toEqual({ kycEmailsEnabled: false });
    });

    it('10. failed update restores previous state', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ success: true, data: { loginEmailsEnabled: true, kycEmailsEnabled: true } })
      });
      render(<NotificationsSettingsPage />);
      await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

      const loginSwitch = screen.getByRole('switch', { name: /toggle login notifications/i });

      fetchMock.mockResolvedValueOnce({
        json: async () => ({ success: false, error: 'Database timeout' })
      });

      await userEvent.click(loginSwitch);

      // It fails and restores

      // But then it fails and restores
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Database timeout');
      });
      expect(loginSwitch.getAttribute('aria-checked')).toBe('true');
    });

    it('12. rapid/duplicate interaction does not create uncontrolled stale state', async () => {
      fetchMock.mockResolvedValueOnce({
        json: async () => ({ success: true, data: { loginEmailsEnabled: true, kycEmailsEnabled: true } })
      });
      render(<NotificationsSettingsPage />);
      await waitFor(() => expect(screen.queryByText('Loading settings...')).toBeNull());

      const loginSwitch = screen.getByRole('switch', { name: /toggle login notifications/i });

      // Delay the patch response
      fetchMock.mockImplementationOnce(() => new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            json: async () => ({ success: true, data: { loginEmailsEnabled: false, kycEmailsEnabled: true } })
          });
        }, 100);
      }));

      // Click twice rapidly
      fireEvent.click(loginSwitch);
      fireEvent.click(loginSwitch);
      fireEvent.click(loginSwitch);

      // Should only trigger 1 patch because it's disabled while updating
      expect(fetchMock).toHaveBeenCalledTimes(2); // 1 get, 1 patch
      expect(loginSwitch.hasAttribute('disabled')).toBe(true);
    });
  });
});
