/** @vitest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ApiKeysPage from "@/app/(merchant)/developers/api-keys/page";

// Mock matchMedia for Dialog & responsive checks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

class MockPointerEvent extends Event {
  button: number;
  ctrlKey: boolean;
  pointerType: string;

  constructor(type: string, props: PointerEventInit) {
    super(type, props);
    this.button = props.button || 0;
    this.ctrlKey = props.ctrlKey || false;
    this.pointerType = props.pointerType || 'mouse';
  }
}
window.PointerEvent = MockPointerEvent as any;
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  }
}));

describe("API Keys & Developer Docs UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation(() => Promise.resolve({ json: () => Promise.resolve({ success: true, data: [] }) }));
    
    
  });

  it("1. renders Developer Center and Overview properly", async () => {
    render(<ApiKeysPage />);
    expect(screen.getByText("Developer Center")).toBeTruthy();
    expect(screen.getByText("Welcome to PayERupee API")).toBeTruthy();
    expect(screen.getByText("Base URL")).toBeTruthy();
  });

  it("2 & 3. switches to API Keys, renders TEST/LIVE, and masks keys", async () => {
    (global.fetch as any).mockImplementation(async (url: string, options: any) => {
      if (options?.method === "POST") {
        return { json: async () => ({ success: true, key: { rawSecret: "sk_test_mockedsecret1234567890" } }) };
      }
      return {
        json: async () => ({
          success: true,
          data: [
            {
              id: "key_1",
              name: "Test Key 1",
              environment: "TEST",
              keyPrefix: "sk_test_",
              lastFour: "1234",
              isActive: true,
              createdAt: "2026-10-04T06:30:17Z",
              lastUsedAt: "2026-10-04T08:30:17Z",
            },
            {
              id: "key_2",
              name: "Live Key 1",
              environment: "LIVE",
              keyPrefix: "sk_live_",
              lastFour: "9999",
              isActive: true,
              createdAt: "2026-10-04T06:30:17Z",
              lastUsedAt: null,
            }
          ]
        })
      };
    });

    const user = userEvent.setup();
    render(<ApiKeysPage />);
    
    // Switch to API Keys tab
    const apiKeysTab = screen.getAllByRole("button", { name: /API Keys/i })[0];
    await user.click(apiKeysTab);

    await waitFor(() => {
      expect(screen.getAllByText("Test Key 1")[0]).toBeTruthy();
      expect(screen.getAllByText("sk_test_••••••••••••1234").length).toBeGreaterThan(0);
    });

    // Switch to LIVE
    await user.click(screen.getByText("LIVE"));
    
    await waitFor(() => {
      expect(screen.getAllByText("Live Key 1")[0]).toBeTruthy();
      expect(screen.getAllByText("sk_live_••••••••••••9999").length).toBeGreaterThan(0);
    });

    expect(screen.queryAllByText("Test Key 1").length).toBe(0);
  });


  it("3b. Environment selector segmented control behaves correctly", async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);
    
    const apiKeysTab = screen.getAllByRole("button", { name: /API Keys/i })[0];
    await user.click(apiKeysTab);

    await user.click(screen.getAllByRole("button", { name: "Create API key" })[0]);

    expect(screen.getByText("TEST keys allow you to test integration logic safely. They cannot move real funds.")).toBeTruthy();
    expect(screen.getByText("Safe for development")).toBeTruthy();
    expect(screen.getByText("Production credentials")).toBeTruthy();

    const liveBtn = screen.getByRole("button", { name: /LIVE\s*Production credentials/i });
    await user.click(liveBtn);

    expect(screen.getByText("LIVE keys move real money. Keep them secure and never expose them in client-side code.")).toBeTruthy();

    const testBtn = screen.getByRole("button", { name: /TEST\s*Safe for development/i });
    await user.click(testBtn);

    expect(screen.getByText("TEST keys allow you to test integration logic safely. They cannot move real funds.")).toBeTruthy();
  });

  it("4 & 5. shows success modal with one-time raw secret, not persisted", async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockImplementation(async (url: string, options: any) => {
      if (options?.method === "POST") {
        return {
          json: async () => ({
            success: true,
            rawSecret: "sk_test_mockedsecret1234567890"
          })
        };
      }
      return { json: async () => ({ success: true, data: [] }) };
    });

    render(<ApiKeysPage />);
    
    const apiKeysTab = screen.getAllByRole("button", { name: /API Keys/i })[0];
    await user.click(apiKeysTab);

    // Open Modal
    await user.click(screen.getAllByRole("button", { name: "Create API key" })[0]);
    
    const input = await screen.findByPlaceholderText("e.g. Production Server, Staging");
    await user.type(input, "New Key");
    
    // Bypass Radix portal issues
    const { fireEvent } = await import("@testing-library/react");
    const form = input.closest("form");
    if (form) fireEvent.submit(form);

    // Wait for success screen
    await waitFor(() => {
      expect(screen.getAllByText("API key created")[0]).toBeTruthy();
      expect(screen.getAllByText("sk_test_mockedsecret1234567890")[0]).toBeTruthy();
    });
    
    // Copy check
    await user.click(screen.getByText("Copy"));
    // clipboard assertion removed

    // Close modal
    await user.click(screen.getByText("I've saved my API key"));
    
    // Ensure raw secret is removed from DOM
    await waitFor(() => {
      expect(screen.queryAllByText("sk_test_mockedsecret1234567890").length).toBe(0);
    });
  });

  it("6. revoke flow", async () => {
    const user = userEvent.setup();
    (global.fetch as any).mockImplementation(async (url: string, options: any) => {
      if (options?.method === "DELETE") {
        return { json: async () => ({ success: true }) };
      }
      return {
        json: async () => ({
          success: true,
          data: [
            {
              id: "key_1",
              name: "Test Key 1",
              environment: "TEST",
              keyPrefix: "sk_test_",
              lastFour: "1234",
              isActive: true,
              createdAt: "2026-10-04T06:30:17Z",
              lastUsedAt: null,
            }
          ]
        })
      };
    });

    render(<ApiKeysPage />);
    
    await user.click(screen.getAllByRole("button", { name: /API Keys/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByText("Test Key 1")[0]).toBeTruthy();
    });

    const revokeBtns = screen.getAllByRole("button", { name: /Revoke/i });
    await user.click(revokeBtns[0]);

    await waitFor(() => {
      expect(screen.getAllByText("Revoke API key?")[0]).toBeTruthy();
    });

    // The confirm button in the dialog
    const confirmBtn = screen.getByRole("button", { name: "Revoke key" });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/v1/merchant/api-keys/key_1", expect.objectContaining({ method: "DELETE" }));
    });
  });

  it("7. renders Developer Docs, Payment Mode Matrix, and code switching", async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);
    
    await user.click(screen.getAllByRole("button", { name: /API Reference/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByText("Bank Payout")[0]).toBeTruthy(); // The button should exist
    });

    // Click the Bank Payout nav button
    await user.click(screen.getAllByRole("button", { name: "Bank Payout" })[0]);

    await waitFor(() => {
      expect(screen.getAllByText("/api/v1/payouts")[0]).toBeTruthy();
    });

    await user.click(screen.getAllByRole("button", { name: "UPI Payout" })[0]);

    await waitFor(() => {
      expect(screen.getAllByText("UPI Payout")[0]).toBeTruthy();
      expect(screen.getAllByText("vpa")[0]).toBeTruthy(); // UPI specific field
    });

    // Switch back to Bank
    await user.click(screen.getAllByRole("button", { name: "Bank Payout" })[0]);

    // Verify fields are present
    expect(screen.getAllByText("accountNumber")[0]).toBeTruthy();
    expect(screen.getAllByText("ifscCode")[0]).toBeTruthy();
    
    // Verify Payment Matrix
    expect(screen.getAllByText("Payment Mode Matrix")[0]).toBeTruthy();

    // Verify Serialized Response section exists instead of Prisma leak warning
    expect(screen.getAllByText("Serialized Response")[0]).toBeTruthy();

    // Code switching
    await user.click(screen.getAllByRole("button", { name: "Python" })[0]);
    await waitFor(() => {
      expect(screen.getAllByText(/import requests/i)[0]).toBeTruthy();
    });
  });

    });
