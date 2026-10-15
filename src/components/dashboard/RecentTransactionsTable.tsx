"use client";

import { useEffect, useState } from "react";
import { formatDateIST, formatDateTimeIST } from "@/lib/date";
import { formatINR } from "@/lib/utils";
import { StatusPill } from "./StatusPill";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useDashboardFilters, buildFilterSearchParams } from "./useDashboardFilters";

interface ApiPayout {
  id: string;
  accountHolderName: string;
  paymentMode: string;
  status: string;
  createdAt: string;
  amount: string | number;
}

export function RecentTransactionsTable() {
  const [data, setData] = useState<ApiPayout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filters = useDashboardFilters();

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      setIsLoading(true);

      if (filters.status === "Validation failed") {
        setData([]);
        setError(null);
        setIsLoading(false);
        return;
      }

      try {
        const params = buildFilterSearchParams(filters);
        params.set("limit", "7");
        params.set("page", "1");
        const url = `/api/v1/merchant/payouts?${params.toString()}`;

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error("Failed to load transactions");
        }
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          if (mounted) {
            setData(json.data);
            setError(null);
          }
        } else {
          throw new Error("Invalid data format");
        }
      } catch (err) {
        if (mounted) {
          setError("Failed to load recent transactions.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }
    fetchData();
    return () => {
      mounted = false;
    };
  }, [filters]);

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

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between px-5 pt-5 pb-1">
        <div>
          <h3 className="font-display text-[15px] font-medium text-text-primary">
            Recent transactions
          </h3>
          <p className="text-[12px] text-text-muted mt-0.5">
            Latest activity across all vendors
          </p>
        </div>
        <Link
          href="/transactions"
          className="flex items-center gap-1 text-[12.5px] font-medium text-blue-600 hover:text-blue-700 transition-colors press-feedback"
        >
          View all
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />
        </Link>
      </div>

      <div className="overflow-x-auto scroll-thin">
        <table className="w-full mt-3 text-[13px]">
          <thead>
            <tr className="text-left border-b border-line">
              <th className="font-medium text-text-muted text-[11.5px] px-5 pb-2.5">Vendor</th>
              <th className="font-medium text-text-muted text-[11.5px] px-3 pb-2.5">Transaction ID</th>
              <th className="font-medium text-text-muted text-[11.5px] px-3 pb-2.5">Status</th>
              <th className="font-medium text-text-muted text-[11.5px] px-3 pb-2.5">Time</th>
              <th className="font-medium text-text-muted text-[11.5px] px-5 pb-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skel-${i}`} className="border-b border-line-soft last:border-0">
                  <td className="px-5 py-3">
                    <div className="h-4 w-32 bg-line-soft rounded animate-pulse mb-1.5" />
                    <div className="h-3 w-20 bg-line-soft rounded animate-pulse" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-4 w-24 bg-line-soft rounded animate-pulse" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-6 w-20 bg-line-soft rounded-full animate-pulse" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="h-4 w-20 bg-line-soft rounded animate-pulse" />
                  </td>
                  <td className="px-5 py-3 flex justify-end">
                    <div className="h-4 w-20 bg-line-soft rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-[13px] font-medium text-red-500/80">
                  {error}
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-[13px] font-medium text-text-muted">
                  No recent transactions.
                </td>
              </tr>
            ) : (
              data.map((t, i) => {
                const amountNum = typeof t.amount === "string" ? parseFloat(t.amount) : t.amount;
                return (
                  <tr
                    key={t.id}
                    className="border-b border-line-soft last:border-0 hover:bg-canvas/60 transition-colors animate-fade-in"
                    style={{ animationDelay: `${1000 + i * 45}ms` }}
                  >
                    <td className="px-5 py-3 text-text-primary font-medium whitespace-nowrap">
                      {t.accountHolderName}
                      <div className="text-[11.5px] font-normal text-text-muted">{t.paymentMode}</div>
                    </td>
                    <td className="px-3 py-3 text-text-muted font-mono text-[11.5px] whitespace-nowrap">
                      {t.id.slice(0, 18)}…
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={
                        t.status === "SUCCESS" ? "completed" :
                        t.status === "PENDING" ? "pending" :
                        t.status === "PROCESSING" ? "processing" :
                        t.status === "FAILED" ? "failed" :
                        t.status === "REVERSED" ? "reversed" :
                        "unknown"
                      } />
                    </td>
                    <td className="px-3 py-3 text-text-muted whitespace-nowrap">
                      {formatDate(t.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-text-primary tabular-nums whitespace-nowrap">
                      {formatINR(amountNum)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
