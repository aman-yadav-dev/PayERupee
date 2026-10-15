"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  RefreshCw,
  Loader2,
  Copy,
  ShieldCheck,
  ArrowRight,
  Landmark,
  CircleDollarSign,
  Wallet,
  Lock,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminDrawer } from "@/components/admin/AdminDrawer";

interface LedgerSummary {
  systemTransitCount: number;
  systemRevenueCount: number;
  totalMerchantLiability: number;
  totalMerchantLocked: number;
  activeMerchantWallets: number;
}

interface LedgerAccountInfo {
  id: string;
  type: string;
  currency: string;
  merchantProfileId: string | null;
}

interface LedgerEntryItem {
  id: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number | string;
  currency: string;
  purpose: string;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: string;
  debitAccount?: LedgerAccountInfo | null;
  creditAccount?: LedgerAccountInfo | null;
}

export default function AdminLedgerPage() {
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [entries, setEntries] = useState<LedgerEntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purposeFilter, setPurposeFilter] = useState("ALL");
  const [refTypeFilter, setRefTypeFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntryItem | null>(null);

  const fetchLedger = (
    p = page,
    limit = pageSize,
    purpose = purposeFilter,
    referenceType = refTypeFilter
  ) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", p.toString());
    params.set("limit", limit.toString());
    if (purpose !== "ALL") params.set("purpose", purpose);
    if (referenceType !== "ALL") params.set("referenceType", referenceType);

    fetch(`/api/v1/admin/ledger?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setSummary(json.data.summary);
          setEntries(json.data.entries || []);
          setTotalPages(json.meta?.totalPages || 1);
          setTotalEntries(json.meta?.total || 0);
        }
      })
      .catch(() => {
        toast.error("Failed to fetch ledger postings");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", pageSize.toString());
    if (purposeFilter !== "ALL") params.set("purpose", purposeFilter);
    if (refTypeFilter !== "ALL") params.set("referenceType", refTypeFilter);

    fetch(`/api/v1/admin/ledger?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (mounted && json.success) {
          setSummary(json.data.summary);
          setEntries(json.data.entries || []);
          setTotalPages(json.meta?.totalPages || 1);
          setTotalEntries(json.meta?.total || 0);
        }
      })
      .catch(() => {
        if (mounted) toast.error("Failed to fetch ledger postings");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [page, pageSize, purposeFilter, refTypeFilter]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getPurposeBadge = (purpose: string) => {
    switch (purpose) {
      case "PRINCIPAL":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700">Principal</span>;
      case "FEE_AND_TAX":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">Fee & Tax</span>;
      case "REVERSAL_PRINCIPAL":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700">Reversal Principal</span>;
      case "REVERSAL_FEE_AND_TAX":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-50 text-orange-700">Reversal Fee</span>;
      case "MANUAL_ADJUSTMENT":
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700">Manual Adj.</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-canvas text-text-muted">{purpose}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h2 className="text-[22px] font-semibold font-display text-text-primary tracking-tight flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <span>Double-Entry General Ledger</span>
          </h2>
          <p className="text-[13px] text-text-muted mt-0.5">
            Cryptographically audited balanced debit and credit entries with exact fund transit reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Invariants: Σ Debits = Σ Credits</span>
          </div>

          <button
            onClick={() => fetchLedger(page, pageSize, purposeFilter, refTypeFilter)}
            disabled={loading}
            className="p-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary hover:bg-canvas transition-colors disabled:opacity-50 press-feedback"
            title="Refresh Ledger"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] lift-on-hover space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-text-secondary">Merchant Liability</span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="font-display tabular-nums text-[24px] font-semibold text-text-primary mt-1">
            {formatINR(summary?.totalMerchantLiability || 0)}
          </div>
          <div className="text-[12px] text-text-muted">Available merchant balances</div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] lift-on-hover space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-text-secondary">Transit Locked Balance</span>
            <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Lock className="h-4 w-4" />
            </div>
          </div>
          <div className="font-display tabular-nums text-[24px] font-semibold text-text-primary mt-1">
            {formatINR(summary?.totalMerchantLocked || 0)}
          </div>
          <div className="text-[12px] text-text-muted">In-flight payout & withdrawal reserves</div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] lift-on-hover space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-text-secondary">System Clearing Accounts</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <div className="font-display tabular-nums text-[24px] font-semibold text-text-primary mt-1">
            {summary?.systemTransitCount || 0}
          </div>
          <div className="text-[12px] text-text-muted">Transit & settlement accounts</div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] lift-on-hover space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-text-secondary">Active Merchant Wallets</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CircleDollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="font-display tabular-nums text-[24px] font-semibold text-text-primary mt-1">
            {summary?.activeMerchantWallets || 0}
          </div>
          <div className="text-[12px] text-text-muted">Live ledger-mapped wallets</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3">
        {/* Purpose Filter */}
        <div className="overflow-x-auto table-scrollbar max-w-full py-0.5">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-canvas border border-line text-xs font-medium w-max">
            {["ALL", "PRINCIPAL", "FEE_AND_TAX", "REVERSAL_PRINCIPAL", "REVERSAL_FEE_AND_TAX", "MANUAL_ADJUSTMENT"].map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPurposeFilter(p);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  purposeFilter === p
                    ? "bg-surface text-text-primary shadow-sm font-semibold"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {p === "ALL" ? "All Purposes" : p.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Reference Type Filter + Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="overflow-x-auto table-scrollbar max-w-full py-0.5">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-canvas border border-line text-xs font-medium w-max">
              {["ALL", "PAYOUT", "WITHDRAWAL", "FUND_REQUEST", "SYSTEM"].map((rt) => (
                <button
                  key={rt}
                  onClick={() => {
                    setRefTypeFilter(rt);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                    refTypeFilter === rt
                      ? "bg-surface text-text-primary shadow-sm font-semibold"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {rt === "ALL" ? "All References" : rt.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-text-muted font-medium shrink-0">
            Total: <span className="text-text-primary font-semibold">{totalEntries}</span> postings
          </div>
        </div>
      </div>

      {/* Entries Table Card */}
      <div className="rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted text-xs">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span>Loading ledger postings...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-20 text-center text-text-muted text-xs">
            No ledger journal entries found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto table-scrollbar">
            <table className="w-full min-w-[960px] text-left text-[13px] border-collapse">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  <th className="py-3 px-4">Posting ID</th>
                  <th className="py-3 px-4">Purpose</th>
                  <th className="py-3 px-4">Debit Account</th>
                  <th className="py-3 px-4 text-center">Flow</th>
                  <th className="py-3 px-4">Credit Account</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Posted Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="hover:bg-canvas/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono text-[12px] text-text-primary flex items-center gap-1.5">
                      <span>{entry.id.slice(0, 10)}...</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(entry.id, "Posting ID");
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-blue-600 transition-opacity"
                        title="Copy Posting ID"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </td>
                    <td className="py-3.5 px-4">{getPurposeBadge(entry.purpose)}</td>
                    <td className="py-3.5 px-4">
                      <div className="text-coral-600 font-medium text-[12px]">
                        {entry.debitAccount?.type || "SYSTEM_TRANSIT"}
                      </div>
                      <div className="text-[11px] text-text-muted font-mono">
                        {entry.debitAccount?.merchantProfileId
                          ? `Merchant: ${entry.debitAccount.merchantProfileId.slice(0, 8)}...`
                          : "System Clearing"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center text-text-muted">
                      <ArrowRight className="h-3.5 w-3.5 mx-auto text-blue-600" />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-emerald-600 font-medium text-[12px]">
                        {entry.creditAccount?.type || "SYSTEM_TRANSIT"}
                      </div>
                      <div className="text-[11px] text-text-muted font-mono">
                        {entry.creditAccount?.merchantProfileId
                          ? `Merchant: ${entry.creditAccount.merchantProfileId.slice(0, 8)}...`
                          : "System Clearing"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-text-primary tabular-nums">
                      {formatINR(Number(entry.amount))}
                    </td>
                    <td className="py-3.5 px-4 text-text-muted text-[12px] whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEntry(entry);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-line bg-surface hover:bg-canvas text-text-secondary text-xs font-medium transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination
          page={page}
          totalPages={totalPages}
          totalCount={totalEntries}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setPage(1);
          }}
          itemName="journal entries"
          disabled={loading}
        />
      </div>

      {/* Posting Details Drawer via Portal */}
      <AdminDrawer
        isOpen={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        title="Journal Entry Posting"
        subtitle={
          selectedEntry ? (
            <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-text-muted">
              <span className="truncate">ID: {selectedEntry.id}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(selectedEntry.id);
                  toast.success("Posting ID copied to clipboard");
                }}
                className="hover:text-blue-600 transition-colors p-0.5 shrink-0"
                title="Copy Posting ID"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          ) : undefined
        }
        badge={selectedEntry ? getPurposeBadge(selectedEntry.purpose) : null}
        footer={
          <button
            type="button"
            onClick={() => setSelectedEntry(null)}
            className="px-4 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
          >
            Close Journal
          </button>
        }
      >
        {selectedEntry && (
          <div className="space-y-6">
            {/* Amount Banner */}
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-canvas border border-line-soft">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Posted Amount</span>
                <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-surface border border-line-soft text-blue-600">
                  {selectedEntry.currency || "INR"}
                </span>
              </div>
              <div className="text-3xl font-semibold text-text-primary tracking-tight tabular-nums font-display">
                {formatINR(Number(selectedEntry.amount))}
              </div>
            </div>

            {/* Debit vs Credit Flow */}
            <section>
              <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                Transfer Movement
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-surface border border-line-soft space-y-1 shadow-sm">
                  <span className="text-[11px] font-semibold text-coral-600 uppercase">Debited Account</span>
                  <div className="font-semibold text-text-primary text-[13.5px]">
                    {selectedEntry.debitAccount?.type || "SYSTEM_TRANSIT"}
                  </div>
                  <div className="text-[11.5px] text-text-muted font-mono truncate">
                    {selectedEntry.debitAccountId}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface border border-line-soft space-y-1 shadow-sm">
                  <span className="text-[11px] font-semibold text-emerald-600 uppercase">Credited Account</span>
                  <div className="font-semibold text-text-primary text-[13.5px]">
                    {selectedEntry.creditAccount?.type || "SYSTEM_TRANSIT"}
                  </div>
                  <div className="text-[11.5px] text-text-muted font-mono truncate">
                    {selectedEntry.creditAccountId}
                  </div>
                </div>
              </div>
            </section>

            {/* Reference Information */}
            <section>
              <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                Business Entity Reference
              </h4>
              <div className="bg-surface rounded-xl border border-line-soft overflow-hidden divide-y divide-line-soft shadow-sm">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-text-secondary">Reference Type</span>
                  <span className="text-[13px] font-medium text-text-primary">{selectedEntry.referenceType || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-text-secondary">Reference ID</span>
                  <div className="flex items-center gap-1.5 font-mono text-[12.5px] text-text-primary">
                    <span className="truncate max-w-[260px]">{selectedEntry.referenceId || "N/A"}</span>
                    {selectedEntry.referenceId && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedEntry.referenceId!);
                          toast.success("Reference ID copied to clipboard");
                        }}
                        className="hover:text-blue-600 transition-colors p-0.5 shrink-0 text-text-muted"
                        title="Copy Reference ID"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-text-secondary">Recorded Timestamp</span>
                  <span className="text-[13px] text-text-primary">
                    {new Date(selectedEntry.createdAt).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </section>
          </div>
        )}
      </AdminDrawer>
    </div>
  );
}
