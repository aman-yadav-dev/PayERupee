"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, TrendingUp, CircleCheck, Hourglass } from "lucide-react";
import { formatINR, formatNumber } from "@/lib/utils";
import { useDashboardFilters } from "./useDashboardFilters";

export function KpiCards() {
  const filters = useDashboardFilters();

  const [balance, setBalance] = useState<number | null>(null);
  const [monthSpend, setMonthSpend] = useState<number | null>(null);
  const [monthSpendDelta, setMonthSpendDelta] = useState<number | null>(null);
  
  const [successRate, setSuccessRate] = useState<number | null>(null);
  const [successRateDelta, setSuccessRateDelta] = useState<number | null>(null);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [resolvedCount, setResolvedCount] = useState<number>(0);
  
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingAmount, setPendingAmount] = useState<number>(0);

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function fetchWallet() {
      try {
        let url = "/api/v1/merchant/wallet";
        const params = new URLSearchParams();
        if (filters.status && filters.status !== "All statuses") {
          const mapped = filters.status === "Completed" ? "SUCCESS" : filters.status === "Pending" ? "PENDING" : filters.status === "Failed" ? "FAILED" : "";
          if (mapped) params.set("status", mapped);
        }
        if (filters.startDate) params.set("startDate", filters.startDate);
        if (filters.endDate) params.set("endDate", filters.endDate);
        if (filters.minAmount !== undefined) params.set("minAmount", String(filters.minAmount));
        if (filters.maxAmount !== undefined) params.set("maxAmount", String(filters.maxAmount));
        
        const qs = params.toString();
        if (qs) url += `?${qs}`;

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error("Failed to fetch wallet");
        }
        const json = await res.json();
        
        const b = json.data?.balance;
        const balanceNum = typeof b === "string" ? parseFloat(b) : b;
        
        const ms = json.data?.monthSpend;
        const monthSpendNum = typeof ms === "string" ? parseFloat(ms) : ms;

        const msd = json.data?.monthSpendDelta;
        const monthSpendDeltaNum = typeof msd === "string" ? parseFloat(msd) : msd;

        if (json.success && typeof balanceNum === "number" && !isNaN(balanceNum)) {
          if (mounted) {
            setBalance(balanceNum);
            setMonthSpend(typeof monthSpendNum === "number" && !isNaN(monthSpendNum) ? monthSpendNum : 0);
            setMonthSpendDelta(typeof monthSpendDeltaNum === "number" && !isNaN(monthSpendDeltaNum) ? monthSpendDeltaNum : null);
            
            setSuccessRate(json.data?.successRate ?? 0);
            setSuccessRateDelta(json.data?.successRateDelta !== undefined ? json.data.successRateDelta : null);
            setSuccessCount(json.data?.successCount ?? 0);
            setResolvedCount(json.data?.resolvedCount ?? 0);
            
            setPendingCount(json.data?.pendingCount ?? 0);
            setPendingAmount(json.data?.pendingAmount ?? 0);
            
            setHasError(false);
          }
        } else {
          throw new Error("Invalid data");
        }
      } catch (err) {
        if (mounted) {
          setHasError(true);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchWallet();
    return () => {
      mounted = false;
    };
  }, [filters]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Hero card — available balance */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 shadow-[var(--shadow-hero)] lg:col-span-1 lift-on-hover animate-fade-up [animation-delay:600ms]"
        style={{ background: "linear-gradient(135deg, #0b1220 0%, #123b93 100%)" }}
      >
        <div
          className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-30 blur-2xl"
          style={{ background: "radial-gradient(circle, #5c92f8, transparent 70%)" }}
        />
        <div className="relative flex items-center justify-between">
          <span className="text-[12.5px] text-white/60">Available balance</span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/[0.1] px-2 py-1 text-[11px] font-medium text-blue-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-live-pulse" />
            Live
          </span>
        </div>
        <p className="relative font-display tabular-nums text-[30px] leading-tight font-medium text-white mt-3 min-h-[38px]">
          {isLoading ? (
            <span className="opacity-50">—</span>
          ) : hasError || balance === null ? (
            "—"
          ) : (
            formatINR(balance)
          )}
        </p>
        <Link
          href="/wallet"
          className="relative mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-white/85 hover:text-blue-400 transition-colors press-feedback"
        >
          Withdraw to bank
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />
        </Link>
      </div>

      {/* Month spend */}
      <div className="rounded-2xl border border-line bg-surface p-5 lift-on-hover animate-fade-up [animation-delay:650ms]">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-text-secondary">This month&rsquo;s spend</span>
          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <TrendingUp className="h-4 w-4" strokeWidth={1.9} />
          </div>
        </div>
        <p className="font-display tabular-nums text-[26px] leading-tight font-medium text-text-primary mt-3 min-h-[32px]">
          {isLoading ? (
            <span className="opacity-50 text-text-muted">—</span>
          ) : hasError || monthSpend === null ? (
            <span className="text-text-muted">—</span>
          ) : (
            formatINR(monthSpend, { compact: true })
          )}
        </p>
        {!isLoading && !hasError && monthSpendDelta !== null && (
          <p className={`text-[12px] font-medium mt-2 ${monthSpendDelta < 0 ? 'text-red-600' : 'text-blue-600'}`}>
            {monthSpendDelta > 0 ? '+' : ''}{monthSpendDelta % 1 !== 0 ? monthSpendDelta.toFixed(1) : monthSpendDelta}% vs last month
          </p>
        )}
      </div>

      {/* Success rate */}
      <div className="rounded-2xl border border-line bg-surface p-5 lift-on-hover animate-fade-up [animation-delay:700ms]">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-text-secondary">Success rate</span>
          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <CircleCheck className="h-4 w-4" strokeWidth={1.9} />
          </div>
        </div>
        <p className="font-display tabular-nums text-[26px] leading-tight font-medium text-text-primary mt-3 min-h-[32px]">
          {isLoading ? (
            <span className="opacity-50 text-text-muted">—</span>
          ) : hasError || successRate === null ? (
            <span className="text-text-muted">—</span>
          ) : (
            `${successRate}%`
          )}
        </p>
        {!isLoading && !hasError && (
          successRateDelta !== null ? (
            <p className="text-[12px] text-text-muted mt-2">
              <span className={`font-medium ${successRateDelta < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                {successRateDelta > 0 ? '+' : ''}{successRateDelta % 1 !== 0 ? successRateDelta.toFixed(1) : successRateDelta}%
              </span> &middot; {formatNumber(successCount)} of {formatNumber(resolvedCount)} txns
            </p>
          ) : (
            <p className="text-[12px] text-text-muted mt-2">
              <span className="font-medium">Filtered data</span> &middot; {formatNumber(successCount)} of {formatNumber(resolvedCount)} txns
            </p>
          )
        )}
      </div>

      {/* Pending requests */}
      <div className="rounded-2xl border border-line bg-surface p-5 lift-on-hover animate-fade-up [animation-delay:750ms]">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-text-secondary">Pending requests</span>
          <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
            <Hourglass className="h-4 w-4" strokeWidth={1.9} />
          </div>
        </div>
        <p className="font-display tabular-nums text-[26px] leading-tight font-medium text-text-primary mt-3 min-h-[32px]">
          {isLoading ? (
            <span className="opacity-50 text-text-muted">—</span>
          ) : hasError ? (
            <span className="text-text-muted">—</span>
          ) : (
            formatNumber(pendingCount)
          )}
        </p>
        {!isLoading && !hasError && (
          <p className="text-[12px] text-text-muted mt-2">
            {formatINR(pendingAmount, { compact: true })} awaiting processing
          </p>
        )}
      </div>
    </div>
  );
}
