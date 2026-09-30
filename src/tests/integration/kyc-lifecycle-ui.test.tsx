// @vitest-environment jsdom
import React from 'react';
import { render, screen, waitFor, fireEvent, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UnderReviewPoller } from '@/app/(setup)/kyc/under-review/UnderReviewPoller';
import RejectedClient from '@/app/(setup)/kyc/rejected/RejectedClient';
import PendingApprovalPoller from '@/app/(setup)/pending-approval/PendingApprovalPoller';
import { useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

describe("KYC Lifecycle UI Behaviors", () => {
  let mockRouter: any;
  let globalFetch: any;

  beforeEach(() => {
    mockRouter = {
      push: vi.fn(),
      refresh: vi.fn(),
    };
    (useRouter as any).mockReturnValue(mockRouter);
    globalFetch = vi.fn();
    global.fetch = globalFetch;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("UnderReviewPoller", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("starts polling after mount and calls router.refresh() if status changes", async () => {
      // Initially mock fetch to return UNDER_REVIEW
      globalFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: "UNDER_REVIEW" } })
      });

      render(<UnderReviewPoller />);

      // Advance time by 5 seconds
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // Assert fetch was called
      expect(globalFetch).toHaveBeenCalledTimes(1);
      expect(globalFetch).toHaveBeenCalledWith("/api/v1/merchant/kyc/application", expect.any(Object));
      
      // Since it was UNDER_REVIEW, router.refresh should NOT be called
      expect(mockRouter.refresh).not.toHaveBeenCalled();

      // Now mock it to return APPROVED
      globalFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { status: "APPROVED" } })
      });

      // Advance time by another 5 seconds
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // Assert router.refresh was called
      expect(globalFetch).toHaveBeenCalledTimes(2);
      expect(mockRouter.refresh).toHaveBeenCalledTimes(1);
    });
    
    it("cleans up the interval on unmount", async () => {
      const { unmount } = render(<UnderReviewPoller />);
      
      unmount();
      
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });
      
      expect(globalFetch).not.toHaveBeenCalled();
    });
  });

  describe("RejectedClient", () => {
    let originalLocation: Location;
    
    beforeEach(() => {
      vi.useFakeTimers(); 
      originalLocation = window.location;
      delete (window as any).location;
      (window as any).location = { ...originalLocation, assign: vi.fn() } as any;
    });
    
    afterEach(() => {
      (window as any).location = originalLocation; 
      vi.useRealTimers();
    });

    it("calls window.location.assign('/kyc/form') after successful API response", async () => {
      globalFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) });
      
      render(<RejectedClient allowResubmission={true} />);
      
      const resubmitBtn = screen.getByRole('button', { name: /review & resubmit/i });
      await act(async () => {
        fireEvent.click(resubmitBtn);
      });

      expect(globalFetch).toHaveBeenCalledTimes(1);
      expect(window.location.assign).toHaveBeenCalledWith("/kyc/form");
    });

    it("does not navigate if API fails", async () => {
      globalFetch.mockResolvedValueOnce({ ok: false });
      
      render(<RejectedClient allowResubmission={true} />);
      
      const resubmitBtn = screen.getByRole('button', { name: /review & resubmit/i });
      await act(async () => {
        fireEvent.click(resubmitBtn);
      });

      expect(globalFetch).toHaveBeenCalledTimes(1);
      expect(window.location.assign).not.toHaveBeenCalled();
      expect((resubmitBtn as HTMLButtonElement).disabled).toBe(false);
    });
    
    it("prevents repeated clicks while loading", async () => {
      let resolveFetch: any;
      const fetchPromise = new Promise((resolve) => { resolveFetch = resolve; });
      globalFetch.mockReturnValue(fetchPromise);
      
      render(<RejectedClient allowResubmission={true} />);
      
      const resubmitBtn = screen.getByRole('button', { name: /review & resubmit/i });
      
      await act(async () => {
        fireEvent.click(resubmitBtn);
      });
      
      expect((resubmitBtn as HTMLButtonElement).disabled).toBe(true);
      
      await act(async () => {
        fireEvent.click(resubmitBtn);
      });
      
      expect(globalFetch).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveFetch({ ok: true, json: async () => ({ success: true }) });
      });
    });
  });

  describe("PendingApprovalPoller", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("calls router.refresh() every 5 seconds", async () => {
      render(<PendingApprovalPoller />);

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockRouter.refresh).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockRouter.refresh).toHaveBeenCalledTimes(2);
    });

    it("cleans up the interval on unmount", async () => {
      const { unmount } = render(<PendingApprovalPoller />);
      
      unmount();
      
      await act(async () => {
        vi.advanceTimersByTime(10000);
      });
      
      expect(mockRouter.refresh).not.toHaveBeenCalled();
    });
  });
});
