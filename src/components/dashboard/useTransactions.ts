import { useState, useEffect, useCallback } from "react";
import { useDashboardFilters, buildFilterSearchParams } from "./useDashboardFilters";

export interface ApiTransaction {
  id: string;
  type: string;
  reference: string;
  amount: string;
  fee: string;
  tax: string;
  totalDebitAmount: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  paymentMode: string;
  destination: {
    accountName: string | null;
    accountNumber: string | null;
    ifscCode: string | null;
    vpa?: string | null;
    phone?: string;
  };
  failureReason?: string;
}

export function useTransactions(page: number, limit: number = 20) {
  const filters = useDashboardFilters();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const buildUrl = useCallback(() => {
    let url = `/api/v1/merchant/transactions?page=${page}&limit=${limit}`;

    if (filters.status === "Completed") url += "&status=SUCCESS";
    else if (filters.status === "Pending") url += "&status=PENDING";
    else if (filters.status === "Failed") url += "&status=FAILED";

    if (filters.startDate) url += `&startDate=${encodeURIComponent(filters.startDate)}`;
    if (filters.endDate) url += `&endDate=${encodeURIComponent(filters.endDate)}`;
    if (filters.minAmount !== undefined) url += `&minAmount=${filters.minAmount}`;
    if (filters.maxAmount !== undefined) url += `&maxAmount=${filters.maxAmount}`;
    if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
    if (filters.paymentMode && filters.paymentMode !== "All modes") url += `&paymentMode=${encodeURIComponent(filters.paymentMode)}`;

    return url;
  }, [page, limit, filters]);

  const fetchTransactions = useCallback(async (isBackground = false, signal?: AbortSignal) => {
    if (filters.status === "Validation failed") {
      if (!isBackground) {
        setData({ data: [], pagination: { totalPages: 1 } });
        setIsLoading(false);
        setIsError(false);
      }
      return;
    }

    if (!isBackground) {
      setIsLoading(true);
      setIsError(false);
      setError(null);
    }

    try {
      const url = buildUrl();
      const res = await fetch(url, { signal, cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to load transactions");
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setData(json);
        if (!isBackground) {
          setIsLoading(false);
        } else {
          // If background poll succeeds, clear any previous background error state to recover UI
          setIsError(false);
          setError(null);
        }
      } else {
        throw new Error(json.error || "Invalid response format");
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      if (!isBackground) {
        setIsError(true);
        setError(err);
        setIsLoading(false);
      }
      // Silent failure for background polling
    }
  }, [buildUrl, filters.status]);

  // Initial fetch on mount or dependencies change
  useEffect(() => {
    const controller = new AbortController();
    fetchTransactions(false, controller.signal);
    return () => controller.abort();
  }, [fetchTransactions]);

  // Background polling (every 8 seconds) & Visibility Change
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isFetching = false;
    let isMounted = true;
    const controller = new AbortController();

    const performPoll = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible" && !isFetching) {
        isFetching = true;
        await fetchTransactions(true, controller.signal);
        isFetching = false;
      }
    };

    const pollLoop = async () => {
      if (!isMounted) return;
      await performPoll();
      if (isMounted) {
        timeoutId = setTimeout(pollLoop, 8000);
      }
    };

    // Start cycle (wait 8s for the first BACKGROUND poll, since initial fetch happens above)
    timeoutId = setTimeout(pollLoop, 8000);

    const handleVisibilityChange = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        // Cancel current waiting timer
        clearTimeout(timeoutId);
        // Fetch immediately
        await performPoll();
        // Restart loop
        if (isMounted) {
          timeoutId = setTimeout(pollLoop, 8000);
        }
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      controller.abort();
    };
  }, [fetchTransactions]);

  return { data, isLoading, isError, error };
}
