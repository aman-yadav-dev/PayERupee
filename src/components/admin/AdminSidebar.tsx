"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileCheck2,
  CreditCard,
  ArrowDownToLine,
  ArrowLeftRight,
  BookOpen,
  ShieldAlert,
  ScrollText,
  Settings,
  LogOut,
  ShieldCheck,
  ChevronLeft,
  X,
  QrCode,
} from "lucide-react";
import { authClient } from "@/modules/auth/infrastructure/auth-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface AdminUserContext {
  id: string;
  name: string | null;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN";
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const ADMIN_NAVIGATION: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Core Operations",
    items: [
      { label: "Merchants", href: "/admin/merchants", icon: Users },
      { label: "KYC Review", href: "/admin/kyc", icon: FileCheck2 },
      { label: "Fund Requests", href: "/admin/fund-requests", icon: CreditCard },
      { label: "Withdrawals", href: "/admin/withdrawals", icon: ArrowDownToLine },
      { label: "Payouts & Trans.", href: "/admin/payouts", icon: ArrowLeftRight },
    ],
  },
  {
    title: "Ledger & Compliance",
    items: [
      { label: "Ledger Accounts", href: "/admin/ledger", icon: BookOpen },
      { label: "Destination Bans", href: "/admin/bans", icon: ShieldAlert },
      { label: "Audit Trail", href: "/admin/audit-logs", icon: ScrollText },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Administrators", href: "/admin/admins", icon: ShieldCheck },
      { label: "Platform Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

export function AdminSidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
  user,
}: {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  user: AdminUserContext;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const showLabels = cn("md:hidden", collapsed ? "lg:hidden" : "lg:inline");
  const showBlock = cn("md:hidden", collapsed ? "lg:hidden" : "lg:block");

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      toast.success("Signed out of administrative console.");
      router.push("/admin/login");
    } catch {
      window.location.href = "/admin/login";
    }
  };

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar-bg border-r border-sidebar-border",
        "fixed inset-y-0 left-0 z-40 transition-all duration-200 ease-out select-none",
        "w-64 md:w-[76px]",
        collapsed ? "lg:w-[76px]" : "lg:w-64",
        "md:translate-x-0 md:shadow-none",
        open
          ? "translate-x-0 shadow-[12px_0_32px_-8px_rgba(8,15,30,0.28)]"
          : "-translate-x-full"
      )}
    >
      {/* Laptop+ edge collapse toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden lg:flex absolute top-[26px] -right-3 h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-surface text-text-secondary hover:text-blue-600 hover:border-blue-500/40 hover:scale-110 shadow-[var(--shadow-card)] z-10 transition-all press-feedback"
      >
        <ChevronLeft
          className={cn("h-3.5 w-3.5 transition-transform duration-300", collapsed && "rotate-180")}
          strokeWidth={2.25}
        />
      </button>

      {/* Brand Header */}
      <div
        className={cn(
          "flex items-center justify-between px-6 md:px-0 md:justify-center h-16 border-b border-sidebar-border shrink-0",
          collapsed ? "lg:px-0 lg:justify-center" : "lg:px-6 lg:justify-between"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-[0_4px_14px_-4px_rgba(21,94,239,0.5)]">
            <QrCode className="h-4 w-4 text-white" strokeWidth={2.25} />
          </div>
          <div className={cn("flex items-center gap-1.5 truncate", showLabels)}>
            <span className="font-display text-[17px] font-medium tracking-tight text-sidebar-text-active">
              PayERupee
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              Admin
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="md:hidden h-8 w-8 flex items-center justify-center rounded-lg text-sidebar-text hover:text-sidebar-text-active"
        >
          <X className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-6 space-y-6">
        {ADMIN_NAVIGATION.map((section) => (
          <div key={section.title}>
            <p className={cn("px-3 mb-2 text-[11px] font-medium text-sidebar-section-label uppercase tracking-wider", showBlock)}>
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={cn(
                      "group w-full flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors",
                      "md:justify-center",
                      collapsed ? "lg:justify-center" : "lg:justify-start",
                      active
                        ? "bg-sidebar-active-bg text-sidebar-text-active font-medium"
                        : "text-sidebar-text hover:text-sidebar-text-active hover:bg-sidebar-active-bg/60"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-[17px] w-[17px] shrink-0",
                        active
                          ? "text-sidebar-icon-active"
                          : "text-sidebar-icon group-hover:text-sidebar-icon-active"
                      )}
                      strokeWidth={1.8}
                    />
                    <span className={cn("truncate", showLabels)}>{item.label}</span>
                    {active && (
                      <span className={cn("ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-icon-active", showBlock)} />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: User Context & Sign Out */}
      <div className="p-3 border-t border-sidebar-border shrink-0 space-y-2">
        <div className={cn("rounded-xl bg-sidebar-footer-bg p-2.5", showBlock)}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-blue-600/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-400 flex items-center justify-center text-xs font-semibold shrink-0">
              {user.name ? user.name.slice(0, 2).toUpperCase() : "AD"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-sidebar-text-active truncate">
                {user.name || user.email}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3 shrink-0" />
                <span className="font-semibold">{user.role}</span>
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          title="Sign out"
          className={cn(
            "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] font-medium text-sidebar-text hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors",
            "md:justify-center",
            collapsed ? "lg:justify-center" : "lg:justify-start"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          <span className={cn("truncate", showLabels)}>Sign out console</span>
        </button>
      </div>
    </aside>
  );
}
