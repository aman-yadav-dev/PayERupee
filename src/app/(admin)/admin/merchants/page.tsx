"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Users,
  Search,
  RefreshCw,
  Loader2,
  CreditCard,
  Building2,
  Key,
  CheckCircle,
  AlertTriangle,
  Copy,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminDrawer } from "@/components/admin/AdminDrawer";

interface MerchantItem {
  id: string;
  businessName: string | null;
  phone: string | null;
  accountStatus: "ACTIVE" | "PENDING" | "SUSPENDED" | "DELETED";
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
  };
  wallet?: {
    balance: number;
    currency: string;
    ledgerAccountId?: string;
  } | null;
  kycStatus: string;
  kycSubmittedAt: string | null;
}

interface MerchantBankDetail {
  id: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  isActive?: boolean;
}

interface ApiKeyDetail {
  id: string;
  name: string;
  isActive: boolean;
}

interface MerchantDetail extends MerchantItem {
  merchantBanks?: MerchantBankDetail[];
  apiKeys?: ApiKeyDetail[];
  kycApplication?: {
    id: string;
    status: string;
    submissionCycles?: Array<{
      status: string;
      submittedAt: string | null;
      reviewedAt: string | null;
      rejectionReason: string | null;
    }>;
  } | null;
}

export default function AdminMerchantsPage() {
  const [merchants, setMerchants] = useState<MerchantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantDetail | null>(null);
  const [, startTransition] = useTransition();

  // Action states
  const [isApproving, setIsApproving] = useState(false);
  const [isSuspending, setIsSuspending] = useState(false);
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);

  const fetchMerchants = (targetPage = page, targetPageSize = pageSize) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (appliedSearch.trim()) params.set("search", appliedSearch.trim());
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    params.set("page", targetPage.toString());
    params.set("limit", targetPageSize.toString());

    fetch(`/api/v1/admin/merchants?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setMerchants(json.data || []);
          if (json.meta) {
            setTotalPages(json.meta.totalPages || 1);
            setTotalCount(json.meta.total || 0);
          }
        } else {
          toast.error("Failed to load merchants");
        }
      })
      .catch(() => toast.error("Error communicating with administrative API"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams();
    if (appliedSearch.trim()) params.set("search", appliedSearch.trim());
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    params.set("page", page.toString());
    params.set("limit", pageSize.toString());

    fetch(`/api/v1/admin/merchants?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (mounted && json.success) {
          setMerchants(json.data || []);
          if (json.meta) {
            setTotalPages(json.meta.totalPages || 1);
            setTotalCount(json.meta.total || 0);
          }
        }
      })
      .catch(() => {
        if (mounted) toast.error("Failed to fetch merchants");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [statusFilter, appliedSearch, page, pageSize]);

  const openDetail = (id: string) => {
    fetch(`/api/v1/admin/merchants/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setSelectedMerchant(json.data);
        else toast.error("Could not load merchant profile");
      })
      .catch(() => toast.error("Error fetching merchant details"));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      setAppliedSearch(search);
      setPage(1);
    });
  };

  const handleApprove = async () => {
    if (!selectedMerchant) return;
    setIsApproving(true);
    try {
      const res = await fetch(`/api/v1/admin/merchants/${selectedMerchant.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Merchant account approved successfully.");
        setSelectedMerchant({ ...selectedMerchant, accountStatus: "ACTIVE" });
        fetchMerchants();
      } else {
        toast.error(data.error?.message || data.error || "Failed to approve merchant");
      }
    } catch {
      toast.error("Network error while submitting approval");
    } finally {
      setIsApproving(false);
    }
  };

  const handleSuspend = async () => {
    if (!selectedMerchant) return;
    setIsSuspending(true);
    try {
      const res = await fetch(`/api/v1/admin/merchants/${selectedMerchant.id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Merchant account suspended. All active sessions revoked.");
        setSelectedMerchant({ ...selectedMerchant, accountStatus: "SUSPENDED" });
        setSuspendModalOpen(false);
        fetchMerchants();
      } else {
        toast.error(data.error?.message || data.error || "Failed to suspend merchant");
      }
    } catch {
      toast.error("Network error while submitting suspension");
    } finally {
      setIsSuspending(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Title & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h2 className="text-[22px] font-semibold font-display text-text-primary tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <span>Merchant Accounts Directory</span>
          </h2>
          <p className="text-[13px] text-text-muted mt-0.5">
            Directory of all registered, active, pending, and suspended merchant profiles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search business, name, or email..."
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
            onClick={() => fetchMerchants()}
            disabled={loading}
            className="p-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary hover:bg-canvas transition-colors disabled:opacity-50 press-feedback"
            title="Refresh Merchants"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="overflow-x-auto table-scrollbar max-w-full py-0.5">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-canvas border border-line text-xs font-medium w-max">
          {["ALL", "ACTIVE", "PENDING", "SUSPENDED"].map((tab) => (
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

      {/* Merchants Table Card */}
      <div className="rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted text-xs">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span>Loading merchant accounts...</span>
          </div>
        ) : merchants.length === 0 ? (
          <div className="py-20 text-center text-text-muted text-xs">
            No merchant profiles found matching your query.
          </div>
        ) : (
          <div className="overflow-x-auto table-scrollbar">
            <table className="w-full min-w-[820px] text-left text-[13px] border-collapse">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  <th className="py-3 px-2.5 sm:px-4">Merchant / Business</th>
                  <th className="py-3 px-2 sm:px-4 whitespace-nowrap">Account Status</th>
                  <th className="py-3 px-3 hidden lg:table-cell">KYC State</th>
                  <th className="py-3 px-3 whitespace-nowrap hidden lg:table-cell">Wallet Balance</th>
                  <th className="py-3 px-4 hidden lg:table-cell">Created Date</th>
                  <th className="py-3 px-2.5 sm:px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {merchants.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => openDetail(m.id)}
                    className="hover:bg-canvas/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-2.5 sm:px-4">
                      <div className="font-medium text-text-primary truncate max-w-[105px] sm:max-w-[180px] lg:max-w-none">
                        {m.businessName || m.user?.name || "Merchant"}
                      </div>
                      <div className="text-[11px] sm:text-[12px] text-text-muted truncate max-w-[105px] sm:max-w-[180px] lg:max-w-none">
                        {m.user?.email} {m.phone && `· ${m.phone}`}
                      </div>
                      <div className="text-[11px] font-medium text-text-primary lg:hidden mt-0.5 tabular-nums">
                        {m.wallet ? formatINR(m.wallet.balance) : "₹0.00"}
                      </div>
                    </td>
                    <td className="py-3 px-2 sm:px-4 whitespace-nowrap">
                      <StatusPill status={m.accountStatus} />
                    </td>
                    <td className="py-3 px-3 hidden lg:table-cell">
                      <StatusPill status={m.kycStatus} />
                    </td>
                    <td className="py-3 px-3 tabular-nums font-medium text-text-primary whitespace-nowrap hidden lg:table-cell">
                      {m.wallet ? formatINR(m.wallet.balance) : "₹0.00"}
                    </td>
                    <td className="py-3 px-4 text-text-muted text-[12px] hidden lg:table-cell">
                      {new Date(m.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-2.5 sm:px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(m.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-line bg-surface text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-xs font-medium transition-colors press-feedback shadow-sm"
                      >
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">View Profile</span>
                        <span className="md:hidden">View</span>
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
          itemName="merchants"
          disabled={loading}
        />
      </div>

      {/* Profile Drawer via Portal */}
      <AdminDrawer
        isOpen={!!selectedMerchant}
        onClose={() => setSelectedMerchant(null)}
        title={selectedMerchant?.businessName || selectedMerchant?.user?.name || "Merchant Profile"}
        subtitle={
          selectedMerchant ? (
            <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-text-muted">
              <span className="truncate">ID: {selectedMerchant.id}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(selectedMerchant.id);
                  toast.success("Merchant ID copied to clipboard");
                }}
                className="hover:text-blue-600 transition-colors p-0.5 shrink-0"
                title="Copy Merchant ID"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          ) : undefined
        }
        badge={selectedMerchant ? <StatusPill status={selectedMerchant.accountStatus} /> : null}
        footer={
          selectedMerchant ? (
            <div className="w-full flex items-center justify-between gap-3">
              <span className="text-xs text-text-muted">
                Status: {selectedMerchant.accountStatus}
              </span>

              <div className="flex items-center gap-2.5">
                {selectedMerchant.accountStatus !== "ACTIVE" ? (
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold transition-colors disabled:opacity-50 press-feedback shadow-sm"
                  >
                    {isApproving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Approving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>Approve Merchant</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSuspendModalOpen(true)}
                    disabled={isSuspending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 text-xs font-semibold transition-colors disabled:opacity-50 press-feedback shadow-sm"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Suspend Merchant</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedMerchant(null)}
                  className="px-4 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          ) : null
        }
      >
        {selectedMerchant && (
          <div className="space-y-6">
            {/* Profile Overview */}
            <section>
              <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                Merchant Overview
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-canvas border border-line-soft space-y-1">
                  <span className="text-[11px] text-text-muted uppercase font-semibold">User Name</span>
                  <div className="text-[13px] font-medium text-text-primary truncate">
                    {selectedMerchant.user?.name || "—"}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-canvas border border-line-soft space-y-1">
                  <span className="text-[11px] text-text-muted uppercase font-semibold">Email Address</span>
                  <div className="text-[13px] text-text-primary truncate">
                    {selectedMerchant.user?.email || "—"}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-canvas border border-line-soft space-y-1">
                  <span className="text-[11px] text-text-muted uppercase font-semibold">Ledger Account</span>
                  <div className="text-[12px] text-text-primary font-mono truncate">
                    {selectedMerchant.wallet?.ledgerAccountId || "Unassigned"}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-canvas border border-line-soft space-y-1">
                  <span className="text-[11px] text-text-muted uppercase font-semibold">Available Balance</span>
                  <div className="text-[14px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {selectedMerchant.wallet ? formatINR(selectedMerchant.wallet.balance) : "₹0.00"}
                  </div>
                </div>
              </div>
            </section>

            {/* Settlement Banks */}
            <section className="space-y-3">
              <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                <span>Configured Settlement Banks</span>
              </h4>
              {selectedMerchant.merchantBanks && selectedMerchant.merchantBanks.length > 0 ? (
                <div className="space-y-2">
                  {selectedMerchant.merchantBanks.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-canvas border border-line-soft flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="text-[13px] font-medium text-text-primary">{b.accountHolderName}</div>
                        <div className="text-[11.5px] text-text-muted font-mono">
                          •••• •••• {b.accountNumber ? b.accountNumber.slice(-4) : "••••"} ({b.ifscCode || "IFSC missing"})
                        </div>
                      </div>
                      {b.isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                          Active
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-text-muted text-xs p-3 bg-canvas rounded-xl border border-line-soft">
                  No settlement bank accounts configured.
                </div>
              )}
            </section>

            {/* API Keys */}
            <section className="space-y-3">
              <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-blue-600" />
                <span>Configured API Keys ({selectedMerchant.apiKeys?.length || 0})</span>
              </h4>
              <div className="text-xs text-text-muted p-3 bg-canvas rounded-xl border border-line-soft">
                {selectedMerchant.apiKeys?.filter((k) => k.isActive).length || 0} active credentials currently enabled for disbursement.
              </div>
            </section>
          </div>
        )}
      </AdminDrawer>

      {/* Confirmation Modal for Suspension */}
      <AdminModal
        isOpen={suspendModalOpen}
        onClose={() => setSuspendModalOpen(false)}
        title="Suspend Merchant Account"
        description="Are you sure you want to suspend this merchant account? Suspension will immediately revoke all active merchant sessions and block payout processing."
        icon={AlertTriangle}
        iconClassName="text-red-600 bg-red-50 dark:bg-red-950/40"
        footer={
          <>
            <button
              type="button"
              onClick={() => setSuspendModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSuspend}
              disabled={isSuspending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-xs font-semibold transition-colors disabled:opacity-50 press-feedback shadow-sm"
            >
              {isSuspending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Suspending...</span>
                </>
              ) : (
                <span>Confirm Suspension</span>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            Suspension will freeze all outbound disbursement requests and revoke merchant API keys immediately.
          </p>
        </div>
      </AdminModal>
    </div>
  );
}
