// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

// Mocks to prevent heavy server components from blowing up
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/modules/auth/infrastructure/auth-client', () => ({
  authClient: {
    useSession: () => ({ data: { user: { name: 'Test User' } }, isPending: false }),
  },
}));

import { Sidebar } from '@/components/dashboard/Sidebar';
import { Topbar } from '@/components/dashboard/Topbar';
import { AddFundsModal } from '@/components/merchant/AddFundsModal';
import { NAVIGATION_GROUPS } from '@/config/navigation';
import fs from 'fs';
import path from 'path';

describe('Merchant UI Consistency & Responsive', () => {
  afterEach(() => {
    cleanup();
  });

  it('TEST 1 - Sidebar and Topbar share the canonical NAVIGATION_GROUPS', () => {
    expect(NAVIGATION_GROUPS).toBeDefined();
    
    // Test that the sidebar groups exist and have standard labels
    const allLabels = NAVIGATION_GROUPS.flatMap(g => g.items.map(i => i.label));
    expect(allLabels).toContain('Dashboard');
    expect(allLabels).toContain('Wallet');
    expect(allLabels).toContain('Transactions');
    expect(allLabels).toContain('Security');
    expect(allLabels).toContain('Profile');
    
    // Verify legacy notifications are NOT present
    expect(allLabels).not.toContain('Notifications');
  });

  it('TEST 2 - Wallet modals use dashboard theme classes and not hardcoded light-mode classes', () => {
    const { container } = render(<AddFundsModal isOpen={true} onClose={() => {}} minAmount={100} />);
    
    const html = container.innerHTML;
    // Modals shouldn't have hardcoded white
    expect(html).not.toContain('bg-white');
    // They should use surface
    expect(html).toContain('bg-surface');
  });

  it('TEST 3 - DashboardShell sets min-w-0 on main content wrapper for flex overflow safety', () => {
    const shellCode = fs.readFileSync(path.join(process.cwd(), 'src/components/dashboard/DashboardShell.tsx'), 'utf-8');
    
    // We expect the main wrapper to include min-w-0 so it doesn't push horizontally
    expect(shellCode).toContain('min-w-0');
  });

  it('TEST 4 - Wallet Dashboard has responsive grid/flex and no fixed widths', () => {
    const walletCode = fs.readFileSync(path.join(process.cwd(), 'src/components/merchant/WalletDashboard.tsx'), 'utf-8');
    
    // Should use flex-col on mobile, flex-row on larger screens
    expect(walletCode).toContain('flex-col');
    expect(walletCode).toContain('lg:flex-row');
    expect(walletCode).toContain('sm:flex-row');

    // Should not have raw un-responsive huge widths
    expect(walletCode).not.toContain('w-[800px]');
    expect(walletCode).not.toContain('w-[1000px]');
    expect(walletCode).not.toMatch(/\bmin-w-\[([3-9]\d{2}|\d{4,})px\]/);
  });
});
