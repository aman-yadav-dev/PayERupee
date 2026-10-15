"use client";

import React, { useEffect, useState, useRef } from "react";
import { formatDateIST, formatDateTimeIST } from "@/lib/date";
import { formatINR } from "@/lib/utils";
import { Plus, ArrowDownToLine, AlertCircle, Search, ChevronLeft, ChevronRight, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { toast } from "sonner";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { useDashboardFilters, buildFilterSearchParams } from "@/components/dashboard/useDashboardFilters";
import { AddFundsModal } from "./AddFundsModal";
import { WithdrawModal } from "./WithdrawModal";

interface ApiActivity {
  id: string;
  type: "ADD_MONEY" | "WITHDRAWAL";
  reference: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "PROCESSING" | "REVERSED" | string;
  createdAt: string;
  amount: string | number;
  metadata: {
    paymentMode?: string;
    fee?: string | number;
  };
}

export function WalletDashboard() {
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [data, setData] = useState<ApiActivity[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const filters = useDashboardFilters();
  useEffect(() => { setPage(1); }, [filters]);
  const prevFiltersRef = useRef(filters);

  useEffect(() => {
    // Reset page to 1 when filters change
    if (JSON.stringify(prevFiltersRef.current) !== JSON.stringify(filters)) {
      setPage(1);
      prevFiltersRef.current = filters;
    }
  }, [filters]);

  useEffect(() => {
    let mounted = true;
    async function fetchBalance() {
      try {
        const res = await fetch("/api/v1/merchant/wallet");
        if (!res.ok) throw new Error("Failed to load balance");
        const json = await res.json();
        
        if (json.success && json.data) {
          if (mounted) {
            const balanceNum = typeof json.data.balance === "string" ? parseFloat(json.data.balance) : json.data.balance;
            if (isNaN(balanceNum) || json.data.balance === null) {
              setBalanceError("Invalid balance");
            } else {
              setBalance(balanceNum);
              setBalanceError(null);
            }
          }
        } else {
          throw new Error("Malformed balance response");
        }
      } catch (err: any) {
        if (mounted) {
          setBalanceError(err instanceof Error ? err.message : "Error loading balance");
        }
      } finally {
        if (mounted) setBalanceLoading(false);
      }
    }
    fetchBalance();
    return () => { mounted = false; };
  }, [refreshKey]);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      setTxLoading(true);

      

      try {
        const params = buildFilterSearchParams(filters);
        params.set("page", page.toString());
        params.set("limit", "10");

        const res = await fetch('/api/v1/merchant/wallet/activity?' + params.toString());
        if (!res.ok) throw new Error("Failed to load wallet activity");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          if (mounted) {
            setData(json.data);
            setTotalPages(json.pagination?.totalPages || 1);
            setTxError(null);
          }
        } else {
          throw new Error("Invalid activity data");
        }
      } catch (err: any) {
        if (mounted) setTxError(err.message || "An error occurred");
      } finally {
        if (mounted) setTxLoading(false);
      }
    }
    fetchData();
    return () => { mounted = false; };
  }, [filters, page, refreshKey]);


  // Background polling (every 8 seconds)
  useEffect(() => {
    let intervalId = setInterval(async () => {
      if (document.visibilityState !== "visible") return;

      try {
        const balRes = await fetch("/api/v1/merchant/wallet");
        if (balRes.ok) {
          const balJson = await balRes.json();
          if (balJson.success && balJson.data) {
            const balanceNum = typeof balJson.data.balance === "string" ? parseFloat(balJson.data.balance) : balJson.data.balance;
            if (!isNaN(balanceNum) && balJson.data.balance !== null) {
              setBalance(balanceNum);
              setBalanceError(null);
            }
          }
        }

        

        const params = buildFilterSearchParams(filters);
        params.set("page", page.toString());
        params.set("limit", "10");

        const actRes = await fetch("/api/v1/merchant/wallet/activity?" + params.toString());
        if (actRes.ok) {
          const actJson = await actRes.json();
          if (actJson.success && Array.isArray(actJson.data)) {
            setData(actJson.data);
            setTotalPages(actJson.pagination?.totalPages || 1);
            setTxError(null);
          }
        }
      } catch (err) {
        // Silent failure for background polling
      }
    }, 8000);

    return () => clearInterval(intervalId);
  }, [filters, page]);

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).replace(",", "");
  };

  const isFiltered = filters.status !== "All statuses" || filters.startDate || filters.endDate || filters.minAmount || filters.maxAmount || filters.search || (filters.type && filters.type !== "All types");

  const handleClearFilters = () => {
    window.dispatchEvent(
      new CustomEvent("dashboardFilterChange", {
        detail: {
          status: "All statuses",
          startDate: undefined,
          endDate: undefined,
          minAmount: undefined,
          maxAmount: undefined,
          type: "All types",
          search: undefined
        }
      })
    );
    window.location.reload();
  };

  return (
    <div className="px-4 sm:px-5 lg:px-8 py-6 space-y-6 w-full max-w-[1440px] mx-auto animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-semibold text-text-primary tracking-tight">Wallet</h1>
        <p className="text-[14px] text-text-muted mt-1">Manage your balance, funds, and wallet activity.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        <div className="w-full lg:w-[40%] bg-surface border border-line rounded-2xl p-6 shadow-sm flex flex-col justify-center">
          <p className="text-[12px] font-medium text-text-muted uppercase tracking-wider mb-2">Available Balance</p>
          {balanceLoading ? (
            <div className="h-10 w-32 bg-line-soft animate-pulse rounded"></div>
          ) : (
            <h2 className="font-display text-4xl font-semibold text-text-primary tracking-tight">
              {(!balanceError && balance !== null && !isNaN(balance)) ? formatINR(balance) : "—"}
            </h2>
          )}
          {!balanceError && <p className="text-[12px] text-text-muted mt-2">Last updated just now</p>}
        </div>

        <div className="w-full lg:w-[60%] flex flex-col sm:flex-row gap-4 h-full">
          <button 
            type="button"
            className="flex-1 flex flex-col items-center justify-center gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-6 hover:bg-blue-100 transition-colors cursor-pointer h-full text-blue-700 press-feedback min-h-[140px]"
            onClick={() => setIsAddFundsOpen(true)}
          >
            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Plus strokeWidth={2.5} className="w-6 h-6" />
            </div>
            <span className="font-display font-medium text-[15px]">Add Money</span>
          </button>
          
          <button 
            type="button"
            className="flex-1 flex flex-col items-center justify-center gap-3 bg-surface border border-line rounded-2xl p-6 hover:bg-canvas transition-colors cursor-pointer h-full text-text-primary press-feedback min-h-[140px]"
            onClick={() => setIsWithdrawOpen(true)}
          >
            <div className="w-12 h-12 rounded-full bg-canvas border border-line flex items-center justify-center text-text-secondary shadow-sm">
              <ArrowDownToLine strokeWidth={2.5} className="w-6 h-6" />
            </div>
            <span className="font-display font-medium text-[15px]">Withdraw</span>
          </button>
        </div>
      </div>

      <div>
        <FilterBar 
          showType={true} 
          showSearch={true} 
          exportEndpoint="/api/v1/merchant/wallet/export"
        />
      </div>

      <div className="rounded-2xl border border-line bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-1">
          <div>
            <h3 className="font-display text-[15px] font-medium text-text-primary">
              Wallet Activity
            </h3>
            <p className="text-[12px] text-text-muted mt-0.5">
              Money added and withdrawn from your wallet
            </p>
          </div>
        </div>

        <div className="w-full overflow-x-auto pb-2 mt-3">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-y border-line bg-canvas/30 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-3 py-3 font-medium">Reference ID</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {txLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-line-soft last:border-0">
                    <td className="px-5 py-3"><div className="h-4 bg-line rounded w-24 animate-pulse"></div></td>
                    <td className="px-3 py-3"><div className="h-3 bg-line rounded w-16 animate-pulse"></div></td>
                    <td className="px-3 py-3"><div className="h-5 bg-line rounded-full w-20 animate-pulse"></div></td>
                    <td className="px-3 py-3"><div className="h-3 bg-line rounded w-24 animate-pulse"></div></td>
                    <td className="px-5 py-3 flex justify-end"><div className="h-4 bg-line rounded w-20 animate-pulse"></div></td>
                  </tr>
                ))
              ) : txError ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center mb-3">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      </div>
                      <h4 className="text-[13px] font-medium text-text-primary">Failed to load activity</h4>
                      <p className="text-[12px] text-text-muted mt-1">{txError}</p>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-24 text-center">
                    <div className="flex flex-col items-center justify-center animate-fade-in">
                      <div className="h-14 w-14 rounded-full bg-canvas flex items-center justify-center mb-4">
                        <Search className="h-6 w-6 text-text-muted" />
                      </div>
                      <h4 className="text-[15px] font-medium text-text-primary">
                        {isFiltered ? "No wallet activity found" : "Your wallet activity will appear here"}
                      </h4>
                      <p className="text-[13px] text-text-muted mt-1.5 max-w-sm">
                        {isFiltered ? "We couldn't find any activity matching your current filters. Try adjusting them." : "When you add money or withdraw funds, the transactions will appear below."}
                      </p>
                      {isFiltered && (
                        <button 
                          type="button"
                          onClick={handleClearFilters}
                          className="mt-5 text-[13px] font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors press-feedback"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((t, i) => {
                  const amountNum = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
                  const isAdd = t.type === "ADD_MONEY";
                  return (
                    <tr
                      key={t.id}
                      className="border-b border-line-soft last:border-0 hover:bg-canvas/60 transition-colors animate-fade-in"
                      style={{ animationDelay: String(100 + i * 45) + 'ms' }}
                    >
                      <td className="px-5 py-3 text-text-primary font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isAdd ? (
                            <ArrowDownRight className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 text-neutral-500" />
                          )}
                          <span>{isAdd ? "Add Money" : "Withdraw"}</span>
                        </div>
                        <div className="text-[11.5px] font-normal text-text-muted mt-0.5 ml-6">
                          {t.metadata?.paymentMode || "Transfer"}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-text-muted font-mono text-[11.5px] whitespace-nowrap">
                        {t.reference ? (t.reference.length > 20 ? t.reference.slice(0, 18) + "..." : t.reference) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <StatusPill status={
                          t.status === "SUCCESS" || t.status === "APPROVED" ? "completed" :
                          t.status === "PENDING" ? "pending" :
                          t.status === "PROCESSING" ? "processing" :
                          t.status === "FAILED" || t.status === "REJECTED" ? "failed" :
                          t.status === "REVERSED" ? "reversed" : "unknown"
                        } />
                      </td>
                      <td className="px-3 py-3 text-text-muted text-[12px] whitespace-nowrap">
                        {formatDate(t.createdAt)}
                      </td>
                      <td className="px-5 py-3 text-right font-medium whitespace-nowrap">
                        <span className={isAdd ? "text-emerald-600" : "text-text-primary"}>
                          {isAdd ? "+" : "-"}{formatINR(amountNum)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {!txLoading && !txError && data.length > 0 && (
          <div className="border-t border-line px-5 py-3 flex items-center justify-between text-[13px]">
            <div className="text-text-muted">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-md border border-line bg-surface text-text-primary hover:bg-canvas disabled:opacity-40 disabled:hover:bg-surface transition-colors flex items-center gap-1 press-feedback"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-md border border-line bg-surface text-text-primary hover:bg-canvas disabled:opacity-40 disabled:hover:bg-surface transition-colors flex items-center gap-1 press-feedback"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AddFundsModal 
        isOpen={isAddFundsOpen}
        onClose={() => setIsAddFundsOpen(false)}
        onSuccess={() => {
          toast.success('Fund request submitted successfully');
          setRefreshKey(k => k + 1);
        }}
        minAmount={100}
      />

      <WithdrawModal
        isOpen={isWithdrawOpen}
        onClose={() => setIsWithdrawOpen(false)}
        onSuccess={() => {
          toast.success('Withdrawal request submitted successfully');
          setRefreshKey(k => k + 1);
        }}
        minAmount={100}
        maxAmount={balance || 0}
      />
    </div>
  );
}
