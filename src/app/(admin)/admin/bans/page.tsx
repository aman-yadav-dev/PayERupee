"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  Check,
  X,
  RefreshCw,
  Loader2,
  Smartphone,
  Landmark,
  AlertTriangle,
  Trash2,
  Search,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeIST } from "@/lib/date";
import { cn } from "@/lib/utils";
import { AdminModal } from "@/components/admin/AdminModal";

export type DestinationType = "UPI" | "BANK_ACCOUNT";
export type BanRequestStatus = "PENDING" | "APPROVED" | "REJECTED";
export type GlobalBanStatus = "ACTIVE" | "REMOVED";

export interface AdminBanRequestItem {
  id: string;
  merchantProfileId: string;
  merchantProfile?: {
    id?: string;
    businessName?: string;
    user?: {
      name?: string;
      email?: string;
    };
  };
  destinationType: DestinationType;
  maskedDestination: string;
  reason: string;
  status: BanRequestStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  rejectionReason?: string | null;
}

export interface AdminGlobalBanItem {
  id: string;
  approvedById: string;
  removedById?: string | null;
  sourceRequestId?: string | null;
  destinationType: DestinationType;
  maskedDestination: string;
  reason: string;
  status: GlobalBanStatus;
  createdAt: string;
  updatedAt: string;
  removedAt?: string | null;
  removalReason?: string | null;
}

