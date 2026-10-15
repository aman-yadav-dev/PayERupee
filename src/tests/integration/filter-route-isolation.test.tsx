/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { useEffect } from "react";
import { useDashboardFilters, setDashboardFilters, getDashboardFilters } from "../../components/dashboard/useDashboardFilters";

const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: vi.fn() })
}));

function MockDashboard() {
  const filters = useDashboardFilters();
  return <div data-testid="dashboard">status: {filters.status} type: {filters.type || "none"}</div>;
}

function MockWallet() {
  const filters = useDashboardFilters();
  return <div data-testid="wallet">status: {filters.status} type: {filters.type || "none"}</div>;
}

function MockTransactions() {
  const filters = useDashboardFilters();
  return <div data-testid="transactions">status: {filters.status} type: {filters.type || "none"}</div>;
}

describe("Filter Route Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Filters do not leak across soft navigations", async () => {
    // Render Dashboard
    mockPathname.mockReturnValue("/dashboard");
    const { rerender } = render(<MockDashboard />);
    expect(screen.getByTestId("dashboard").textContent).toBe("status: All statuses type: none");

    // Apply status=FAILED on Dashboard
    act(() => setDashboardFilters("/dashboard", { status: "FAILED" }));
    expect(screen.getByTestId("dashboard").textContent).toBe("status: FAILED type: none");

    // Navigate to Wallet
    mockPathname.mockReturnValue("/wallet");
    rerender(<MockWallet />);
    // Should NOT inherit FAILED status
    expect(screen.getByTestId("wallet").textContent).toBe("status: All statuses type: none");

    // Apply type=WITHDRAWAL on Wallet
    act(() => setDashboardFilters("/wallet", { type: "WITHDRAWAL" }));
    expect(screen.getByTestId("wallet").textContent).toBe("status: All statuses type: WITHDRAWAL");

    // Navigate to Transactions
    mockPathname.mockReturnValue("/transactions");
    rerender(<MockTransactions />);
    // Should NOT inherit WITHDRAWAL type
    expect(screen.getByTestId("transactions").textContent).toBe("status: All statuses type: none");

    // Navigate back to Dashboard
    mockPathname.mockReturnValue("/dashboard");
    rerender(<MockDashboard />);
    // Dashboard retains its own FAILED status
    expect(screen.getByTestId("dashboard").textContent).toBe("status: FAILED type: none");
  });

  it("2. Clear -> immediate Export gets cleared state", async () => {
    mockPathname.mockReturnValue("/dashboard");
    act(() => setDashboardFilters("/dashboard", { status: "FAILED" }));
    
    // Simulate clear
    act(() => setDashboardFilters("/dashboard", { _reset: true }));
    
    // Simulate immediate export read
    const filters = getDashboardFilters("/dashboard");
    expect(filters.status).toBe("All statuses");
  });
});
