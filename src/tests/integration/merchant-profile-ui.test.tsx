// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProfileClient } from '@/app/(merchant)/settings/profile/ProfileClient';
import { authClient } from '@/modules/auth/infrastructure/auth-client';
import { toast } from 'sonner';

vi.mock('@/modules/auth/infrastructure/auth-client', () => ({
  authClient: {
    changePassword: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Merchant Profile UI', () => {
  const mockUser = {
    name: 'Test Merchant',
    email: 'test@merchant.com',
    createdAt: '2025-01-01T00:00:00.000Z',
  };

  const mockProfile = {
    phone: '+919876543210',
    address: '123 Test St',
    accountStatus: 'ACTIVE',
  };

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TEST 4 - Profile fields render correctly and Address is NOT rendered', () => {
    render(
      <ProfileClient
        user={mockUser}
        profile={mockProfile}
        walletBalance="15000"
        lastLogin="2025-10-01T12:00:00.000Z"
      />
    );

    // Should render Email, Phone, Member Since, Last Login
    expect(screen.getByText('Email Address')).toBeDefined();
    expect(screen.getAllByText('test@merchant.com')[0]).toBeDefined();
    
    expect(screen.getByText('Phone Number')).toBeDefined();
    expect(screen.getByText('+919876543210')).toBeDefined();
    
    expect(screen.getByText('Member Since')).toBeDefined();
    
    expect(screen.getByText('Last Login')).toBeDefined();

    // Account Status is rendered in the header
    expect(screen.getByText('ACTIVE')).toBeDefined();

    // Address should NOT be rendered
    expect(screen.queryByText('Address')).toBeNull();
    expect(screen.queryByText('123 Test St')).toBeNull();
    expect(screen.queryByText('Not provided')).toBeNull();
  });

  it('TEST 8 - Password validation triggers appropriately', async () => {
    render(
      <ProfileClient
        user={mockUser}
        profile={mockProfile}
        walletBalance="15000"
        lastLogin="2025-10-01T12:00:00.000Z"
      />
    );

    const updateBtn = screen.getByRole('button', { name: /update password/i });

    // Missing current password
    fireEvent.submit(updateBtn.closest('form')!);
    expect(toast.error).toHaveBeenCalledWith('Please enter your current password');

    const currentInput = screen.getByPlaceholderText('Enter current password');
    const newInput = screen.getByPlaceholderText('Enter new password');
    const confirmInput = screen.getByPlaceholderText('Confirm new password');

    fireEvent.change(currentInput, { target: { value: 'oldpass123' } });

    // Missing new password
    fireEvent.submit(updateBtn.closest('form')!);
    expect(toast.error).toHaveBeenCalledWith('Please enter a new password');

    fireEvent.change(newInput, { target: { value: 'short' } });
    
    // Invalid (short) new password
    fireEvent.submit(updateBtn.closest('form')!);
    expect(toast.error).toHaveBeenCalledWith('New password must be at least 8 characters long');

    fireEvent.change(newInput, { target: { value: 'newpass123' } });
    fireEvent.change(confirmInput, { target: { value: 'mismatch123' } });

    // Mismatch
    fireEvent.submit(updateBtn.closest('form')!);
    expect(toast.error).toHaveBeenCalledWith('New passwords do not match');

    // Valid request reaches existing Better Auth password-change mechanism
    fireEvent.change(confirmInput, { target: { value: 'newpass123' } });
    
    // Mock success
    vi.mocked(authClient.changePassword).mockResolvedValueOnce({ data: { success: true }, error: null } as any);

    fireEvent.submit(updateBtn.closest('form')!);

    await waitFor(() => {
      expect(authClient.changePassword).toHaveBeenCalledWith({
        currentPassword: 'oldpass123',
        newPassword: 'newpass123',
        revokeOtherSessions: true,
      });
      expect(toast.success).toHaveBeenCalledWith('Password changed successfully');
    });
  });

  it('14. DARK-MODE TESTING - Profile uses application theme classes', () => {
    const { container } = render(
      <ProfileClient
        user={mockUser}
        profile={mockProfile}
        walletBalance="15000"
        lastLogin="2025-10-01T12:00:00.000Z"
      />
    );

    // Verify it does not use hardcoded white/black surfaces
    const html = container.innerHTML;
    expect(html).not.toContain('bg-white');
    expect(html).not.toContain('text-black');
    expect(html).not.toContain('bg-slate-50');

    // Verify it uses actual tokens
    expect(html).toContain('bg-surface');
    expect(html).toContain('text-text-primary');
    expect(html).toContain('border-line');
    
    const currentPass = screen.getByPlaceholderText('Enter current password');
    expect(currentPass.className).toContain('bg-canvas');
    expect(currentPass.className).toContain('border-line');
    expect(currentPass.className).toContain('text-text-primary');
  });
});