export default function AdminBansPage() {
  const [activeTab, setActiveTab] = useState<"pending" | "active">("pending");
  const [accessDenied, setAccessDenied] = useState<boolean>(false);

  // Requests state
  const [requests, setRequests] = useState<AdminBanRequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState<boolean>(true);
  const [requestSearch, setRequestSearch] = useState<string>("");

  // Global bans state
  const [globalBans, setGlobalBans] = useState<AdminGlobalBanItem[]>([]);
  const [loadingBans, setLoadingBans] = useState<boolean>(true);
  const [banSearch, setBanSearch] = useState<string>("");

  // Action states / Modals
  const [approvingTarget, setApprovingTarget] = useState<AdminBanRequestItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [processingApprove, setProcessingApprove] = useState<boolean>(false);

  const [rejectingTarget, setRejectingTarget] = useState<AdminBanRequestItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [processingReject, setProcessingReject] = useState<boolean>(false);

  const [removingTarget, setRemovingTarget] = useState<AdminGlobalBanItem | null>(null);
  const [removalReason, setRemovalReason] = useState<string>("");
  const [processingRemove, setProcessingRemove] = useState<boolean>(false);

  // Fetch pending requests
  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch("/api/v1/admin/bans/requests");
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
      const json = await res.json();
      if (res.ok && json.success) {
        setAccessDenied(false);
        setRequests(json.data || []);
      } else if (Array.isArray(json)) {
        setAccessDenied(false);
        setRequests(json);
      } else if (json.data && Array.isArray(json.data)) {
        setAccessDenied(false);
        setRequests(json.data);
      } else {
        toast.error(json.error || "Failed to fetch ban requests");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to fetch ban requests";
      toast.error(message);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Fetch active global bans
  const fetchGlobalBans = async () => {
    setLoadingBans(true);
    try {
      const res = await fetch("/api/v1/admin/bans");
      if (res.status === 403) {
        setAccessDenied(true);
        return;
      }
      const json = await res.json();
      if (res.ok && json.success) {
        setAccessDenied(false);
        setGlobalBans(json.data || []);
      } else if (Array.isArray(json)) {
        setAccessDenied(false);
        setGlobalBans(json);
      } else if (json.data && Array.isArray(json.data)) {
        setAccessDenied(false);
        setGlobalBans(json.data);
      } else {
        toast.error(json.error || "Failed to fetch global bans");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to fetch global bans";
      toast.error(message);
    } finally {
      setLoadingBans(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const init = async () => {
      try {
        const [reqRes, banRes] = await Promise.all([
          fetch("/api/v1/admin/bans/requests"),
          fetch("/api/v1/admin/bans"),
        ]);
        if (ignore) return;
        if (reqRes.status === 403 || banRes.status === 403) {
          setAccessDenied(true);
          return;
        }
        const reqJson = await reqRes.json().catch(() => null);
        const banJson = await banRes.json().catch(() => null);
        if (reqJson?.success) {
          setAccessDenied(false);
          setRequests(reqJson.data || []);
        }
        if (banJson?.success) {
          setAccessDenied(false);
          setGlobalBans(banJson.data || []);
        }
      } finally {
        if (!ignore) {
          setLoadingRequests(false);
          setLoadingBans(false);
        }
      }
    };
    init();
    return () => {
      ignore = true;
    };
  }, []);

  const handleRefresh = () => {
    if (activeTab === "pending") {
      fetchRequests();
    } else {
      fetchGlobalBans();
    }
  };

  // Filter requests (only pending for this tab or match search)
  const pendingRequests = requests.filter((r) => r.status === "PENDING" || !r.status);
  const filteredRequests = pendingRequests.filter((r) => {
    const q = requestSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      r.maskedDestination.toLowerCase().includes(q) ||
      r.reason.toLowerCase().includes(q) ||
      r.merchantProfileId.toLowerCase().includes(q) ||
      (r.merchantProfile?.businessName && r.merchantProfile.businessName.toLowerCase().includes(q))
    );
  });

  // Filter active bans
  const activeBansList = globalBans.filter((b) => b.status === "ACTIVE" || !b.status);
  const filteredBans = activeBansList.filter((b) => {
    const q = banSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      b.maskedDestination.toLowerCase().includes(q) ||
      b.reason.toLowerCase().includes(q) ||
      (b.sourceRequestId && b.sourceRequestId.toLowerCase().includes(q))
    );
  });

  // Approve action
  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingTarget) return;

    setProcessingApprove(true);
    try {
      const res = await fetch(`/api/v1/admin/bans/requests/${approvingTarget.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewNotes: reviewNotes.trim(),
          notes: reviewNotes.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to approve global ban request");
      }

      toast.success("Global ban request approved successfully");
      setApprovingTarget(null);
      setReviewNotes("");
      fetchRequests();
      fetchGlobalBans();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to approve global ban request";
      toast.error(message);
    } finally {
      setProcessingApprove(false);
    }
  };

  // Reject action
  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingTarget) return;

    if (rejectionReason.trim().length < 3) {
      toast.error("Rejection reason must be at least 3 characters");
      return;
    }
    if (rejectionReason.trim().length > 255) {
      toast.error("Rejection reason must not exceed 255 characters");
      return;
    }

    setProcessingReject(true);
    try {
      const res = await fetch(`/api/v1/admin/bans/requests/${rejectingTarget.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectionReason: rejectionReason.trim(),
          reason: rejectionReason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to reject global ban request");
      }

      toast.success("Global ban request rejected");
      setRejectingTarget(null);
      setRejectionReason("");
      fetchRequests();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reject global ban request";
      toast.error(message);
    } finally {
      setProcessingReject(false);
    }
  };

  // Remove ban action
  const handleRemoveBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!removingTarget) return;

    if (removalReason.trim().length < 3) {
      toast.error("Removal reason must be at least 3 characters");
      return;
    }
    if (removalReason.trim().length > 255) {
      toast.error("Removal reason must not exceed 255 characters");
      return;
    }

    setProcessingRemove(true);
    try {
      const res = await fetch(`/api/v1/admin/bans/${removingTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          removalReason: removalReason.trim(),
          reason: removalReason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to remove global ban");
      }

      toast.success("Global ban removed successfully");
      setRemovingTarget(null);
      setRemovalReason("");
      fetchGlobalBans();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove global ban";
      toast.error(message);
    } finally {
      setProcessingRemove(false);
    }
  };

  const isCurrentLoading = activeTab === "pending" ? loadingRequests : loadingBans;

  if (accessDenied) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
        <div className="rounded-2xl border border-line bg-surface p-8 sm:p-12 text-center shadow-[var(--shadow-card)] space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-xs">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary font-display">
              Administrator Privileges Required
            </h1>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-md mx-auto">
              Destination ban review, approval, and platform-wide moderation operations are restricted to verified platform Administrators.
            </p>
          </div>

          <div className="rounded-xl border border-line bg-canvas p-4 text-left text-xs text-text-secondary space-y-1">
            <div className="flex items-center gap-2 font-medium text-text-primary">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Restricted Governance Domain</span>
            </div>
            <p className="text-[11px] text-text-muted leading-normal">
              Your account does not have sufficient administrative privileges to view or manage global destination bans.
            </p>
          </div>

          <div className="pt-2 flex justify-center">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 text-xs font-semibold transition-colors shadow-sm press-feedback"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 overflow-x-clip">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-[22px] font-display font-semibold text-text-primary tracking-tight">
                Global Ban Review
              </h1>
              <p className="text-text-muted text-[13px] mt-0.5">
                Review merchant ban escalation requests and manage platform-wide destination bans.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isCurrentLoading}
          className="p-2.5 bg-surface border border-line rounded-lg hover:bg-canvas text-text-secondary transition-colors disabled:opacity-50 self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className={cn("w-5 h-5", isCurrentLoading && "animate-spin")} />
        </button>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto table-scrollbar max-w-full">
        <div className="flex border-b border-line gap-6 min-w-max pb-0.5">
          <button
            onClick={() => setActiveTab("pending")}
            className={cn(
              "pb-3 text-sm font-medium transition-colors relative flex items-center gap-2 whitespace-nowrap",
              activeTab === "pending"
                ? "text-primary border-b-2 border-primary"
                : "text-text-muted hover:text-text-primary"
            )}
          >
            <span>Pending Requests</span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-semibold",
                activeTab === "pending"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-surface text-text-muted border border-line"
              )}
            >
              {pendingRequests.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("active")}
            className={cn(
              "pb-3 text-sm font-medium transition-colors relative flex items-center gap-2 whitespace-nowrap",
              activeTab === "active"
                ? "text-primary border-b-2 border-primary"
                : "text-text-muted hover:text-text-primary"
            )}
          >
            <span>Active Global Bans</span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-xs font-semibold",
                activeTab === "active"
                  ? "bg-red-500/15 text-red-600 dark:text-red-400"
                  : "bg-surface text-text-muted border border-line"
              )}
            >
              {activeBansList.length}
            </span>
          </button>
        </div>
      </div>

      {/* Tab 1: Pending Requests */}
      {activeTab === "pending" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-full sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search by destination, merchant, or reason..."
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-surface border border-line rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="text-xs text-text-muted shrink-0">
              {filteredRequests.length} request(s) awaiting review
            </div>
          </div>

          <div className="bg-canvas border border-line rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto table-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface border-b border-line text-text-muted font-medium text-xs uppercase tracking-wider">
                  <tr>
                    <th className="hidden md:table-cell px-3 sm:px-6 py-3.5">Date</th>
                    <th className="hidden lg:table-cell px-3 sm:px-6 py-3.5">Merchant Profile ID</th>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-3.5">Destination Type</th>
                    <th className="px-3 sm:px-6 py-3.5">Destination</th>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-3.5">Reason</th>
                    <th className="px-3 sm:px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {loadingRequests ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-text-muted">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        Loading global ban requests...
                      </td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-text-muted">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2" />
                          <p className="font-medium text-text-primary">No Pending Ban Requests</p>
                          <p className="text-xs text-text-muted mt-1">
                            {requestSearch
                              ? "No requests match your search."
                              : "All merchant ban escalation requests have been processed."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => (
                      <tr
                        key={req.id}
                        onClick={() => {
                          setApprovingTarget(req);
                          setReviewNotes("");
                        }}
                        className="hover:bg-surface/50 transition-colors cursor-pointer group"
                      >
                        <td className="hidden md:table-cell px-3 sm:px-6 py-3.5 sm:py-4 text-text-secondary whitespace-nowrap text-xs">
                          {formatDateTimeIST(req.createdAt)}
                        </td>
                        <td className="hidden lg:table-cell px-3 sm:px-6 py-3.5 sm:py-4">
                          <div className="font-medium text-text-primary text-xs font-mono">
                            {req.merchantProfile?.businessName || req.merchantProfileId}
                          </div>
                          {req.merchantProfile?.user?.email && (
                            <div className="text-[11px] text-text-muted">
                              {req.merchantProfile.user.email}
                            </div>
                          )}
                        </td>
                        <td className="hidden sm:table-cell px-3 sm:px-6 py-3.5 sm:py-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                              req.destinationType === "UPI"
                                ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/50"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/50"
                            )}
                          >
                            {req.destinationType === "UPI" ? (
                              <Smartphone className="w-3.5 h-3.5" />
                            ) : (
                              <Landmark className="w-3.5 h-3.5" />
                            )}
                            {req.destinationType === "UPI" ? "UPI VPA" : "Bank Account"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3.5 sm:py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "sm:hidden p-1 rounded-md text-xs shrink-0",
                                req.destinationType === "UPI"
                                  ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                                  : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                              )}
                              title={req.destinationType === "UPI" ? "UPI VPA" : "Bank Account"}
                            >
                              {req.destinationType === "UPI" ? (
                                <Smartphone className="w-3.5 h-3.5" />
                              ) : (
                                <Landmark className="w-3.5 h-3.5" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <div className="font-mono font-medium text-text-primary text-xs sm:text-sm truncate">
                                {req.maskedDestination}
                              </div>
                              <div className="text-[11px] text-text-muted lg:hidden truncate max-w-[150px] sm:max-w-[200px]">
                                From: {req.merchantProfile?.businessName || req.merchantProfileId}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-3 sm:px-6 py-3.5 sm:py-4 text-text-secondary max-w-xs truncate" title={req.reason}>
                          {req.reason}
                        </td>
                        <td className="px-3 sm:px-6 py-3.5 sm:py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setApprovingTarget(req);
                                setReviewNotes("");
                              }}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-400 rounded-lg transition-colors"
                              title="Approve Global Ban"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRejectingTarget(req);
                                setRejectionReason("");
                              }}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-900/50 dark:text-red-400 rounded-lg transition-colors"
                              title="Reject Request"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Active Global Bans */}
      {activeTab === "active" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-full sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search active global bans..."
                value={banSearch}
                onChange={(e) => setBanSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-surface border border-line rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="text-xs text-text-muted shrink-0">
              {filteredBans.length} platform-wide active ban(s)
            </div>
          </div>

          <div className="bg-canvas border border-line rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto table-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface border-b border-line text-text-muted font-medium text-xs uppercase tracking-wider">
                  <tr>
                    <th className="hidden md:table-cell px-3 sm:px-6 py-3.5">Date Activated</th>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-3.5">Destination Type</th>
                    <th className="px-3 sm:px-6 py-3.5">Masked Destination</th>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-3.5">Reason</th>
                    <th className="hidden lg:table-cell px-3 sm:px-6 py-3.5">Source Request ID</th>
                    <th className="px-3 sm:px-6 py-3.5">Status</th>
                    <th className="px-3 sm:px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {loadingBans ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-text-muted">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        Loading active global bans...
                      </td>
                    </tr>
                  ) : filteredBans.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-text-muted">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                          <ShieldCheck className="w-8 h-8 text-emerald-500 mb-2" />
                          <p className="font-medium text-text-primary">No Active Global Bans</p>
                          <p className="text-xs text-text-muted mt-1">
                            {banSearch
                              ? "No active bans match your search query."
                              : "No destinations are currently banned platform-wide."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredBans.map((ban) => (
                      <tr
                        key={ban.id}
                        onClick={() => {
                          setRemovingTarget(ban);
                          setRemovalReason("");
                        }}
                        className="hover:bg-surface/50 transition-colors cursor-pointer group"
                      >
                        <td className="hidden md:table-cell px-3 sm:px-6 py-3.5 sm:py-4 text-text-secondary whitespace-nowrap text-xs">
                          {formatDateTimeIST(ban.createdAt)}
                        </td>
                        <td className="hidden sm:table-cell px-3 sm:px-6 py-3.5 sm:py-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                              ban.destinationType === "UPI"
                                ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/50"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/50"
                            )}
                          >
                            {ban.destinationType === "UPI" ? (
                              <Smartphone className="w-3.5 h-3.5" />
                            ) : (
                              <Landmark className="w-3.5 h-3.5" />
                            )}
                            {ban.destinationType === "UPI" ? "UPI VPA" : "Bank Account"}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3.5 sm:py-4 font-mono font-medium text-text-primary">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "sm:hidden p-1 rounded-md text-xs shrink-0",
                                ban.destinationType === "UPI"
                                  ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                                  : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                              )}
                              title={ban.destinationType === "UPI" ? "UPI VPA" : "Bank Account"}
                            >
                              {ban.destinationType === "UPI" ? (
                                <Smartphone className="w-3.5 h-3.5" />
                              ) : (
                                <Landmark className="w-3.5 h-3.5" />
                              )}
                            </span>
                            <span className="truncate text-xs sm:text-sm">
                              {ban.maskedDestination}
                            </span>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-3 sm:px-6 py-3.5 sm:py-4 text-text-secondary max-w-xs truncate" title={ban.reason}>
                          {ban.reason}
                        </td>
                        <td className="hidden lg:table-cell px-3 sm:px-6 py-3.5 sm:py-4 text-xs font-mono text-text-muted">
                          {ban.sourceRequestId ? (
                            <span title={ban.sourceRequestId}>
                              {ban.sourceRequestId.slice(0, 10)}...
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 sm:px-6 py-3.5 sm:py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200/60 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                            <span className="hidden sm:inline">Active Global Ban</span>
                            <span className="sm:hidden">Active</span>
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-3.5 sm:py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemovingTarget(ban);
                              setRemovalReason("");
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800/40 rounded-lg transition-colors whitespace-nowrap"
                            title="Remove Global Ban"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Remove Ban</span>
                            <span className="sm:hidden">Remove</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Approve Global Ban Request */}
      <AdminModal
        isOpen={!!approvingTarget}
        onClose={() => setApprovingTarget(null)}
        title="Approve Global Ban Request"
        description="Permanently block this destination across all PayERupee merchants."
        icon={Check}
        iconClassName="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
      >
        {approvingTarget && (
          <form onSubmit={handleApprove} className="space-y-4">
            <div className="p-3.5 bg-canvas border border-line-soft rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Merchant:</span>
                <span className="font-mono text-text-primary font-medium">
                  {approvingTarget.merchantProfile?.businessName || approvingTarget.merchantProfileId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Destination:</span>
                <span className="font-mono text-text-primary font-medium">
                  {approvingTarget.maskedDestination} ({approvingTarget.destinationType})
                </span>
              </div>
              <div>
                <span className="text-text-muted block mb-0.5">Reported Reason:</span>
                <p className="text-text-primary bg-surface p-2 rounded-lg border border-line-soft">
                  {approvingTarget.reason}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-text-primary">
                Review Notes (Optional)
              </label>
              <textarea
                rows={2}
                maxLength={255}
                placeholder="e.g. Verified fraud claim, confirmed chargeback history..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-canvas border border-line rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-700 dark:text-amber-300">
              Notice: Approving this request will immediately reject any future payout to this recipient across EVERY merchant on the platform.
            </div>

            <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 border-t border-line-soft bg-surface/95 backdrop-blur-sm flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setApprovingTarget(null)}
                disabled={processingApprove}
                className="px-4 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processingApprove}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 press-feedback shadow-sm"
              >
                {processingApprove && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Approval</span>
              </button>
            </div>
          </form>
        )}
      </AdminModal>

      {/* MODAL 2: Reject Global Ban Request */}
      <AdminModal
        isOpen={!!rejectingTarget}
        onClose={() => setRejectingTarget(null)}
        title="Reject Global Ban Request"
        description="Decline platform-wide escalation for this recipient."
        icon={X}
        iconClassName="text-red-600 bg-red-50 dark:bg-red-950/40"
      >
        {rejectingTarget && (
          <form onSubmit={handleReject} className="space-y-4">
            <div className="p-3.5 bg-canvas border border-line-soft rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Target:</span>
                <span className="font-mono text-text-primary font-medium">
                  {rejectingTarget.maskedDestination}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Merchant:</span>
                <span className="font-mono text-text-primary font-medium">
                  {rejectingTarget.merchantProfile?.businessName || rejectingTarget.merchantProfileId}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-text-primary">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-text-muted">
                  {rejectionReason.length} / 255
                </span>
              </div>
              <textarea
                required
                rows={3}
                maxLength={255}
                placeholder="Explain why this request is being declined (e.g. Insufficient fraud evidence, legitimate vendor account)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-canvas border border-line rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
            </div>

            <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 border-t border-line-soft bg-surface/95 backdrop-blur-sm flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setRejectingTarget(null)}
                disabled={processingReject}
                className="px-4 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processingReject}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 press-feedback shadow-sm"
              >
                {processingReject && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </form>
        )}
      </AdminModal>

      {/* MODAL 3: Remove Active Global Ban */}
      <AdminModal
        isOpen={!!removingTarget}
        onClose={() => setRemovingTarget(null)}
        title="Remove Active Global Ban"
        description="Lift the platform-wide restriction on this destination."
        icon={AlertTriangle}
        iconClassName="text-amber-600 bg-amber-50 dark:bg-amber-950/40"
      >
        {removingTarget && (
          <form onSubmit={handleRemoveBan} className="space-y-4">
            <div className="p-3.5 bg-canvas border border-line-soft rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Destination:</span>
                <span className="font-mono text-text-primary font-medium">
                  {removingTarget.maskedDestination}
                </span>
              </div>
              <div>
                <span className="text-text-muted block mb-0.5">Original Ban Reason:</span>
                <p className="text-text-primary bg-surface p-2 rounded-lg border border-line-soft">
                  {removingTarget.reason}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-text-primary">
                  Removal Reason <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-text-muted">
                  {removalReason.length} / 255
                </span>
              </div>
              <textarea
                required
                rows={3}
                maxLength={255}
                placeholder="Specify why this global ban is being removed (e.g. Cleared by compliance review, false positive)..."
                value={removalReason}
                onChange={(e) => setRemovalReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-canvas border border-line rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
            </div>

            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-700 dark:text-red-300">
              Warning: Lifting this ban will re-enable payouts to this recipient across the entire PayERupee network, unless a merchant has an active local ban.
            </div>

            <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 border-t border-line-soft bg-surface/95 backdrop-blur-sm flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setRemovingTarget(null)}
                disabled={processingRemove}
                className="px-4 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processingRemove}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 press-feedback shadow-sm"
              >
                {processingRemove && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Removal</span>
              </button>
            </div>
          </form>
        )}
      </AdminModal>
    </div>
  );
}
