// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SecuritySettingsPage from '@/app/(merchant)/settings/security/page';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Security Settings UI - Login Notifications', () => {
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const setupMocks = (loginEnabled: boolean) => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/api/v1/merchant/settings/security/activity')) {
        return { ok: true, json: async () => ({ success: true, data: [], pagination: { totalPages: 1 } }) };
      }
      if (url.includes('/api/v1/merchant/settings/security')) {
        return { ok: true, json: async () => ({ success: true, settings: {} }) };
      }
      if (url.includes('/api/v1/merchant/settings/notifications')) {
        return { ok: true, json: async () => ({ success: true, data: { loginEmailsEnabled: loginEnabled } }) };
      }
      return { ok: true, json: async () => ({}) };
    });
  };

  it('A1. Login Notifications can be read from preferences (Existing TRUE renders enabled)', async () => {
    setupMocks(true);
    await act(async () => {
      render(<SecuritySettingsPage />);
    });

    await waitFor(() => {
      const toggle = screen.getByRole('switch', { name: /login notifications/i });
      expect(toggle.getAttribute('aria-checked')).toBe('true');
    });
  });

  it('A2. Login Notifications can be read from preferences (Existing FALSE renders disabled)', async () => {
    setupMocks(false);
    await act(async () => {
      render(<SecuritySettingsPage />);
    });

    await waitFor(() => {
      const toggle = screen.getByRole('switch', { name: /login notifications/i });
      expect(toggle.getAttribute('aria-checked')).toBe('false');
    });
  });

  it('B1. Toggle OFF persists loginEmailsEnabled=false to the correct API', async () => {
    setupMocks(true);
    const user = userEvent.setup();
    await act(async () => {
      render(<SecuritySettingsPage />);
    });

    let toggle: HTMLElement;
    await waitFor(() => {
      toggle = screen.getByRole('switch', { name: /login notifications/i });
      expect(toggle.getAttribute('aria-checked')).toBe('true');
    });

    // Mock the PATCH request
    fetchMock.mockImplementationOnce(async (url: string, options: any) => {
      if (url.includes('/api/v1/merchant/settings/notifications') && options?.method === 'PATCH') {
        const body = JSON.parse(options.body);
        expect(body.loginEmailsEnabled).toBe(false);
        return { ok: true, json: async () => ({ success: true }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    await act(async () => {
      await user.click(toggle!);
    });

    // Verify UI updated optimistically
    await waitFor(() => {
      expect(toggle.getAttribute('aria-checked')).toBe('false');
    });
  });

  it('B2. Toggle ON persists loginEmailsEnabled=true to the correct API', async () => {
    setupMocks(false);
    const user = userEvent.setup();
    await act(async () => {
      render(<SecuritySettingsPage />);
    });

    let toggle: HTMLElement;
    await waitFor(() => {
      toggle = screen.getByRole('switch', { name: /login notifications/i });
      expect(toggle.getAttribute('aria-checked')).toBe('false');
    });

    // Mock the PATCH request
    fetchMock.mockImplementationOnce(async (url: string, options: any) => {
      if (url.includes('/api/v1/merchant/settings/notifications') && options?.method === 'PATCH') {
        const body = JSON.parse(options.body);
        expect(body.loginEmailsEnabled).toBe(true);
        return { ok: true, json: async () => ({ success: true }) };
      }
      return { ok: true, json: async () => ({}) };
    });

    await act(async () => {
      await user.click(toggle!);
    });

    // Verify UI updated
    await waitFor(() => {
      expect(toggle.getAttribute('aria-checked')).toBe('true');
    });
  });

  it('C. Shared source of truth: ensures Security page calls notifications API, not security API for this toggle', async () => {
    setupMocks(true);
    const user = userEvent.setup();
    await act(async () => {
      render(<SecuritySettingsPage />);
    });

    let toggle: HTMLElement;
    await waitFor(() => {
      toggle = screen.getByRole('switch', { name: /login notifications/i });
    });

    let patchCalledToNotifications = false;
    let patchCalledToSecurity = false;

    fetchMock.mockImplementation(async (url: string, options: any) => {
      if (options?.method === 'PATCH' || options?.method === 'PUT') {
        if (url.includes('/api/v1/merchant/settings/notifications')) {
          patchCalledToNotifications = true;
          return { ok: true, json: async () => ({ success: true }) };
        }
        if (url.includes('/api/v1/merchant/settings/security')) {
          patchCalledToSecurity = true;
          return { ok: true, json: async () => ({ success: true }) };
        }
      }
      return { ok: true, json: async () => ({}) };
    });

    await act(async () => {
      await user.click(toggle!);
    });

    expect(patchCalledToNotifications).toBe(true);
    expect(patchCalledToSecurity).toBe(false); // Should NOT write to security API
  });
});
