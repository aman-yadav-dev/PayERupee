"use client";

import { useState, useEffect } from "react";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { formatDateIST, formatDateTimeIST } from "@/lib/date";
import { formatINR } from "@/lib/utils";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { useDashboardFilters } from "@/components/dashboard/useDashboardFilters";
import { useTransactions, ApiTransaction } from "@/components/dashboard/useTransactions";
import Link from "next/link";

import { TransactionsDetailDrawer } from "@/components/merchant/TransactionsDetailDrawer";

export function TransactionsDashboard() {
  const [page, setPage] = useState(1);
  const filters = useDashboardFilters();
  useEffect(() => { setPage(1); }, [filters]);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  
  const { data: response, isLoading, isError, error } = useTransactions(page, 20);

  const transactions: ApiTransaction[] = response?.data || [];
  const pagination = response?.pagination;
  const totalPages = pagination?.totalPages || 1;

  const formatDate = (d: string) => formatDateTimeIST(d);

  return (
    <>
      <TransactionsDetailDrawer 
        transactionId={selectedTxId} 
        onClose={() => setSelectedTxId(null)}
        transactions={transactions}
        onNavigate={setSelectedTxId}
      />
      <div className="px-4 sm:px-5 lg:px-8 py-6 space-y-6 w-full max-w-[1440px] mx-auto animate-fade-in relative">

      <div>
        <h1 className="font-display text-2xl font-semibold text-text-primary tracking-tight">Transactions</h1>
        <p className="text-[14px] text-text-muted mt-1">
          Review and manage your business transactions.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-500/25 bg-blue-50/70 px-4 py-3">
        <p className="text-[13px] text-gray-800 leading-relaxed">
          <span className="font-medium">Running Balances Omitted:</span> Transaction records do not store historical running balances. Please check your Wallet for the current live balance.
        </p>
      </div>

      <FilterBar 
        showType={false} 
        showSearch={true}
        showPaymentMode={true}
        exportEndpoint="/api/v1/merchant/transactions/export" 
      />

      <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden relative flex flex-col min-h-[400px]">
        
        {isError && (
          <div className="p-8 text-center text-red-500">
            Failed to load transactions: {error instanceof Error ? error.message : "Unknown error"}
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line bg-surface-hover/30">
                <th className="px-5 py-3 text-[12px] font-medium text-text-muted uppercase tracking-wider">Transaction ID</th>
                <th className="px-5 py-3 text-[12px] font-medium text-text-muted uppercase tracking-wider">Date & Time</th>
                <th className="px-5 py-3 text-[12px] font-medium text-text-muted uppercase tracking-wider">Destination</th>
                <th className="px-5 py-3 text-[12px] font-medium text-text-muted uppercase tracking-wider">Mode</th>
                <th className="px-5 py-3 text-[12px] font-medium text-text-muted uppercase tracking-wider text-right">Amount</th>
                <th className="px-5 py-3 text-[12px] font-medium text-text-muted uppercase tracking-wider text-right pr-2">Status</th><th className="pr-5 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 bg-line-soft rounded w-3/4"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-line-soft rounded w-1/2"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-line-soft rounded w-2/3"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-line-soft rounded w-1/3"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-line-soft rounded w-1/2 ml-auto"></div></td>
                      <td className="px-5 py-4"><div className="h-6 bg-line-soft rounded-full w-20"></div></td>
                    </tr>
                  ))
                ) : !isError && transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-text-muted">
                      <p className="text-[14px] font-medium text-text-primary">No transactions found</p>
                      <p className="text-[13px] mt-1 max-w-sm">
                        Try adjusting your filters to see more results.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
              {transactions.map((tx, i) => (
                <tr 
                  key={tx.id} 
                  onClick={() => setSelectedTxId(tx.id)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedTxId(tx.id)}
                  className="border-b border-line-soft last:border-0 hover:bg-canvas/60 transition-colors animate-fade-in cursor-pointer focus:outline-none focus:bg-canvas/60 group"
                  style={{ animationDelay: String(100 + i * 45) + 'ms' }}
                >
                  <td className="px-5 py-3 text-text-primary font-medium whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                      <span className="truncate max-w-[150px]" title={tx.id}>{tx.id}</span>
                    </div>
                    {tx.reference !== tx.id && (
                      <div className="text-[11.5px] font-normal text-text-muted mt-0.5 ml-6 truncate max-w-[150px]">Ref: {tx.reference}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-text-muted whitespace-nowrap">
                    {formatDate(tx.createdAt)}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-text-muted whitespace-nowrap">
                    <div className="font-medium text-text-primary">{tx.destination.accountName}</div>
                    <div className="text-[11.5px] mt-0.5">
                      {tx.paymentMode === 'UPI' 
                        ? tx.destination.vpa 
                        : `${tx.destination.accountNumber} (${tx.destination.ifscCode})`}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-text-muted whitespace-nowrap">
                    {tx.paymentMode}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-right">
                    <div className="text-[14px] font-medium text-text-primary">
                      {formatINR(Number(tx.amount))}
                    </div>
                    {(parseFloat(tx.fee) > 0 || parseFloat(tx.tax) > 0) && (
                      <div className="text-[11.5px] text-text-muted mt-0.5">Charges: {formatINR(Number(tx.fee || 0) + Number(tx.tax || 0))}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap text-right pr-2">
                    <StatusPill status={tx.status as any} />
                  </td>
                  <td className="pr-5 py-3 whitespace-nowrap text-right">
                    <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && !isError && totalPages > 1 && (
          <div className="px-5 py-4 border-t border-line flex items-center justify-between bg-surface mt-auto">
            <p className="text-[13px] text-text-muted">
              Page <span className="font-medium text-text-primary">{page}</span> of <span className="font-medium text-text-primary">{totalPages}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 px-3 rounded-lg border border-line bg-surface text-[13px] font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 press-feedback"
              >
                <ArrowLeft className="w-4 h-4" />
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-8 px-3 rounded-lg border border-line bg-surface text-[13px] font-medium text-text-primary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 press-feedback"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
