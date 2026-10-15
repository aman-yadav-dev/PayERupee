"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Plus,
  RefreshCw,
  Loader2,
  Smartphone,
  Landmark,
  AlertTriangle,
  X,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeIST } from "@/lib/date";
import { cn } from "@/lib/utils";

export type DestinationType = "UPI" | "BANK_ACCOUNT";
export type BanStatus = "ACTIVE" | "UNBANNED";
export type BanRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface MerchantBanItem {
  id: string;
  merchantProfileId: string;
  destinationType: DestinationType;
  maskedDestination: string;
  reason: string;
  status: BanStatus;
  createdAt: string;
  updatedAt: string;
  unbannedAt?: string | null;
  unbanReason?: string | null;
}

export interface GlobalBanRequestItem {
  id: string;
  merchantProfileId: string;
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

export default function MerchantBansPage() {
  const [activeTab, setActiveTab] = useState<"local" | "global">("local");

  // Local bans state
  const [localBans, setLocalBans] = useState<MerchantBanItem[]>([]);
  const [loadingLocal, setLoadingLocal] = useState<boolean>(true);
  const [localSearch, setLocalSearch] = useState<string>("");

  // Global requests state
  const [globalRequests, setGlobalRequests] = useState<GlobalBanRequestItem[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState<boolean>(true);
  const [globalSearch, setGlobalSearch] = useState<string>("");

  // Modals state
  const [isCreateLocalOpen, setIsCreateLocalOpen] = useState<boolean>(false);
  const [isCreateGlobalOpen, setIsCreateGlobalOpen] = useState<boolean>(false);
  const [unbanTarget, setUnbanTarget] = useState<MerchantBanItem | null>(null);

  // Form states for Create Local Ban
  const [localDestType, setLocalDestType] = useState<DestinationType>("UPI");
  const [localVpa, setLocalVpa] = useState<string>("");
  const [localAccountNumber, setLocalAccountNumber] = useState<string>("");
  const [localIfsc, setLocalIfsc] = useState<string>("");
  const [localReason, setLocalReason] = useState<string>("");
  const [submittingLocal, setSubmittingLocal] = useState<boolean>(false);

  // Form states for Create Global Ban Request
  const [globalDestType, setGlobalDestType] = useState<DestinationType>("UPI");
  const [globalVpa, setGlobalVpa] = useState<string>("");
  const [globalAccountNumber, setGlobalAccountNumber] = useState<string>("");
  const [globalIfsc, setGlobalIfsc] = useState<string>("");
  const [globalReason, setGlobalReason] = useState<string>("");
  const [applyImmediateLocalBan, setApplyImmediateLocalBan] = useState<boolean>(true);
  const [submittingGlobal, setSubmittingGlobal] = useState<boolean>(false);

  // Form state for Unban
  const [unbanReason, setUnbanReason] = useState<string>("");
  const [submittingUnban, setSubmittingUnban] = useState<boolean>(false);

  // Fetch local bans
  const fetchLocalBans = async () => {
    setLoadingLocal(true);
    try {
      const res = await fetch("/api/v1/merchant/bans");
      const json = await res.json();
      if (res.ok && json.success) {
        setLocalBans(json.data || []);
      } else if (Array.isArray(json)) {
        setLocalBans(json);
      } else {
        toast.error(json.error || "Failed to load local bans");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Network error loading local bans";
      toast.error(message);
    } finally {
      setLoadingLocal(false);
    }
  };

  // Fetch global requests
  const fetchGlobalRequests = async () => {
    setLoadingGlobal(true);
    try {
      const res = await fetch("/api/v1/merchant/bans/requests");
      const json = await res.json();
      if (res.ok && json.success) {
        setGlobalRequests(json.data || []);
      } else if (Array.isArray(json)) {
        setGlobalRequests(json);
      } else {
        toast.error(json.error || "Failed to load global ban requests");
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Network error loading global ban requests";
      toast.error(message);
    } finally {
      setLoadingGlobal(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const init = async () => {
      try {
        const [localRes, globalRes] = await Promise.all([
          fetch("/api/v1/merchant/bans").then((r) => r.json()).catch(() => null),
          fetch("/api/v1/merchant/bans/requests").then((r) => r.json()).catch(() => null),
        ]);
        if (ignore) return;
        if (localRes?.success) setLocalBans(localRes.data || []);
        if (globalRes?.success) setGlobalRequests(globalRes.data || []);
      } finally {
        if (!ignore) {
          setLoadingLocal(false);
          setLoadingGlobal(false);
        }
      }
    };
    init();
    return () => {
      ignore = true;
    };
  }, []);

  const handleRefresh = () => {
    if (activeTab === "local") {
      fetchLocalBans();
    } else {
      fetchGlobalRequests();
    }
  };

  // Filtered lists
  const filteredLocalBans = useMemo(() => {
    const q = localSearch.trim().toLowerCase();
    if (!q) return localBans;
    return localBans.filter(
      (b) =>
        b.maskedDestination.toLowerCase().includes(q) ||
        b.reason.toLowerCase().includes(q) ||
        b.destinationType.toLowerCase().includes(q)
    );
  }, [localBans, localSearch]);

  const filteredGlobalRequests = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return globalRequests;
    return globalRequests.filter(
      (r) =>
        r.maskedDestination.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q) ||
        r.destinationType.toLowerCase().includes(q) ||
        (r.rejectionReason && r.rejectionReason.toLowerCase().includes(q))
    );
  }, [globalRequests, globalSearch]);

  // Submit local ban
  const handleCreateLocalBan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (localDestType === "UPI") {
      if (!localVpa.trim()) {
        toast.error("Please enter a valid UPI ID (VPA)");
        return;
      }
      if (!localVpa.includes("@")) {
        toast.error("UPI ID must be in the format 'username@bank'");
        return;
      }
    } else {
      if (!localAccountNumber.trim()) {
        toast.error("Please enter an account number");
        return;
      }
      if (!localIfsc.trim() || localIfsc.trim().length !== 11) {
        toast.error("Please enter a valid 11-character IFSC code");
        return;
      }
    }

    if (localReason.trim().length < 3) {
      toast.error("Ban reason must be at least 3 characters");
      return;
    }
    if (localReason.trim().length > 255) {
      toast.error("Ban reason must not exceed 255 characters");
      return;
    }

    setSubmittingLocal(true);
    try {
      const payload =
        localDestType === "UPI"
          ? {
              destinationType: "UPI",
              upiId: localVpa.trim(),
              vpa: localVpa.trim(),
              destination: { type: "UPI", vpa: localVpa.trim() },
              reason: localReason.trim(),
            }
          : {
              destinationType: "BANK_ACCOUNT",
              accountNumber: localAccountNumber.trim(),
              ifscCode: localIfsc.trim().toUpperCase(),
              ifsc: localIfsc.trim().toUpperCase(),
              destination: {
                type: "BANK_ACCOUNT",
                accountNumber: localAccountNumber.trim(),
                ifsc: localIfsc.trim().toUpperCase(),
              },
              reason: localReason.trim(),
            };

      const res = await fetch("/api/v1/merchant/bans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create ban");
      }

      toast.success("Destination banned successfully");
      setIsCreateLocalOpen(false);
      setLocalVpa("");
      setLocalAccountNumber("");
      setLocalIfsc("");
      setLocalReason("");
      fetchLocalBans();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create destination ban";
      toast.error(message);
    } finally {
      setSubmittingLocal(false);
    }
  };

