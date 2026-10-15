"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ArrowLeftRight,
  Search,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  ShieldCheck,
  Copy,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminDrawer } from "@/components/admin/AdminDrawer";

interface PayoutItem {
  id: string;
  merchantProfileId: string;
  merchantProfile?: {
    businessName: string | null;
    user?: {
      email: string;
      name: string | null;
    } | null;
  } | null;
  amount: number | string;
  fee: number | string;
  totalDebitAmount: number | string;
  paymentMode: string;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED" | "CANCELLED" | "QUEUED";
  accountNumber: string | null;
  ifscCode: string | null;
  vpa: string | null;
  maskedDestination: string;
  accountHolderName: string | null;
  providerId: string | null;
  providerReferenceId: string | null;
  utrNumber: string | null;
  failureReason: string | null;
  failureCode: string | null;
  createdAt: string;
  processedAt: string | null;
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedPayout, setSelectedPayout] = useState<PayoutItem | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", pageSize.toString());
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (appliedSearch.trim()) params.set("search", appliedSearch.trim());

    fetch(`/api/v1/admin/payouts?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (mounted && json.success) {
          setPayouts(json.data || []);
          setTotalPages(json.meta?.totalPages || 1);
          setTotalCount(json.meta?.total || 0);
        } else if (mounted) {
          toast.error("Failed to load payouts");
        }
      })
      .catch(() => {
        if (mounted) toast.error("Failed to fetch payouts");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [page, pageSize, statusFilter, appliedSearch, refreshIndex]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      setPage(1);
      setAppliedSearch(search.trim());
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h2 className="text-[22px] font-semibold font-display text-text-primary tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-blue-600" />
            <span>Global Payouts & Disbursement Telemetry</span>
          </h2>
          <p className="text-[13px] text-text-muted mt-0.5">
            Real-time multi-merchant transaction settlement stream, provider references, and failure diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search reference, UTR, or ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value === "") {
                  setAppliedSearch("");
                  setPage(1);
                }
              }}
              className="h-9 w-64 rounded-xl border border-line bg-surface pl-10 pr-4 text-xs text-text-primary placeholder:text-text-muted focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </form>

          <button
            onClick={() => {
              setRefreshIndex((prev) => prev + 1);
            }}
            disabled={loading}
            className="p-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary hover:bg-canvas transition-colors disabled:opacity-50 press-feedback"
            title="Refresh Telemetry"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-full">
        <div className="overflow-x-auto table-scrollbar max-w-full py-0.5">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-canvas border border-line text-xs font-medium w-max">
            {["ALL", "SUCCESS", "PENDING", "PROCESSING", "FAILED", "REVERSED"].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setStatusFilter(tab);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  statusFilter === tab
                    ? "bg-surface text-text-primary shadow-sm font-semibold"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-text-muted font-medium shrink-0">
          Total: <span className="text-text-primary font-semibold">{totalCount}</span> payouts
        </div>
      </div>

      {/* Payouts Table Card */}
      <div className="rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted text-xs">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span>Loading payout records...</span>
          </div>
        ) : payouts.length === 0 ? (
          <div className="py-20 text-center text-text-muted text-xs">
            No payouts found matching your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto table-scrollbar">
            <table className="w-full min-w-[880px] text-left text-[13px] border-collapse">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  <th className="py-3 px-4">Initiated</th>
                  <th className="py-3 px-4">Merchant Entity</th>
                  <th className="py-3 px-4">Beneficiary</th>
                  <th className="py-3 px-4">Destination</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Diagnostics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payouts.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPayout(p)}
                    className="hover:bg-canvas/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 text-text-muted text-[12px]">
                      {new Date(p.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-text-primary">
                      <div>{p.merchantProfile?.businessName || "Merchant"}</div>
                      <div className="text-[11.5px] text-text-muted">
                        {p.merchantProfile?.user?.email}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-text-primary">
                      {p.accountHolderName || "—"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[12px] text-blue-600 font-medium">
                      {p.maskedDestination}
                    </td>
                    <td className="py-3.5 px-4 text-text-secondary text-[12px]">
                      {p.paymentMode}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-text-primary tabular-nums">
                      {formatINR(Number(p.amount))}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusPill status={p.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPayout(p);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-surface text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-xs font-medium transition-colors press-feedback shadow-sm"
                      >
                        <span>Telemetry</span>
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
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setPage(1);
          }}
          itemName="payouts"
          disabled={loading}
        />
      </div>

      {/* Diagnostics Drawer via Portal */}
      <AdminDrawer
        isOpen={!!selectedPayout}
        onClose={() => setSelectedPayout(null)}
        title="Disbursement Telemetry"
        subtitle={
          selectedPayout ? (
            <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-text-muted">
              <span className="truncate">ID: {selectedPayout.id}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(selectedPayout.id);
                  toast.success("Payout ID copied to clipboard");
                }}
                className="hover:text-blue-600 transition-colors p-0.5 shrink-0"
                title="Copy Payout ID"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          ) : undefined
        }
        badge={selectedPayout ? <StatusPill status={selectedPayout.status} /> : null}
        footer={
          <button
            type="button"
            onClick={() => setSelectedPayout(null)}
            className="px-4 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
          >
            Close Telemetry
          </button>
        }
      >
        {selectedPayout && (
          <div className="space-y-6">
            {/* Status & Amount Banner */}
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-canvas border border-line-soft">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">Net Disbursement</span>
                <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-surface border border-line-soft text-text-secondary">
                  {selectedPayout.paymentMode}
                </span>
              </div>
              <div className="text-3xl font-semibold text-text-primary tracking-tight tabular-nums font-display">
                {formatINR(Number(selectedPayout.amount))}
              </div>
              <div className="text-[13px] text-text-secondary">
                Total Debited: <span className="font-semibold text-text-primary tabular-nums">{formatINR(Number(selectedPayout.totalDebitAmount))}</span>
                {Number(selectedPayout.fee) > 0 && <span className="text-text-muted"> (fee: {formatINR(Number(selectedPayout.fee))})</span>}
              </div>
            </div>

            {/* Failure Diagnostics if Failed */}
            {selectedPayout.status === "FAILED" && (
              <div className="p-4 rounded-xl bg-red-50/80 border border-red-200 dark:bg-red-950/30 dark:border-red-900/40 space-y-2">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-[13px]">
                  <XCircle className="h-4 w-4 shrink-0" />
                  <span>Provider Failure Diagnostic</span>
                </div>
                {selectedPayout.failureCode && (
                  <div className="font-mono text-[11px] text-red-700 dark:text-red-300 bg-white/60 dark:bg-black/20 p-2 rounded-lg border border-red-200 dark:border-red-900/30">
                    Error Code: <span className="font-bold">{selectedPayout.failureCode}</span>
                  </div>
                )}
                <div className="text-red-800 dark:text-red-200 text-xs leading-relaxed">
                  {selectedPayout.failureReason || "No detailed error message returned by upstream provider."}
                </div>
              </div>
            )}

            {/* Settlement Confirmation if Success */}
            {selectedPayout.status === "SUCCESS" && (
              <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/40 space-y-1">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-[13px]">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Settlement Confirmed</span>
                </div>
                <div className="text-emerald-800 dark:text-emerald-200 font-mono text-xs">
                  Bank UTR: <span className="font-bold">{selectedPayout.utrNumber || "Verified"}</span>
                </div>
              </div>
            )}

            {/* Merchant Details */}
            <section>
              <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                <span>Merchant Information</span>
              </h4>
              <div className="bg-surface rounded-xl border border-line-soft overflow-hidden divide-y divide-line-soft shadow-sm">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-text-secondary">Business</span>
                  <span className="text-[13px] font-medium text-text-primary">
                    {selectedPayout.merchantProfile?.businessName || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-text-secondary">Merchant User</span>
                  <span className="text-[13px] text-text-primary">
                    {selectedPayout.merchantProfile?.user?.email || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-text-secondary">Profile ID</span>
                  <span className="text-text-muted font-mono text-[11.5px] truncate max-w-[280px]">
                    {selectedPayout.merchantProfileId}
                  </span>
                </div>
              </div>
            </section>

            {/* Destination Metadata */}
            <section>
              <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                <span>Destination Metadata</span>
              </h4>
              <div className="bg-surface rounded-xl border border-line-soft overflow-hidden divide-y divide-line-soft shadow-sm">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-text-secondary">Payment Mode</span>
                  <span className="text-[13px] font-medium text-text-primary">{selectedPayout.paymentMode}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-text-secondary">Beneficiary</span>
                  <span className="text-[13px] font-medium text-text-primary">{selectedPayout.accountHolderName || "—"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-text-secondary">Masked Destination</span>
                  <span className="text-blue-600 font-mono font-semibold text-[13px]">{selectedPayout.maskedDestination}</span>
                </div>
                {selectedPayout.ifscCode && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[13px] text-text-secondary">IFSC Code</span>
                    <span className="text-text-primary font-mono text-[13px]">{selectedPayout.ifscCode}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Provider & Lifecycle */}
            <section>
              <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                <span>Provider & Timestamps</span>
              </h4>
              <div className="bg-surface rounded-xl border border-line-soft overflow-hidden divide-y divide-line-soft shadow-sm">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-text-secondary">Provider</span>
                  <span className="text-[13px] font-medium text-text-primary">{selectedPayout.providerId || "PRIMARY_ROUTING"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-text-secondary">Provider Ref</span>
                  <span className="text-text-primary font-mono text-[12.5px]">{selectedPayout.providerReferenceId || "—"}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-[13px] text-text-secondary">Initiated</span>
                  <span className="text-[13px] text-text-primary">
                    {new Date(selectedPayout.createdAt).toLocaleString("en-IN")}
                  </span>
                </div>
                {selectedPayout.processedAt && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-[13px] text-text-secondary">Processed</span>
                    <span className="text-[13px] text-text-primary">
                      {new Date(selectedPayout.processedAt).toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </AdminDrawer>
    </div>
  );
}
