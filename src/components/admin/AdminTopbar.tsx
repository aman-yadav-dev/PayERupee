"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Menu, ShieldCheck, ChevronDown, LogOut } from "lucide-react";
import { AdminUserContext } from "./AdminSidebar";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { useClickOutside } from "@/lib/useClickOutside";
import { authClient } from "@/modules/auth/infrastructure/auth-client";
import { toast } from "sonner";

export function AdminTopbar({
  onMenuClick,
  user,
}: {
  onMenuClick: () => void;
  user: AdminUserContext;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const [currentDate, setCurrentDate] = useState("");

  useEffect(() => {
    setCurrentDate(
      new Date().toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    );
  }, []);

  useClickOutside(profileRef, () => setProfileOpen(false));

  const getSectionTitle = () => {
    if (pathname.includes("/admin/dashboard")) return "Executive Dashboard";
    if (pathname.includes("/admin/merchants")) return "Merchant Accounts";
    if (pathname.includes("/admin/kyc")) return "KYC Review Queue";
    if (pathname.includes("/admin/fund-requests")) return "Add-Funds Requests";
    if (pathname.includes("/admin/withdrawals")) return "Withdrawal Queue";
    if (pathname.includes("/admin/payouts")) return "Payouts & Telemetry";
    if (pathname.includes("/admin/ledger")) return "Double-Entry Ledger";
    if (pathname.includes("/admin/bans")) return "Destination Ban Policy";
    if (pathname.includes("/admin/audit-logs")) return "Audit Trail";
    if (pathname.includes("/admin/settings")) return "Platform Configuration";
    return "Administrative Console";
  };

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      toast.success("Signed out of administrative console.");
      router.push("/admin/login");
    } catch {
      window.location.href = "/admin/login";
    }
  };

  const initials = user.name
    ? user.name.slice(0, 2).toUpperCase()
    : user.email.slice(0, 2).toUpperCase();

  const isProd = process.env.NODE_ENV === "production";

  return (
    <header className="sticky top-0 z-20 h-16 flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 bg-canvas backdrop-blur-sm border-b border-line select-none">
      {/* Left: Mobile Menu & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="md:hidden h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-line bg-surface text-text-secondary press-feedback hover:text-text-primary"
        >
          <Menu className="h-[17px] w-[17px]" strokeWidth={2} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[17px] sm:text-[19px] font-medium tracking-tight text-text-primary truncate">
              {getSectionTitle()}
            </h1>
          </div>
          <p suppressHydrationWarning className="hidden lg:block text-[12px] text-text-muted -mt-0.5 truncate">
            {currentDate ? `${currentDate} · ` : ""}Administrative Console
          </p>
        </div>
      </div>

      {/* Right: Badges, Theme Toggle & Profile Dropdown */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Environment Badge */}
        <span
          className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
            isProd
              ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/40"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isProd ? "bg-red-500" : "bg-emerald-500"
            }`}
          />
          {isProd ? "Production" : "Staging"}
        </span>

        {/* Role Pill */}
        <span className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/40">
          <ShieldCheck className="h-3 w-3" />
          <span>{user.role}</span>
        </span>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Profile Avatar Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((prev) => !prev)}
            aria-label="Admin account menu"
            className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-lg border border-line bg-surface text-text-primary hover:border-blue-500/30 transition-colors press-feedback"
          >
            <div className="h-7 w-7 rounded-md bg-blue-600 text-white flex items-center justify-center font-medium text-[12px] shadow-sm">
              {initials}
            </div>
            <span className="hidden sm:inline text-[13px] font-medium max-w-[120px] truncate">
              {user.name || user.email.split("@")[0]}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)] py-1.5 z-50 animate-pop-in">
              <div className="px-4 py-2 border-b border-line-soft">
                <p className="text-[13px] font-semibold text-text-primary truncate">
                  {user.name || "Administrator"}
                </p>
                <p className="text-[11.5px] text-text-muted truncate">{user.email}</p>
                <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  <ShieldCheck className="h-3 w-3" />
                  <span>{user.role}</span>
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-coral-600 hover:bg-canvas transition-colors text-left"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
