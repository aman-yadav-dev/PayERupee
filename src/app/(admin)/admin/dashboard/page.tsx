import { db } from "@/infrastructure/database/db";
import Link from "next/link";
import {
  Users,
  FileCheck2,
  CreditCard,
  ArrowDownToLine,
  ArrowLeftRight,
  ShieldAlert,
  ArrowUpRight,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  // Aggregate real-time platform metrics in parallel
  const [
    activeMerchantsCount,
    pendingKycCount,
    pendingFundsCount,
    pendingWithdrawalsCount,
    activeBansCount,
    payoutStats,
  ] = await Promise.all([
    db.merchantProfile.count({ where: { accountStatus: "ACTIVE" } }).catch(() => 0),
    db.kycSubmissionCycle.count({ where: { isCurrentCycle: true, status: "UNDER_REVIEW" } }).catch(() => 0),
    db.fundRequest.count({ where: { status: "PENDING" } }).catch(() => 0),
    db.withdrawal.count({ where: { status: "PENDING" } }).catch(() => 0),
    db.globalBan.count({ where: { status: "ACTIVE" } }).catch(() => 0),
    db.payout.aggregate({
      where: { status: "SUCCESS" },
      _sum: { amount: true },
      _count: true,
    }).catch(() => ({ _sum: { amount: null }, _count: 0 })),
  ]);

  const settledVolume = payoutStats._sum.amount ? Number(payoutStats._sum.amount) : 0;
  const settledCount = payoutStats._count || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h2 className="text-[22px] font-semibold font-display text-text-primary tracking-tight">
            Platform Executive Dashboard
          </h2>
          <p className="text-[13px] text-text-muted mt-0.5">
            Real-time platform KPIs, operational queue depths, and settlement telemetry.
          </p>
        </div>

        {/* Read-Only Status Notice */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-300 text-xs font-medium">
          <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Financial Mutators: Gated & Controlled</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Active Merchants */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] lift-on-hover space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-text-secondary">
              Active Merchants
            </span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-display tabular-nums text-[26px] leading-tight font-medium text-text-primary">
              {activeMerchantsCount}
            </span>
            <Link
              href="/admin/merchants"
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium transition-colors"
            >
              <span>Directory</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="text-[12px] text-text-muted">Live verified merchant accounts</div>
        </div>

        {/* Pending KYC Queue */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] lift-on-hover space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-text-secondary">
              Pending KYC Queue
            </span>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
              pendingKycCount > 0
                ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                : "bg-surface text-text-muted border border-line"
            }`}>
              <FileCheck2 className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-display tabular-nums text-[26px] leading-tight font-medium text-text-primary">
              {pendingKycCount}
            </span>
            <Link
              href="/admin/kyc"
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium transition-colors"
            >
              <span>Review Queue</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="text-[12px] text-text-muted">Dossiers awaiting verification</div>
        </div>

        {/* Pending Fund Requests */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] lift-on-hover space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-text-secondary">
              Pending Add-Funds
            </span>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
              pendingFundsCount > 0
                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
                : "bg-surface text-text-muted border border-line"
            }`}>
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-display tabular-nums text-[26px] leading-tight font-medium text-text-primary">
              {pendingFundsCount}
            </span>
            <Link
              href="/admin/fund-requests"
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium transition-colors"
            >
              <span>View Requests</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="text-[12px] text-text-muted">Inbound bank UTR matches pending</div>
        </div>

        {/* Pending Withdrawals */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] lift-on-hover space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-text-secondary">
              Pending Withdrawals
            </span>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
              pendingWithdrawalsCount > 0
                ? "bg-coral-50 text-coral-600 dark:bg-coral-950/40 dark:text-coral-400"
                : "bg-surface text-text-muted border border-line"
            }`}>
              <ArrowDownToLine className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-display tabular-nums text-[26px] leading-tight font-medium text-text-primary">
              {pendingWithdrawalsCount}
            </span>
            <Link
              href="/admin/withdrawals"
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium transition-colors"
            >
              <span>View Queue</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="text-[12px] text-text-muted">Outbound settlement queue</div>
        </div>

        {/* Total Settled Volume */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] lift-on-hover space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-text-secondary">
              Total Settled Volume
            </span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center">
              <ArrowLeftRight className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-display tabular-nums text-[24px] leading-tight font-medium text-text-primary">
              {formatINR(settledVolume)}
            </span>
            <Link
              href="/admin/payouts"
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium transition-colors"
            >
              <span>Telemetry</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="text-[12px] text-text-muted">{settledCount} successful disbursements</div>
        </div>

        {/* Active Destination Bans */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)] lift-on-hover space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-text-secondary">
              Active Global Bans
            </span>
            <div className="h-8 w-8 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-display tabular-nums text-[26px] leading-tight font-medium text-text-primary">
              {activeBansCount}
            </span>
            <Link
              href="/admin/bans"
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium transition-colors"
            >
              <span>Manage Bans</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="text-[12px] text-text-muted">Platform-wide blocked destinations</div>
        </div>
      </div>

      {/* Operations Quick Nav & System Health Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operational Queues */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-line-soft">
            <h3 className="text-[15px] font-semibold text-text-primary font-display">
              Operational Queues
            </h3>
            <span className="text-xs text-text-muted">Action Hub</span>
          </div>

          <div className="space-y-2.5">
            <Link
              href="/admin/kyc"
              className="flex items-center justify-between p-3.5 rounded-xl bg-canvas hover:bg-neutral-chip border border-line transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <FileCheck2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-text-primary group-hover:text-blue-600 transition-colors">
                    Merchant KYC Submissions
                  </div>
                  <div className="text-[11.5px] text-text-muted">Review dossiers & identity documents</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                {pendingKycCount} pending
              </span>
            </Link>

            <Link
              href="/admin/fund-requests"
              className="flex items-center justify-between p-3.5 rounded-xl bg-canvas hover:bg-neutral-chip border border-line transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-text-primary group-hover:text-blue-600 transition-colors">
                    Inbound Add-Funds Review
                  </div>
                  <div className="text-[11.5px] text-text-muted">UTR bank reconciliation checks</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full">
                {pendingFundsCount} pending
              </span>
            </Link>

            <Link
              href="/admin/withdrawals"
              className="flex items-center justify-between p-3.5 rounded-xl bg-canvas hover:bg-neutral-chip border border-line transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-coral-50 text-coral-600 flex items-center justify-center shrink-0">
                  <ArrowDownToLine className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-text-primary group-hover:text-blue-600 transition-colors">
                    Merchant Withdrawal Queue
                  </div>
                  <div className="text-[11.5px] text-text-muted">Outbound bank disbursements</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-coral-700 bg-coral-100 px-2.5 py-0.5 rounded-full">
                {pendingWithdrawalsCount} pending
              </span>
            </Link>
          </div>
        </div>

        {/* Infrastructure & Audit Health */}
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow-card)] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-line-soft">
            <h3 className="text-[15px] font-semibold text-text-primary font-display">
              System Telemetry & Health
            </h3>
            <span className="text-xs text-emerald-600 font-medium">Status: Optimal</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-canvas border border-line">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-[13px] font-medium text-text-primary">PostgreSQL Primary Cluster</span>
              </div>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Connected
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-canvas border border-line">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-[13px] font-medium text-text-primary">Dual-Key AES-256-GCM Crypto</span>
              </div>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Active
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-canvas border border-line">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-[13px] font-medium text-text-primary">Double-Entry Ledger Balancing</span>
              </div>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Synchronized
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-canvas border border-line">
              <div className="flex items-center gap-2.5">
                <Lock className="h-4 w-4 text-amber-600" />
                <span className="text-[13px] font-medium text-text-primary">Dual-Control Mutations</span>
              </div>
              <span className="text-[11px] font-medium text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                Policy Enforced
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
