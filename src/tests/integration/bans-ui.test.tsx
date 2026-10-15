// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import MerchantBansPage from "@/app/(merchant)/settings/bans/page";
import AdminBansPage from "@/app/(admin)/admin/bans/page";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Merchant & Admin Bans UI Test Suite", () => {
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Merchant Bans Management UI", () => {
    const mockLocalBans = [
      {
        id: "ban-1",
        merchantProfileId: "mp-1",
        destinationType: "UPI",
        maskedDestination: "fraud***@okhdfcbank",
        reason: "Suspected chargeback fraud",
        status: "ACTIVE",
        createdAt: "2026-10-13T06:00:00.000Z",
        updatedAt: "2026-10-13T06:00:00.000Z",
      },
      {
        id: "ban-2",
        merchantProfileId: "mp-1",
        destinationType: "BANK_ACCOUNT",
        maskedDestination: "*********1234 (HDFC0001234)",
        reason: "Unauthorized recipient",
        status: "UNBANNED",
        createdAt: "2026-10-12T06:00:00.000Z",
        updatedAt: "2026-10-12T08:00:00.000Z",
        unbanReason: "Dispute resolved",
      },
    ];

    const mockGlobalRequests = [
      {
        id: "req-1",
        merchantProfileId: "mp-1",
        destinationType: "UPI",
        maskedDestination: "scam***@paytm",
        reason: "Known serial scammer",
        status: "PENDING",
        createdAt: "2026-10-13T06:30:00.000Z",
        updatedAt: "2026-10-13T06:30:00.000Z",
      },
    ];

    const setupMerchantFetch = () => {
      fetchMock.mockImplementation(async (url: string, init?: any) => {
        if (url === "/api/v1/merchant/bans" && (!init || init.method === "GET")) {
          return {
            ok: true,
            json: async () => ({ success: true, data: mockLocalBans }),
          };
        }
        if (url === "/api/v1/merchant/bans/requests" && (!init || init.method === "GET")) {
          return {
            ok: true,
            json: async () => ({ success: true, data: mockGlobalRequests }),
          };
        }
        if (url === "/api/v1/merchant/bans" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { id: "ban-new" } }),
          };
        }
        if (url.includes("/unban") && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ success: true }),
          };
        }
        if (url === "/api/v1/merchant/bans/requests" && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ success: true, data: { id: "req-new" } }),
          };
        }
        return { ok: true, json: async () => ({ success: true, data: [] }) };
      });
    };

    it("renders page header and tabs correctly", async () => {
      setupMerchantFetch();
      await act(async () => {
        render(<MerchantBansPage />);
      });

      expect(screen.getByText("Destination Ban Management")).toBeDefined();
      expect(screen.getByText("Local Bans")).toBeDefined();
      expect(screen.getByText("Global Ban Requests")).toBeDefined();
    });

    it("displays fetched local bans and allows opening unban modal", async () => {
      setupMerchantFetch();
      await act(async () => {
        render(<MerchantBansPage />);
      });

      await waitFor(() => {
        expect(screen.getByText("fraud***@okhdfcbank")).toBeDefined();
        expect(screen.getByText("Suspected chargeback fraud")).toBeDefined();
        expect(screen.getByText("Active Ban")).toBeDefined();
      });

      // Click Unban button
      const unbanButton = screen.getByRole("button", { name: /unban/i });
      fireEvent.click(unbanButton);

      expect(screen.getByText("Unban Destination")).toBeDefined();
      expect(screen.getByPlaceholderText(/Explain why this destination is being unbanned/i)).toBeDefined();
    });

    it("allows submitting an unban request", async () => {
      setupMerchantFetch();
      await act(async () => {
        render(<MerchantBansPage />);
      });

      await waitFor(() => {
        expect(screen.getByText("fraud***@okhdfcbank")).toBeDefined();
      });

      fireEvent.click(screen.getByRole("button", { name: /unban/i }));

      const textarea = screen.getByPlaceholderText(/Explain why this destination is being unbanned/i);
      fireEvent.change(textarea, { target: { value: "Mistaken identity verified" } });

      const confirmBtn = screen.getByRole("button", { name: /confirm unban/i });
      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/merchant/bans/ban-1/unban",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason: "Mistaken identity verified" }),
        })
      );
    });

    it("switches to Global Ban Requests tab and shows requests", async () => {
      setupMerchantFetch();
      await act(async () => {
        render(<MerchantBansPage />);
      });

      const globalTab = screen.getByRole("button", { name: /global ban requests/i });
      fireEvent.click(globalTab);

      await waitFor(() => {
        expect(screen.getByText("scam***@paytm")).toBeDefined();
        expect(screen.getByText("Pending Review")).toBeDefined();
      });
    });
  });

  describe("Admin Global Ban Review UI", () => {
    const mockAdminRequests = [
      {
        id: "req-admin-1",
        merchantProfileId: "mp-101",
        merchantProfile: {
          businessName: "Acme Corp",
          user: { name: "John Doe", email: "john@acme.com" },
        },
        destinationType: "UPI",
        maskedDestination: "badactor***@okaxis",
        reason: "Mass phishing fraud",
        status: "PENDING",
        createdAt: "2026-10-13T06:00:00.000Z",
        updatedAt: "2026-10-13T06:00:00.000Z",
      },
    ];

    const mockAdminGlobalBans = [
      {
        id: "gban-1",
        approvedById: "admin-1",
        sourceRequestId: "req-admin-old",
        destinationType: "BANK_ACCOUNT",
        maskedDestination: "*********9999 (SBI0001234)",
        reason: "Platform fraud syndicate",
        status: "ACTIVE",
        createdAt: "2026-10-10T06:00:00.000Z",
        updatedAt: "2026-10-10T06:00:00.000Z",
      },
    ];

    const setupAdminFetch = () => {
      fetchMock.mockImplementation(async (url: string, init?: any) => {
        if (url.includes("/api/v1/admin/bans/requests") && (!init || init.method === "GET")) {
          return {
            ok: true,
            json: async () => ({ success: true, data: mockAdminRequests }),
          };
        }
        if (url === "/api/v1/admin/bans" && (!init || init.method === "GET")) {
          return {
            ok: true,
            json: async () => ({ success: true, data: mockAdminGlobalBans }),
          };
        }
        if (url.includes("/approve") && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ success: true }),
          };
        }
        if (url.includes("/reject") && init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({ success: true }),
          };
        }
        if (url.includes("/api/v1/admin/bans/") && (init?.method === "DELETE" || init?.method === "POST")) {
          return {
            ok: true,
            json: async () => ({ success: true }),
          };
        }
        return { ok: true, json: async () => ({ success: true, data: [] }) };
      });
    };

    it("renders admin page with pending requests and handles approval", async () => {
      setupAdminFetch();
      await act(async () => {
        render(<AdminBansPage />);
      });

      expect(screen.getByText("Global Ban Review")).toBeDefined();
      await waitFor(() => {
        expect(screen.getByText("badactor***@okaxis")).toBeDefined();
        expect(screen.getByText("Acme Corp")).toBeDefined();
      });

      const approveBtn = screen.getByTitle("Approve Global Ban");
      fireEvent.click(approveBtn);

      expect(screen.getByText("Approve Global Ban Request")).toBeDefined();

      const confirmApproveBtn = screen.getByRole("button", { name: /confirm approval/i });
      await act(async () => {
        fireEvent.click(confirmApproveBtn);
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/admin/bans/requests/req-admin-1/approve",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("handles admin rejection flow", async () => {
      setupAdminFetch();
      await act(async () => {
        render(<AdminBansPage />);
      });

      await waitFor(() => {
        expect(screen.getByText("badactor***@okaxis")).toBeDefined();
      });

      const rejectBtn = screen.getByTitle("Reject Request");
      fireEvent.click(rejectBtn);

      expect(screen.getByText("Reject Global Ban Request")).toBeDefined();

      const reasonInput = screen.getByPlaceholderText(/Explain why this request is being declined/i);
      fireEvent.change(reasonInput, { target: { value: "Insufficient evidence provided" } });

      const confirmRejectBtn = screen.getByRole("button", { name: /confirm rejection/i });
      await act(async () => {
        fireEvent.click(confirmRejectBtn);
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/admin/bans/requests/req-admin-1/reject",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            rejectionReason: "Insufficient evidence provided",
            reason: "Insufficient evidence provided",
          }),
        })
      );
    });

    it("handles active global bans removal", async () => {
      setupAdminFetch();
      await act(async () => {
        render(<AdminBansPage />);
      });

      const activeTab = screen.getByRole("button", { name: /active global bans/i });
      fireEvent.click(activeTab);

      await waitFor(() => {
        expect(screen.getByText("*********9999 (SBI0001234)")).toBeDefined();
      });

      const removeBtn = screen.getByRole("button", { name: /remove ban/i });
      fireEvent.click(removeBtn);

      expect(screen.getByText("Remove Active Global Ban")).toBeDefined();

      const reasonInput = screen.getByPlaceholderText(/Specify why this global ban is being removed/i);
      fireEvent.change(reasonInput, { target: { value: "Legitimate merchant verified" } });

      const confirmRemoveBtn = screen.getByRole("button", { name: /confirm removal/i });
      await act(async () => {
        fireEvent.click(confirmRemoveBtn);
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/admin/bans/gban-1",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({
            removalReason: "Legitimate merchant verified",
            reason: "Legitimate merchant verified",
          }),
        })
      );
    });
  });
});
