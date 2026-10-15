/** @vitest-environment jsdom */
import React from "react";
import { render, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WalletDashboard } from "@/components/merchant/WalletDashboard";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("W8.3: FilterBar UI to WalletDashboard fetch construction", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [], pagination: { totalPages: 1 } })
    });
  });

  it("constructs the correct URL query parameters when an amount range is selected", async () => {
    const { getAllByText, getByText } = render(<WalletDashboard />);

    mockFetch.mockClear();

    // Open amount dropdown
    fireEvent.click(getAllByText("Amount range")[0]);

    // Select specific option
    fireEvent.click(getAllByText(/10,001/i)[0]);

    // Apply
    await act(async () => {
      fireEvent.click(getByText("Apply filters"));
      await new Promise(r => setTimeout(r, 100)); 
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("minAmount=10001")
    );
  });
});