  // Submit unban
  const handleUnban = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unbanTarget) return;

    if (unbanReason.trim().length < 3) {
      toast.error("Unban reason must be at least 3 characters");
      return;
    }
    if (unbanReason.trim().length > 255) {
      toast.error("Unban reason must not exceed 255 characters");
      return;
    }

    setSubmittingUnban(true);
    try {
      const res = await fetch(`/api/v1/merchant/bans/${unbanTarget.id}/unban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: unbanReason.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to unban destination");
      }

      toast.success("Destination unbanned successfully");
      setUnbanTarget(null);
      setUnbanReason("");
      fetchLocalBans();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to unban destination";
      toast.error(message);
    } finally {
      setSubmittingUnban(false);
    }
  };

  // Submit global ban request
  const handleCreateGlobalRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (globalDestType === "UPI") {
      if (!globalVpa.trim()) {
        toast.error("Please enter a valid UPI ID (VPA)");
        return;
      }
      if (!globalVpa.includes("@")) {
        toast.error("UPI ID must be in the format 'username@bank'");
        return;
      }
    } else {
      if (!globalAccountNumber.trim()) {
        toast.error("Please enter an account number");
        return;
      }
      if (!globalIfsc.trim() || globalIfsc.trim().length !== 11) {
        toast.error("Please enter a valid 11-character IFSC code");
        return;
      }
    }

    if (globalReason.trim().length < 3) {
      toast.error("Reason must be at least 3 characters");
      return;
    }
    if (globalReason.trim().length > 255) {
      toast.error("Reason must not exceed 255 characters");
      return;
    }

    setSubmittingGlobal(true);
    try {
      const payload =
        globalDestType === "UPI"
          ? {
              destinationType: "UPI",
              upiId: globalVpa.trim(),
              vpa: globalVpa.trim(),
              destination: { type: "UPI", vpa: globalVpa.trim() },
              reason: globalReason.trim(),
              applyImmediateLocalBan,
              applyLocalBan: applyImmediateLocalBan,
            }
          : {
              destinationType: "BANK_ACCOUNT",
              accountNumber: globalAccountNumber.trim(),
              ifscCode: globalIfsc.trim().toUpperCase(),
              ifsc: globalIfsc.trim().toUpperCase(),
              destination: {
                type: "BANK_ACCOUNT",
                accountNumber: globalAccountNumber.trim(),
                ifsc: globalIfsc.trim().toUpperCase(),
              },
              reason: globalReason.trim(),
              applyImmediateLocalBan,
              applyLocalBan: applyImmediateLocalBan,
            };

      const res = await fetch("/api/v1/merchant/bans/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to submit request");
      }

      toast.success(
        applyImmediateLocalBan
          ? "Global ban request submitted & local ban applied immediately"
          : "Global ban request submitted for admin review"
      );
      setIsCreateGlobalOpen(false);
      setGlobalVpa("");
      setGlobalAccountNumber("");
      setGlobalIfsc("");
      setGlobalReason("");
      setApplyImmediateLocalBan(true);
      fetchGlobalRequests();
      if (applyImmediateLocalBan) {
        fetchLocalBans();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit global ban request";
      toast.error(message);
    } finally {
      setSubmittingGlobal(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 overflow-x-clip">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-500 dark:bg-red-500/20 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-display font-semibold text-text-primary truncate sm:whitespace-normal">
                Destination Ban Management
              </h1>
              <p className="text-text-muted text-xs sm:text-sm mt-0.5 line-clamp-2 sm:line-clamp-none">
                Block suspicious payout destinations and submit platform-wide global ban requests.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            onClick={handleRefresh}
            disabled={activeTab === "local" ? loadingLocal : loadingGlobal}
            className="p-2.5 rounded-lg border border-line bg-surface hover:bg-canvas text-text-secondary transition-colors disabled:opacity-50 shrink-0"
            title="Refresh list"
          >
            <RefreshCw
              className={cn(
                "w-4 h-4",
                (activeTab === "local" ? loadingLocal : loadingGlobal) && "animate-spin"
              )}
            />
          </button>

          {activeTab === "local" ? (
            <button
              onClick={() => setIsCreateLocalOpen(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Ban Destination</span>
            </button>
          ) : (
            <button
              onClick={() => setIsCreateGlobalOpen(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors shadow-xs"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Request Global Ban</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-line gap-4 sm:gap-6 overflow-x-auto scroll-thin -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveTab("local")}
          className={cn(
            "pb-3 text-sm font-medium transition-colors relative flex items-center gap-2 shrink-0 whitespace-nowrap",
            activeTab === "local"
              ? "text-primary border-b-2 border-primary"
              : "text-text-muted hover:text-text-primary"
          )}
        >
          <span>Local Bans</span>
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-xs font-semibold",
              activeTab === "local"
                ? "bg-primary/10 text-primary"
                : "bg-surface text-text-muted border border-line"
            )}
          >
            {localBans.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("global")}
          className={cn(
            "pb-3 text-sm font-medium transition-colors relative flex items-center gap-2 shrink-0 whitespace-nowrap",
            activeTab === "global"
              ? "text-primary border-b-2 border-primary"
              : "text-text-muted hover:text-text-primary"
          )}
        >
          <span>Global Ban Requests</span>
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-xs font-semibold",
              activeTab === "global"
                ? "bg-primary/10 text-primary"
                : "bg-surface text-text-muted border border-line"
            )}
          >
            {globalRequests.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Local Bans */}
      {activeTab === "local" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-full sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search by destination or reason..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-surface border border-line rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="text-xs text-text-muted shrink-0">
              Showing {filteredLocalBans.length} of {localBans.length} bans
            </div>
          </div>

          <div className="bg-surface border border-line rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas/60 border-b border-line text-xs font-medium uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-3.5">Type</th>
                    <th className="px-3 sm:px-6 py-3.5">Destination</th>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-3.5">Reason</th>
                    <th className="px-3 sm:px-6 py-3.5">Status</th>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-3.5">Created Date</th>
                    <th className="px-3 sm:px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {loadingLocal ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        <p>Loading destination bans...</p>
                      </td>
                    </tr>
                  ) : filteredLocalBans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-full mb-3">
                            <ShieldCheck className="w-8 h-8" />
                          </div>
                          <p className="font-medium text-text-primary">No Local Bans Found</p>
                          <p className="text-xs text-text-muted mt-1 text-center">
                            {localSearch
                              ? "No bans matched your search criteria."
                              : "You haven't blocked any destination yet. Click 'Ban Destination' to prevent payouts to suspicious recipients."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLocalBans.map((ban) => {
                      const isActive = ban.status === "ACTIVE";
                      return (
                        <tr key={ban.id} className="hover:bg-canvas/40 transition-colors">
                          <td className="hidden sm:table-cell px-3 sm:px-6 py-3.5 sm:py-4">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                                ban.destinationType === "UPI"
                                  ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40"
                                  : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40"
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
                          <td className="px-3 sm:px-6 py-3.5 sm:py-4">
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
                              <div className="min-w-0">
                                <span className="font-mono font-medium text-text-primary text-xs sm:text-sm block truncate max-w-[140px] sm:max-w-none">
                                  {ban.maskedDestination}
                                </span>
                                <span className="text-[11px] text-text-muted sm:hidden block truncate max-w-[140px]" title={ban.reason}>
                                  Reason: {ban.reason}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="hidden sm:table-cell px-3 sm:px-6 py-3.5 sm:py-4 text-text-secondary max-w-[120px] sm:max-w-xs truncate" title={ban.reason}>
                            {ban.reason}
                          </td>
                          <td className="px-3 sm:px-6 py-3.5 sm:py-4">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200/60 dark:border-red-800/40 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                                <span className="hidden sm:inline">Active Ban</span>
                                <span className="sm:hidden">Active</span>
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 whitespace-nowrap">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  Unbanned
                                </span>
                                {ban.unbanReason && (
                                  <p className="text-[11px] text-text-muted truncate max-w-[140px] sm:max-w-[200px]" title={ban.unbanReason}>
                                    Reason: {ban.unbanReason}
                                  </p>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="hidden sm:table-cell px-3 sm:px-6 py-3.5 sm:py-4 text-text-muted text-xs whitespace-nowrap">
                            {formatDateTimeIST(ban.createdAt)}
                          </td>
                          <td className="px-3 sm:px-6 py-3.5 sm:py-4 text-right whitespace-nowrap">
                            {isActive ? (
                              <button
                                onClick={() => {
                                  setUnbanTarget(ban);
                                  setUnbanReason("");
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800/40 rounded-lg transition-colors whitespace-nowrap"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                                <span>Unban</span>
                              </button>
                            ) : (
                              <span className="text-xs text-text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Global Ban Requests */}
      {activeTab === "global" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-full sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search global requests..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-surface border border-line rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="text-xs text-text-muted shrink-0">
              Showing {filteredGlobalRequests.length} of {globalRequests.length} requests
            </div>
          </div>

          <div className="bg-surface border border-line rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas/60 border-b border-line text-xs font-medium uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-3.5">Type</th>
                    <th className="px-3 sm:px-6 py-3.5">Destination</th>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-3.5">Reason</th>
                    <th className="px-3 sm:px-6 py-3.5">Status</th>
                    <th className="hidden lg:table-cell px-3 sm:px-6 py-3.5">Reviewed Date</th>
                    <th className="hidden md:table-cell px-3 sm:px-6 py-3.5">Rejection / Review Notes</th>
                    <th className="hidden sm:table-cell px-3 sm:px-6 py-3.5">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {loadingGlobal ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                        <p>Loading global ban requests...</p>
                      </td>
                    </tr>
                  ) : filteredGlobalRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-full mb-3">
                            <ShieldAlert className="w-8 h-8" />
                          </div>
                          <p className="font-medium text-text-primary">No Global Ban Requests</p>
                          <p className="text-xs text-text-muted mt-1 text-center">
                            {globalSearch
                              ? "No requests matched your search criteria."
                              : "You haven't submitted any destination for platform-wide banning yet."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredGlobalRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-canvas/40 transition-colors">
                        <td className="hidden sm:table-cell px-3 sm:px-6 py-3.5 sm:py-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                              req.destinationType === "UPI"
                                ? "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40"
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
                              <span className="font-mono font-medium text-text-primary text-xs sm:text-sm block truncate max-w-[140px] sm:max-w-none">
                                {req.maskedDestination}
                              </span>
                              <span className="text-[11px] text-text-muted sm:hidden block truncate max-w-[140px]" title={req.reason}>
                                {req.reason}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-3 sm:px-6 py-3.5 sm:py-4 text-text-secondary max-w-xs truncate" title={req.reason}>
                          {req.reason}
                        </td>
                        <td className="px-3 sm:px-6 py-3.5 sm:py-4">
                          {req.status === "PENDING" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40 whitespace-nowrap">
                              <Clock className="w-3 h-3 text-amber-500" />
                              <span className="hidden sm:inline">Pending Review</span>
                              <span className="sm:hidden">Pending</span>
                            </span>
                          )}
                          {req.status === "APPROVED" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40 whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Approved</span>
                            </span>
                          )}
                          {req.status === "REJECTED" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200/60 dark:border-red-800/40 whitespace-nowrap">
                              <XCircle className="w-3 h-3 text-red-500" />
                              <span>Rejected</span>
                            </span>
                          )}
                        </td>
                        <td className="hidden lg:table-cell px-3 sm:px-6 py-3.5 sm:py-4 text-text-muted text-xs whitespace-nowrap">
                          {req.reviewedAt ? formatDateTimeIST(req.reviewedAt) : "—"}
                        </td>
                        <td className="hidden md:table-cell px-3 sm:px-6 py-3.5 sm:py-4 text-xs max-w-xs truncate">
                          {req.status === "REJECTED" ? (
                            <span className="text-red-600 dark:text-red-400 font-medium" title={req.rejectionReason || "No details provided"}>
                              {req.rejectionReason || "Rejected by admin"}
                            </span>
                          ) : req.reviewNotes ? (
                            <span className="text-text-secondary" title={req.reviewNotes}>
                              {req.reviewNotes}
                            </span>
                          ) : (
                            <span className="text-text-muted">—</span>
                          )}
                        </td>
                        <td className="hidden sm:table-cell px-3 sm:px-6 py-3.5 sm:py-4 text-text-muted text-xs whitespace-nowrap">
                          {formatDateTimeIST(req.createdAt)}
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

      {/* MODAL 1: Create Local Ban */}
      {isCreateLocalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0f172a]/40 backdrop-blur-[6px] animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-surface border border-line rounded-[18px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[88vh]">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-line shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 text-red-500 rounded-lg shrink-0">
                  <Ban className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-display font-semibold text-text-primary">
                    Ban Destination
                  </h2>
                  <p className="text-xs text-text-muted">
                    Prevent payouts to this recipient across your merchant account.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateLocalOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-canvas transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLocalBan} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
              {/* Type Switcher */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Destination Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLocalDestType("UPI")}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                      localDestType === "UPI"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-line bg-surface hover:bg-canvas text-text-muted"
                    )}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>UPI ID</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocalDestType("BANK_ACCOUNT")}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                      localDestType === "BANK_ACCOUNT"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-line bg-surface hover:bg-canvas text-text-muted"
                    )}
                  >
                    <Landmark className="w-4 h-4" />
                    <span>Bank Account</span>
                  </button>
                </div>
              </div>

              {/* Destination inputs */}
              {localDestType === "UPI" ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">
                    UPI ID / VPA <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. fraudster@okaxis"
                    value={localVpa}
                    onChange={(e) => setLocalVpa(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-canvas border border-line rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                  />
                  <p className="text-[11px] text-text-muted">
                    Exact UPI VPA to block from receiving payouts.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">
                      Account Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 123456789012"
                      value={localAccountNumber}
                      onChange={(e) => setLocalAccountNumber(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-canvas border border-line rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">
                      IFSC Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={11}
                      placeholder="e.g. HDFC0001234"
                      value={localIfsc}
                      onChange={(e) => setLocalIfsc(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 text-sm bg-canvas border border-line rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono uppercase"
                    />
                  </div>
                </div>
              )}

              {/* Ban reason */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-text-secondary">
                    Ban Reason <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-text-muted">
                    {localReason.length} / 255
                  </span>
                </div>
                <textarea
                  required
                  rows={3}
                  maxLength={255}
                  placeholder="Explain why this destination is being banned (e.g. Chargeback abuse, suspect fraudulent account)..."
                  value={localReason}
                  onChange={(e) => setLocalReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-canvas border border-line rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              {/* Action buttons */}
              <div className="sticky bottom-0 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-4 border-t border-line-soft bg-surface/95 backdrop-blur-sm flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateLocalOpen(false)}
                  disabled={submittingLocal}
                  className="px-4 py-2 text-sm font-medium border border-line rounded-lg text-text-secondary hover:bg-canvas transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLocal}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 shadow-xs"
                >
                  {submittingLocal && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Ban Destination</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Global Ban Request */}
      {isCreateGlobalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0f172a]/40 backdrop-blur-[6px] animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-surface border border-line rounded-[18px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[88vh]">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-line shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-display font-semibold text-text-primary">
                    Request Platform-Wide Global Ban
                  </h2>
                  <p className="text-xs text-text-muted">
                    Escalate fraudulent destinations to platform administrators for review.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateGlobalOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-canvas transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGlobalRequest} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
              {/* Type Switcher */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                  Destination Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGlobalDestType("UPI")}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                      globalDestType === "UPI"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-line bg-surface hover:bg-canvas text-text-muted"
                    )}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>UPI ID</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlobalDestType("BANK_ACCOUNT")}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                      globalDestType === "BANK_ACCOUNT"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-line bg-surface hover:bg-canvas text-text-muted"
                    )}
                  >
                    <Landmark className="w-4 h-4" />
                    <span>Bank Account</span>
                  </button>
                </div>
              </div>

              {/* Destination inputs */}
              {globalDestType === "UPI" ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-secondary">
                    UPI ID / VPA <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. scammer@okicici"
                    value={globalVpa}
                    onChange={(e) => setGlobalVpa(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-canvas border border-line rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">
                      Account Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 987654321012"
                      value={globalAccountNumber}
                      onChange={(e) => setGlobalAccountNumber(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-canvas border border-line rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-text-secondary">
                      IFSC Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={11}
                      placeholder="e.g. SBIN0001234"
                      value={globalIfsc}
                      onChange={(e) => setGlobalIfsc(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 text-sm bg-canvas border border-line rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono uppercase"
                    />
                  </div>
                </div>
              )}

              {/* Global Ban reason */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-text-secondary">
                    Reason for Global Ban <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-text-muted">
                    {globalReason.length} / 255
                  </span>
                </div>
                <textarea
                  required
                  rows={3}
                  maxLength={255}
                  placeholder="Provide detailed evidence or rationale for platform-wide ban..."
                  value={globalReason}
                  onChange={(e) => setGlobalReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-canvas border border-line rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              {/* Checkbox: Immediate Local Ban */}
              <div className="p-3.5 bg-canvas border border-line rounded-xl space-y-1">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyImmediateLocalBan}
                    onChange={(e) => setApplyImmediateLocalBan(e.target.checked)}
                    className="mt-0.5 rounded border-line text-primary focus:ring-primary/20"
                  />
                  <div>
                    <span className="text-xs font-medium text-text-primary block">
                      Apply immediate local ban on my account
                    </span>
                    <span className="text-[11px] text-text-muted block leading-relaxed">
                      Recommended. Blocks payouts to this destination from your account instantly while administrative review is underway.
                    </span>
                  </div>
                </label>
              </div>

              {/* Action buttons */}
              <div className="sticky bottom-0 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-4 border-t border-line-soft bg-surface/95 backdrop-blur-sm flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateGlobalOpen(false)}
                  disabled={submittingGlobal}
                  className="px-4 py-2 text-sm font-medium border border-line rounded-lg text-text-secondary hover:bg-canvas transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingGlobal}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors disabled:opacity-50 shadow-xs"
                >
                  {submittingGlobal && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Unban Confirmation */}
      {unbanTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0f172a]/40 backdrop-blur-[6px] animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-surface border border-line rounded-[18px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[88vh]">
            <div className="p-4 sm:p-6 border-b border-line flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-display font-semibold text-text-primary">
                    Unban Destination
                  </h2>
                  <p className="text-xs text-text-muted">
                    Restore payout capability to this recipient.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setUnbanTarget(null);
                  setUnbanReason("");
                }}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-canvas transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUnban} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4">
              <div className="p-3 bg-canvas border border-line rounded-xl space-y-1">
                <div className="text-xs text-text-muted">Target Destination</div>
                <div className="font-mono font-medium text-text-primary text-sm">
                  {unbanTarget.maskedDestination}
                </div>
                <div className="text-[11px] text-text-muted">
                  Type: {unbanTarget.destinationType === "UPI" ? "UPI VPA" : "Bank Account"}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-text-secondary">
                    Reason for Unbanning <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-text-muted">
                    {unbanReason.length} / 255
                  </span>
                </div>
                <textarea
                  required
                  rows={3}
                  maxLength={255}
                  placeholder="Explain why this destination is being unbanned (e.g. Dispute resolved, customer identity verified)..."
                  value={unbanReason}
                  onChange={(e) => setUnbanReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-canvas border border-line rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-700 dark:text-amber-300">
                Warning: Once unbanned, future payouts directed to this recipient will no longer be rejected by your local ban list.
              </div>

              <div className="sticky bottom-0 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 px-4 sm:px-6 py-4 border-t border-line-soft bg-surface/95 backdrop-blur-sm flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setUnbanTarget(null);
                    setUnbanReason("");
                  }}
                  disabled={submittingUnban}
                  className="px-4 py-2 text-sm font-medium border border-line rounded-lg text-text-secondary hover:bg-canvas transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingUnban}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50 shadow-xs"
                >
                  {submittingUnban && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Confirm Unban</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
