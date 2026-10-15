"use client";

import React, { useEffect, useState } from "react";
import { formatINR } from "@/lib/utils";
import { Loader2, RefreshCw, ArrowDownToLine, Lock, CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminModal } from "@/components/admin/AdminModal";

type Withdrawal = {
  id: string;
  merchantProfileId: string;
  merchantProfile?: {
    businessName?: string;
    user?: {
      name?: string;
      email?: string;
    };
  };
  merchantBank?: {
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
  };
  amount: number;
  status: string;
  failureReason?: string | null;
  createdAt: string;
};

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Approval / Rejection states
  const [approvingTarget, setApprovingTarget] = useState<Withdrawal | null>(null);
  const [rejectingTarget, setRejectingTarget] = useState<Withdrawal | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchWithdrawals = async (
    targetPage = page,
    targetPageSize = pageSize,
    targetStatus = statusFilter
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (targetStatus !== "ALL") params.set("status", targetStatus);
      params.set("page", targetPage.toString());
      params.set("limit", targetPageSize.toString());

      const res = await fetch(`/api/v1/admin/withdrawals?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setWithdrawals(json.data || []);
        if (json.meta) {
          setTotalPages(json.meta.totalPages || 1);
          setTotalCount(json.meta.total || 0);
        }
      } else {
        toast.error("Failed to fetch withdrawals");
      }
    } catch {
      toast.error("Error connecting to administrative API");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!approvingTarget) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/withdrawals/${approvingTarget.id}/approve`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Withdrawal of ${formatINR(approvingTarget.amount)} approved successfully`);
        setApprovingTarget(null);
        fetchWithdrawals(page, pageSize, statusFilter);
      } else {
        toast.error(json.error || "Failed to approve withdrawal");
      }
    } catch {
      toast.error("Network error while approving withdrawal");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingTarget) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/withdrawals/${rejectingTarget.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Withdrawal rejected and funds refunded to merchant wallet");
        setRejectingTarget(null);
        setRejectionReason("");
        fetchWithdrawals(page, pageSize, statusFilter);
      } else {
        toast.error(json.error || "Failed to reject withdrawal");
      }
    } catch {
      toast.error("Network error while rejecting withdrawal");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    params.set("page", page.toString());
    params.set("limit", pageSize.toString());

    fetch(`/api/v1/admin/withdrawals?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (mounted && json.success) {
          setWithdrawals(json.data || []);
          if (json.meta) {
            setTotalPages(json.meta.totalPages || 1);
            setTotalCount(json.meta.total || 0);
          }
        }
      })
      .catch(() => {
        if (mounted) toast.error("Failed to fetch withdrawals");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [statusFilter, page, pageSize]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h2 className="text-[22px] font-semibold font-display text-text-primary tracking-tight flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-blue-600" />
            <span>Merchant Outbound Withdrawal Queue</span>
          </h2>
          <p className="text-[13px] text-text-muted mt-0.5">
            Monitor merchant bank account disbursement requests and transit ledger reserves.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-300 text-xs font-medium">
            <Lock className="h-3.5 w-3.5 text-amber-600" />
            <span>Outbound Disbursements: Dual-Control Policy Enforced</span>
          </div>

          <button
            onClick={() => fetchWithdrawals(page, pageSize, statusFilter)}
            disabled={loading}
            className="p-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary hover:bg-canvas transition-colors disabled:opacity-50 press-feedback"
            title="Refresh Withdrawals"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="overflow-x-auto table-scrollbar max-w-full py-0.5">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-canvas border border-line text-xs font-medium w-max">
          {["ALL", "PENDING", "APPROVED", "REJECTED", "REVERSED"].map((tab) => (
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

      {/* Table Container */}
      <div className="rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] overflow-hidden">
        <div className="overflow-x-auto table-scrollbar">
          <table className="w-full min-w-[800px] text-left text-[13px] border-collapse">
            <thead>
              <tr className="border-b border-line bg-canvas/60 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                <th className="py-3 px-4">Submission Date</th>
                <th className="py-3 px-4">Merchant Entity</th>
                <th className="py-3 px-4">Destination Bank</th>
                <th className="py-3 px-4">Disbursement Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-text-muted text-xs">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-600" />
                    <span>Loading withdrawal queue...</span>
                  </td>
                </tr>
              ) : withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-text-muted text-xs">
                    <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-600" />
                    <span>No withdrawal requests in queue.</span>
                  </td>
                </tr>
              ) : (
                withdrawals.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => {
                      if (req.status === "PENDING") {
                        setApprovingTarget(req);
                      }
                    }}
                    className={`hover:bg-canvas/50 transition-colors ${
                      req.status === "PENDING" ? "cursor-pointer group" : ""
                    }`}
                  >
                    <td className="py-3.5 px-4 text-text-muted text-[12px]">
                      {new Date(req.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-text-primary">
                      {req.merchantProfile?.businessName || req.merchantProfile?.user?.name || req.merchantProfileId}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-text-primary">
                        {req.merchantBank?.accountHolderName || "Unassigned Bank Account"}
                      </div>
                      <div className="text-text-muted text-[11.5px] font-mono">
                        {req.merchantBank?.accountNumber
                          ? `•••• •••• ${req.merchantBank.accountNumber.slice(-4)}`
                          : "Account unlinked"}{" "}
                        ({req.merchantBank?.ifscCode || "IFSC unavailable"})
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-text-primary tabular-nums">
                      {formatINR(req.amount)}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusPill status={req.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {req.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRejectingTarget(req);
                              setRejectionReason("");
                            }}
                            className="px-2.5 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 text-[11px] font-medium transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setApprovingTarget(req);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-[11px] font-medium transition-colors shadow-sm"
                          >
                            Approve
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-text-muted">
                          {req.status === "SUCCESS" || req.status === "APPROVED"
                            ? "Settled"
                            : req.status === "FAILED" || req.status === "REJECTED"
                            ? "Refunded"
                            : "Resolved"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
          itemName="withdrawals"
          disabled={loading}
        />
      </div>

      {/* Approve Modal */}
      <AdminModal
        isOpen={!!approvingTarget}
        onClose={() => setApprovingTarget(null)}
        title="Approve Withdrawal Request"
        description="Verify destination bank account and release settlement disbursement."
        icon={ArrowDownToLine}
        iconClassName="text-blue-600 bg-blue-50 dark:bg-blue-950/40"
      >
        {approvingTarget && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-canvas border border-line-soft space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Merchant:</span>
                <span className="text-text-primary font-medium">
                  {approvingTarget.merchantProfile?.businessName || approvingTarget.merchantProfile?.user?.name || approvingTarget.merchantProfileId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Disbursement Amount:</span>
                <span className="text-blue-600 font-semibold text-sm tabular-nums">{formatINR(approvingTarget.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Account Holder:</span>
                <span className="text-text-primary font-medium">{approvingTarget.merchantBank?.accountHolderName || "Unassigned"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Bank Account:</span>
                <span className="text-text-primary font-mono">
                  {approvingTarget.merchantBank?.accountNumber ? `•••• ${approvingTarget.merchantBank.accountNumber.slice(-4)}` : "Unlinked"} ({approvingTarget.merchantBank?.ifscCode || "IFSC missing"})
                </span>
              </div>
            </div>

            <p className="text-xs text-text-muted">
              Funds were reserved from the merchant wallet at initiation. Approving will settle this withdrawal permanently.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-line-soft">
              <button
                type="button"
                onClick={() => setApprovingTarget(null)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold shadow-sm disabled:opacity-50 press-feedback"
              >
                {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                <span>Confirm & Approve Withdrawal</span>
              </button>
            </div>
          </div>
        )}
      </AdminModal>

      {/* Reject Modal */}
      <AdminModal
        isOpen={!!rejectingTarget}
        onClose={() => {
          setRejectingTarget(null);
          setRejectionReason("");
        }}
        title="Reject Withdrawal Request"
        description="Decline this withdrawal request. Reserved funds will be immediately refunded to the merchant&apos;s wallet balance."
        icon={ShieldAlert}
        iconClassName="text-red-600 bg-red-50 dark:bg-red-950/40"
      >
        {rejectingTarget && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-canvas border border-line-soft text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-text-muted">Withdrawal Amount:</span>
                <span className="font-semibold text-text-primary tabular-nums">{formatINR(rejectingTarget.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Account Holder:</span>
                <span className="font-mono text-text-primary">{rejectingTarget.merchantBank?.accountHolderName || "Unassigned"}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-text-primary">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Bank details unverified, destination account invalid, compliance hold, etc."
                rows={3}
                className="w-full text-xs rounded-xl border border-line bg-canvas p-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-blue-600 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-line-soft">
              <button
                type="button"
                onClick={() => {
                  setRejectingTarget(null);
                  setRejectionReason("");
                }}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-xs font-semibold shadow-sm disabled:opacity-50 press-feedback"
              >
                {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>Reject & Refund Balance</span>
              </button>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
