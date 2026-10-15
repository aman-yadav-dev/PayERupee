/** @vitest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Topbar } from "@/components/dashboard/Topbar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/dashboard",
}));

vi.mock("@/modules/auth/infrastructure/auth-client", () => ({
  useSession: () => ({ data: { user: { name: "Test Merchant" } } }),
  signOut: vi.fn(),
}));

describe("Topbar Notifications UI", () => {
  let mockFetch: any;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  it("safely strips GMT/UTC from historical New Login messages and converts footers to IST", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          unreadCount: 4,
          notifications: [
            {
              id: "notif-1",
              title: "New Login",
              message: "A new login was detected on your account at Sun, 04 Oct 2026 06:30:17 GMT.", // Historical GMT
              createdAt: "2026-10-04T06:30:17Z", // 06:30 UTC = 12:00 PM IST
              read: false,
            },
            {
              id: "notif-2",
              title: "New Login",
              message: "A new login was detected on your account at Sun, 04 Oct 2026 21:18:55 UTC.", // Historical UTC
              createdAt: "2026-10-03T21:18:55Z", // 21:18 UTC = 02:48 AM IST (Next day)
              read: false,
            },
            {
              id: "notif-3",
              title: "New Login",
              message: "A new login was detected on your account.", // Canonical new message
              createdAt: "2026-10-04T12:00:00Z",
              read: false,
            },
            {
              id: "notif-4",
              title: "System Update",
              message: "Unrelated message that happens to mention UTC just in case.", // Should NOT be touched
              createdAt: "2026-10-04T12:00:00Z",
              read: false,
            }
          ]
        }
      })
    });

    render(<Topbar onMenuClick={vi.fn()} />);

    // Wait for notifications to load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Open notifications dropdown
    const bellBtn = screen.getByLabelText("Notifications");
    fireEvent.click(bellBtn);

    // Verify IST timestamps are rendered
    await waitFor(() => {
      // Footer conversions
      expect(screen.queryByText("04 Oct 2026, 12:00 pm")).not.toBeNull();
      expect(screen.queryByText("04 Oct 2026, 02:48 am")).not.toBeNull();
    });

    const dropdown = screen.getByText("Notifications").closest("div");
    
    // Prove New Login canonical message renders exactly 3 times
    const newLoginMessages = screen.getAllByText("A new login was detected on your account.");
    expect(newLoginMessages.length).toBe(3);

    // Ensure unrelated notification message is exactly intact
    expect(screen.queryByText("Unrelated message that happens to mention UTC just in case.")).not.toBeNull();
    
    // Check that historical leaked GMT/UTC strings are NOT present
    expect(dropdown?.textContent).not.toMatch(/06:30:17 GMT/);
    expect(dropdown?.textContent).not.toMatch(/21:18:55 UTC/);
  });
});
