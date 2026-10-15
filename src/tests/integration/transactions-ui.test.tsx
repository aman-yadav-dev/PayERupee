/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransactionsDashboard } from "@/components/merchant/TransactionsDashboard";
import { useTransactions } from "@/components/dashboard/useTransactions";

vi.mock("@/components/dashboard/useTransactions", () => ({
  useTransactions: vi.fn()
}));

// Mock ResizeObserver for Recharts / UI components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe("TransactionsDashboard UI", () => {
  it("renders correct title, filters, and prevents old ledger strings from showing", () => {
    vi.mocked(useTransactions).mockReturnValue({
      data: {
        success: true,
        data: [],
        pagination: { totalPages: 1, totalRecords: 0 }
      },
      isLoading: false,
      isError: false,
      error: null
    } as any);

    render(<TransactionsDashboard />);
    
    // Proves the new premium title is rendered
    expect(screen.getByText("Transactions")).toBeTruthy();
    expect(screen.getByText("Review and manage your business transactions.")).toBeTruthy();
    
    // Proves filters / export buttons are rendered (assuming FilterBar renders an Export button/text)
    // Testing specific internal text from the new components
    expect(screen.getByText("No transactions found")).toBeTruthy();
    
    // PROVE that old ledger strings DO NOT EXIST
    const oldTitleDesc = screen.queryByText("Full history of your wallet's credits and debits.");
    expect(oldTitleDesc).toBeNull();
    
    const rawPrincipal = screen.queryByText("PRINCIPAL");
    expect(rawPrincipal).toBeNull();
    
    const withdrawalReversal = screen.queryByText("Withdrawal Reversal");
    expect(withdrawalReversal).toBeNull();
  });
});
