/**
 * @vitest-environment jsdom
 */
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { useDashboardFilters, setDashboardFilters, getDashboardFilters, buildFilterSearchParams } from "../../components/dashboard/useDashboardFilters";

const mockPathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: vi.fn() })
}));

describe("Transactions Payment Mode Filter Regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. paymentMode correctly clears when reset to 'All modes'", () => {
    mockPathname.mockReturnValue("/transactions");
    
    // Simulate setting to UPI
    act(() => setDashboardFilters("/transactions", { paymentMode: "UPI" }));
    let filters = getDashboardFilters("/transactions");
    expect(filters.paymentMode).toBe("UPI");
    
    let params = buildFilterSearchParams(filters);
    expect(params.get("paymentMode")).toBe("UPI");
    
    // Simulate setting back to All modes (which passes undefined)
    act(() => setDashboardFilters("/transactions", { paymentMode: undefined }));
    filters = getDashboardFilters("/transactions");
    expect(filters.paymentMode).toBeUndefined();
    
    // params should not contain paymentMode
    params = buildFilterSearchParams(filters);
    expect(params.has("paymentMode")).toBe(false);
  });
  
  it("2. Multiple mode changes", () => {
    mockPathname.mockReturnValue("/transactions");
    
    act(() => setDashboardFilters("/transactions", { paymentMode: "IMPS" }));
    expect(getDashboardFilters("/transactions").paymentMode).toBe("IMPS");
    
    act(() => setDashboardFilters("/transactions", { paymentMode: "UPI" }));
    expect(getDashboardFilters("/transactions").paymentMode).toBe("UPI");
    
    act(() => setDashboardFilters("/transactions", { paymentMode: undefined }));
    expect(getDashboardFilters("/transactions").paymentMode).toBeUndefined();
  });
});
