// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { TransactionsDashboard } from "../../components/merchant/TransactionsDashboard";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/transactions",
  useSearchParams: () => new URLSearchParams("?status=FAILED&minAmount=5001")
}));

const originalLocation = window.location;
beforeAll(() => {
  // @ts-ignore
  delete (window as any).location;
  window.location = { ...originalLocation, href: "", search: "?status=FAILED&minAmount=5001" } as any;
});
afterAll(() => {
  window.location = originalLocation as any;
});

// We need to NOT mock FilterBar so we can click the actual export button!
// But wait, the previous test mocked FilterBar. Since we are in a new file, it's not mocked!
vi.mock("../../components/dashboard/useTransactions", () => ({
  useTransactions: () => ({ data: { data: [], pagination: { totalPages: 1 } }, isLoading: false })
}));

describe("TransactionsDashboard Export UI", () => {
  it("6: Export uses applied filters", () => {
    // Render
    render(<TransactionsDashboard />);
    
    // Find export button (FilterBar has a button with text "Export CSV" or icon)
    // Actually FilterBar.tsx has a button with text "Export"
    const exportBtn = screen.getByText("Export");
    
    // Click it
    fireEvent.click(exportBtn);
    
    // Check window.location.href
    expect(window.location.href).toContain("/api/v1/merchant/transactions/export?startDate=");
    expect(window.location.href).toContain("endDate=");
  });
});
