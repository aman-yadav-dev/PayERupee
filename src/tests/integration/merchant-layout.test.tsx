// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MerchantLayoutWrapper } from '@/app/(merchant)/MerchantLayoutWrapper';

// Mock next/navigation
let mockPathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams()
}));

// Mock the inner components so we can just check their presence
vi.mock('@/components/dashboard/DashboardShell', () => ({
  DashboardShell: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-shell">{children}</div>
}));
vi.mock('@/components/merchant/sidebar', () => ({
  Sidebar: () => <div data-testid="legacy-sidebar" />
}));
vi.mock('@/components/merchant/top-nav', () => ({
  TopNav: () => <div data-testid="legacy-topnav" />
}));

describe("MerchantLayoutWrapper", () => {
  it("renders DashboardShell for /dashboard", () => {
    mockPathname = "/dashboard";
    render(<MerchantLayoutWrapper user={{}}><div>Content</div></MerchantLayoutWrapper>);
    expect(screen.queryByTestId("dashboard-shell")).not.toBeNull();
    expect(screen.queryByTestId("legacy-sidebar")).toBeNull();
  });

  it("renders DashboardShell for /wallet", () => {
    mockPathname = "/wallet";
    render(<MerchantLayoutWrapper user={{}}><div>Content</div></MerchantLayoutWrapper>);
    expect(screen.queryByTestId("dashboard-shell")).not.toBeNull();
    expect(screen.queryByTestId("legacy-sidebar")).toBeNull();
  });

  it("renders DashboardShell for /transactions", () => {
    mockPathname = "/transactions";
    render(<MerchantLayoutWrapper user={{}}><div>Content</div></MerchantLayoutWrapper>);
    expect(screen.queryByTestId("dashboard-shell")).not.toBeNull();
    expect(screen.queryByTestId("legacy-sidebar")).toBeNull();
  });

  it("renders legacy layout for /settings/notifications", () => {
    mockPathname = "/settings/notifications";
    render(<MerchantLayoutWrapper user={{}}><div>Content</div></MerchantLayoutWrapper>);
    expect(screen.queryByTestId("legacy-sidebar")).not.toBeNull();
    expect(screen.queryByTestId("dashboard-shell")).toBeNull();
  });
});
