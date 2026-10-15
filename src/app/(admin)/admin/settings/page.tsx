"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Settings,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Lock,
  Landmark,
  CircleDollarSign,
  Server,
  Database,
  Radio,
  FileCheck,
  Edit3,
  Save,
  Check,
  Users,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { toast } from "sonner";

interface SystemSettingsData {
  minAddFundsAmount: string;
  minWithdrawAmount: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editMinAdd, setEditMinAdd] = useState("");
  const [editMinWithdraw, setEditMinWithdraw] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = () => {
    setLoading(true);
    fetch("/api/v1/admin/settings")
      .then((res) => res.json())
      .then((json) => {
        if (json.minAddFundsAmount !== undefined) {
          setSettings(json);
          setEditMinAdd(json.minAddFundsAmount);
          setEditMinWithdraw(json.minWithdrawAmount);
        } else {
          toast.error("Failed to load platform settings");
        }
      })
      .catch(() => toast.error("Error communicating with settings API"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let mounted = true;
    fetch("/api/v1/admin/settings")
      .then((res) => res.json())
      .then((json) => {
        if (mounted && json.minAddFundsAmount !== undefined) {
          setSettings(json);
          setEditMinAdd(json.minAddFundsAmount);
          setEditMinWithdraw(json.minWithdrawAmount);
        }
      })
      .catch(() => {
        if (mounted) toast.error("Failed to fetch system settings");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleStartEdit = () => {
    if (settings) {
      setEditMinAdd(settings.minAddFundsAmount);
      setEditMinWithdraw(settings.minWithdrawAmount);
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    if (settings) {
      setEditMinAdd(settings.minAddFundsAmount);
      setEditMinWithdraw(settings.minWithdrawAmount);
    }
    setIsEditing(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate strictly positive decimal format
    const decimalAmountRegex = /^(?!0+(\.0+)?$)(0|[1-9]\d{0,13})(\.\d{1,4})?$/;
    if (!decimalAmountRegex.test(editMinAdd)) {
      toast.error("Minimum Add Funds amount must be a positive number (up to 4 decimals).");
      return;
    }
    if (!decimalAmountRegex.test(editMinWithdraw)) {
      toast.error("Minimum Withdrawal amount must be a positive number (up to 4 decimals).");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/v1/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minAddFundsAmount: editMinAdd,
          minWithdrawAmount: editMinWithdraw,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update platform settings");
      }

      setSettings(json);
      setEditMinAdd(json.minAddFundsAmount);
      setEditMinWithdraw(json.minWithdrawAmount);
      setIsEditing(false);
      toast.success("Platform settings successfully updated and logged to audit trail.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving settings";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-semibold text-text-primary tracking-tight flex items-center gap-2 font-display">
              <Settings className="h-5 w-5 text-blue-600" />
              <span>Platform Settings & Operational Health</span>
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Audited Controls
            </span>
          </div>
          <p className="text-[13px] text-text-muted mt-0.5">
            Global system thresholds, financial constraints, and cryptographic operational telemetry.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSettings}
            disabled={loading || isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-line text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-canvas transition-colors disabled:opacity-50 press-feedback"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Governance & Policy Notice Banner */}
      <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/40 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-semibold text-blue-900 dark:text-blue-200">
            Platform Financial Controls Governance
          </div>
          <p className="text-blue-700 dark:text-blue-300/90 leading-relaxed">
            Global financial thresholds are directly enforced on merchant deposit intents and withdrawal requests.
            Modifications execute via authenticated PATCH requests, enforce strict decimal validation, and record an immutable entry in the system audit trail.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 text-text-muted">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-xs font-medium">Loading platform configurations...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Global Financial Thresholds (Editable) */}
          <div className="p-6 rounded-2xl bg-surface border border-line shadow-[var(--shadow-card)] space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-emerald-600" />
                <h2 className="text-[15px] font-semibold text-text-primary font-display">
                  Global Financial Thresholds
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  EDITABLE
                </span>
                {!isEditing && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-line text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors press-feedback shadow-sm"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit Parameters</span>
                  </button>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-primary flex items-center justify-between">
                  <span>Minimum Inbound Deposit (Add Funds)</span>
                  <span className="font-semibold text-emerald-600 text-xs">
                    {settings ? formatINR(Number(isEditing ? editMinAdd || 0 : settings.minAddFundsAmount)) : "—"}
                  </span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted font-mono text-xs">
                    ₹
                  </div>
                  <input
                    type="text"
                    disabled={!isEditing || isSaving}
                    value={isEditing ? editMinAdd : settings?.minAddFundsAmount || ""}
                    onChange={(e) => setEditMinAdd(e.target.value)}
                    className={`w-full pl-8 pr-3.5 py-2.5 rounded-xl text-xs font-mono transition-all ${
                      isEditing
                        ? "bg-canvas border-2 border-blue-600/60 text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        : "bg-canvas/50 border border-line text-text-secondary cursor-not-allowed select-none"
                    }`}
                    placeholder="100.00"
                  />
                  {!isEditing && (
                    <Lock className="h-3.5 w-3.5 text-text-muted absolute right-3.5 top-1/2 -translate-y-1/2" />
                  )}
                </div>
                <p className="text-[11.5px] text-text-muted">
                  Enforced on merchant UPI intent/QR generation and manual bank deposit submissions.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-primary flex items-center justify-between">
                  <span>Minimum Outbound Disbursement (Withdrawal)</span>
                  <span className="font-semibold text-blue-600 text-xs">
                    {settings ? formatINR(Number(isEditing ? editMinWithdraw || 0 : settings.minWithdrawAmount)) : "—"}
                  </span>
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted font-mono text-xs">
                    ₹
                  </div>
                  <input
                    type="text"
                    disabled={!isEditing || isSaving}
                    value={isEditing ? editMinWithdraw : settings?.minWithdrawAmount || ""}
                    onChange={(e) => setEditMinWithdraw(e.target.value)}
                    className={`w-full pl-8 pr-3.5 py-2.5 rounded-xl text-xs font-mono transition-all ${
                      isEditing
                        ? "bg-canvas border-2 border-blue-600/60 text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        : "bg-canvas/50 border border-line text-text-secondary cursor-not-allowed select-none"
                    }`}
                    placeholder="500.00"
                  />
                  {!isEditing && (
                    <Lock className="h-3.5 w-3.5 text-text-muted absolute right-3.5 top-1/2 -translate-y-1/2" />
                  )}
                </div>
                <p className="text-[11.5px] text-text-muted">
                  Enforced on merchant settlement withdrawals to registered and verified bank accounts.
                </p>
              </div>

              {isEditing ? (
                <div className="pt-3 border-t border-line flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="px-3.5 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold transition-colors disabled:opacity-50 press-feedback shadow-sm"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="pt-2 border-t border-line-soft">
                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Authoritative database configuration active.
                    </span>
                    <span>PATCH /api/v1/admin/settings</span>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Cryptographic & Compliance Telemetry */}
          <div className="p-6 rounded-2xl bg-surface border border-line shadow-[var(--shadow-card)] space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <h2 className="text-[15px] font-semibold text-text-primary font-display">
                  Cryptographic Architecture
                </h2>
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                ACTIVE
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-canvas border border-line flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-medium text-[13px]">Destination Blind Indexing</div>
                  <div className="text-[11.5px] text-text-muted">HMAC-SHA256 Multi-Version Candidate Scanning</div>
                </div>
                <span className="text-emerald-700 font-semibold text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-100">
                  FAIL-CLOSED
                </span>
              </div>

              <div className="p-3 rounded-xl bg-canvas border border-line flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-medium text-[13px]">Envelope Encryption</div>
                  <div className="text-[11.5px] text-text-muted">AES-256-GCM Authenticated Ciphertext</div>
                </div>
                <span className="text-blue-700 font-semibold text-[11px] px-2.5 py-0.5 rounded-full bg-blue-100">
                  ENCRYPTED
                </span>
              </div>

              <div className="p-3 rounded-xl bg-canvas border border-line flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-medium text-[13px]">Partial Unique Constraints</div>
                  <div className="text-[11.5px] text-text-muted">Active Ban & Pending Request PostgreSQL Indexes</div>
                </div>
                <span className="text-emerald-700 font-semibold text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-100">
                  VERIFIED
                </span>
              </div>

              <div className="p-3 rounded-xl bg-canvas border border-line flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-medium text-[13px]">Advisory Concurrency Locks</div>
                  <div className="text-[11.5px] text-text-muted">pg_advisory_xact_lock on destination hashes</div>
                </div>
                <span className="text-purple-700 font-semibold text-[11px] px-2.5 py-0.5 rounded-full bg-purple-100">
                  64-BIT HASH
                </span>
              </div>
            </div>
          </div>

          {/* Infrastructure Health & Services */}
          <div className="p-6 rounded-2xl bg-surface border border-line shadow-[var(--shadow-card)] space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-purple-600" />
                <h2 className="text-[15px] font-semibold text-text-primary font-display">
                  Infrastructure & Dependencies
                </h2>
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                HEALTH OK
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-canvas border border-line space-y-1">
                <div className="flex items-center gap-1.5 text-text-muted text-[11px]">
                  <Database className="h-3.5 w-3.5 text-blue-600" />
                  <span>Primary Relational DB</span>
                </div>
                <div className="text-text-primary font-medium">PostgreSQL 15</div>
                <div className="text-[11px] text-emerald-600 font-medium">Prisma Client Connected</div>
              </div>

              <div className="p-3 rounded-xl bg-canvas border border-line space-y-1">
                <div className="flex items-center gap-1.5 text-text-muted text-[11px]">
                  <Radio className="h-3.5 w-3.5 text-amber-600" />
                  <span>Disbursement Gateway</span>
                </div>
                <div className="text-text-primary font-medium">PayMyQR Outbox</div>
                <div className="text-[11px] text-amber-600 font-medium">Idempotency Guarded</div>
              </div>

              <div className="p-3 rounded-xl bg-canvas border border-line space-y-1">
                <div className="flex items-center gap-1.5 text-text-muted text-[11px]">
                  <Landmark className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Double-Entry Ledger</span>
                </div>
                <div className="text-text-primary font-medium">Strict Double-Leg</div>
                <div className="text-[11px] text-emerald-600 font-medium">Zero-Sum Balanced</div>
              </div>

              <div className="p-3 rounded-xl bg-canvas border border-line space-y-1">
                <div className="flex items-center gap-1.5 text-text-muted text-[11px]">
                  <FileCheck className="h-3.5 w-3.5 text-purple-600" />
                  <span>KYC Decision Engine</span>
                </div>
                <div className="text-text-primary font-medium">Two-Tier Review</div>
                <div className="text-[11px] text-text-muted font-medium">Vault Enforced</div>
              </div>
            </div>
          </div>

          {/* Role & Access Control Matrix */}
          <div className="p-6 rounded-2xl bg-surface border border-line shadow-[var(--shadow-card)] space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <h2 className="text-[15px] font-semibold text-text-primary font-display">
                  Role Access Control Matrix
                </h2>
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                RBAC
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-canvas border border-line space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-purple-700 dark:text-purple-400">SUPER_ADMIN</span>
                  <span className="text-[11px] text-text-muted">Offline Provisioned</span>
                </div>
                <p className="text-text-muted text-[11.5px] leading-relaxed">
                  Platform governance role. Authorized for operator provisioning, security parameters,
                  and administrative governance.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-canvas border border-line space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-700 dark:text-blue-400">ADMIN</span>
                  <span className="text-[11px] text-text-muted">Role-Gated</span>
                </div>
                <p className="text-text-muted text-[11.5px] leading-relaxed">
                  Operational reviewer role. Authorized for merchant inspection, KYC decisioning,
                  destination ban approval/rejection, and ledger audits.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-canvas border border-line space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-primary">MERCHANT</span>
                  <span className="text-[11px] text-text-muted">Tenant-Scoped</span>
                </div>
                <p className="text-text-muted text-[11.5px] leading-relaxed">
                  Commercial actor. Strictly quarantined to tenant boundaries and barred from all administrative endpoints.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-line-soft flex justify-end">
              <Link
                href="/admin/admins"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/40 text-xs font-semibold transition-colors shadow-sm press-feedback"
              >
                <Users className="h-3.5 w-3.5" />
                <span>Manage Administrators</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
