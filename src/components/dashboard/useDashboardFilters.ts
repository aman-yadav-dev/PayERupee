"use client";
import { useSyncExternalStore } from "react";
import { getISTDateBoundaries } from "@/lib/date";
import { usePathname } from "next/navigation";

export type DashboardFiltersState = {
  status: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  type?: string;
  paymentMode?: string;
};

const storeMap = new Map<string, DashboardFiltersState>();
const listenerMap = new Map<string, Set<() => void>>();

function getInitialFilters(): DashboardFiltersState {
  const defaultDate = getISTDateBoundaries("Last 30 days");
  return {
    status: "All statuses",
    startDate: defaultDate.startDate,
    endDate: defaultDate.endDate,
  };
}

export function getDashboardFilters(pathname?: string): DashboardFiltersState {
  const key = pathname || "/dashboard";
  if (!storeMap.has(key)) {
    storeMap.set(key, getInitialFilters());
  }
  return storeMap.get(key)!;
}

export function setDashboardFilters(pathname: string, newFilters: Partial<DashboardFiltersState> | { _reset: true }) {
  const key = pathname || "/dashboard";
  const current = getDashboardFilters(key);
  
  if ("_reset" in newFilters && newFilters._reset) {
    storeMap.set(key, getInitialFilters());
  } else {
    storeMap.set(key, { ...current, ...(newFilters as Partial<DashboardFiltersState>) });
  }

  const listeners = listenerMap.get(key);
  if (listeners) {
    listeners.forEach(l => l());
  }
}

function subscribe(pathname: string, listener: () => void) {
  const key = pathname || "/dashboard";
  if (!listenerMap.has(key)) {
    listenerMap.set(key, new Set());
  }
  listenerMap.get(key)!.add(listener);
  return () => {
    listenerMap.get(key)?.delete(listener);
  };
}

export function buildFilterSearchParams(filters: DashboardFiltersState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "All statuses") params.set("status", filters.status);
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.minAmount !== undefined) params.set("minAmount", filters.minAmount.toString());
  if (filters.maxAmount !== undefined) params.set("maxAmount", filters.maxAmount.toString());
  if (filters.search) params.set("search", filters.search);
  if (filters.type && filters.type !== "All types") params.set("type", filters.type);
  if (filters.paymentMode && filters.paymentMode !== "All modes") params.set("paymentMode", filters.paymentMode);
  return params;
}

export function useDashboardFilters() {
  const pathname = usePathname() || "/dashboard";
  
  return useSyncExternalStore(
    (listener) => subscribe(pathname, listener),
    () => getDashboardFilters(pathname),
    () => getDashboardFilters(pathname)
  );
}
