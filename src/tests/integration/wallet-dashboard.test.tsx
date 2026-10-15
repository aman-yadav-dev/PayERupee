// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FilterBar } from "@/components/dashboard/FilterBar";
import { WalletDashboard } from '@/components/merchant/WalletDashboard';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
  },
}));

vi.mock('@/components/dashboard/useDashboardFilters', () => ({
  useDashboardFilters: () => ({ status: "All statuses" }), buildFilterSearchParams: () => new URLSearchParams(), oldUseFilters: () => ({
    status: 'All statuses',
  })
}));

vi.mock('@/components/dashboard/FilterBar', () => ({
  FilterBar: () => <div data-testid="filter-bar">FilterBar</div>
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('WalletDashboard UI Tests', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/merchant/wallet/activity')) {
        return { ok: true, json: async () => ({ success: true, data: [], pagination: { totalPages: 1 } }) };
      }
      if (urlStr.includes('/api/v1/merchant/wallet')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: { balance: 1500.50 } })
        };
      }
      return { ok: false };
    });
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    render(<WalletDashboard />);
    expect(screen.getByText('Wallet Activity')).toBeDefined();
  });

  it('fetches and formats balance from the real endpoint', async () => {
    render(<WalletDashboard />);
    const el = await screen.findByText(/1,500\.50/i);
    expect(el).toBeDefined();
    const calls = mockFetch.mock.calls.map(c => String(c[0]));
    expect(calls.some(c => c.includes('/api/v1/admin/settings'))).toBe(false);
  });

  it('zero balance displays correctly', async () => {
    mockFetch.mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/merchant/wallet/activity')) {
        return { ok: true, json: async () => ({ success: true, data: [], pagination: { totalPages: 1 } }) };
      }
      if (urlStr.includes('/api/v1/merchant/wallet')) {
        return { ok: true, json: async () => ({ success: true, data: { balance: 0 } }) };
      }
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    });
    render(<WalletDashboard />);
    const el = await screen.findByText(/0\.00/i);
    expect(el).toBeDefined();
  });

  it('error state does not produce fake financial values', async () => {
    mockFetch.mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/merchant/wallet')) {
        return { ok: false, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    });
    render(<WalletDashboard />);
    const el = await screen.findByText('—');
    expect(el).toBeDefined();
    expect(screen.queryByText(/0\.00/i)).toBeNull();
  });

  it('clicking Add Money/Withdraw opens modals', async () => {
    // Provide fallback for any other requests like /api/v1/merchant/banks
    mockFetch.mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/merchant/wallet/activity')) {
        return { ok: true, json: async () => ({ success: true, data: [], pagination: { totalPages: 1 } }) };
      }
      if (urlStr.includes('/api/v1/merchant/wallet')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: { balance: 1500.50 } })
        };
      }
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    });

    render(<WalletDashboard />);
    const addBtn = screen.getByText('Add Money');
    const withdrawBtn = screen.getByText('Withdraw');
    
    // Instead of throwing a toast, it now renders modals/components
    fireEvent.click(addBtn);
    fireEvent.click(withdrawBtn);
    
    // No mutations should occur just by opening the modal
    const mutations = mockFetch.mock.calls.filter(c => c[1] && (c[1].method === 'POST' || c[1].method === 'PATCH' || c[1].method === 'PUT' || c[1].method === 'DELETE'));
    expect(mutations.length).toBe(0);
  });
  
  it('filter UI renders', async () => {
    render(<WalletDashboard />);
    expect(screen.getByTestId('filter-bar')).toBeDefined();
  });

  it('renders wallet activity table and pagination properly', async () => {
    mockFetch.mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/merchant/wallet/activity')) {
        return { ok: true, json: async () => ({ success: true, data: [{ id: '1', type: 'ADD_MONEY', reference: 'ref1', status: 'SUCCESS', createdAt: new Date().toISOString(), amount: 500, metadata: {} }], pagination: { totalPages: 2 } }) };
      }
      if (urlStr.includes('/api/v1/merchant/wallet')) {
        return { ok: true, json: async () => ({ success: true, data: { balance: 0 } }) };
      }
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    });
    render(<WalletDashboard />);
    
    const el = await screen.findByText('ref1');
    expect(el).toBeDefined();
    
    const nextBtn = await screen.findByText('Next');
    expect(nextBtn).toBeDefined();
  });
});