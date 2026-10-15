"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  WalletCards,
  ArrowLeftRight,
  Plug,
  ShieldCheck,
  CircleUserRound,
  QrCode,
  X,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { NAVIGATION_GROUPS as groups } from '@/config/navigation';

// Breakpoints used across this component:
//  < 768px  (mobile)   — sidebar hidden, opens as a full overlay drawer
//  768–1023 (tablet)   — collapsed icon-only rail, always visible, no labels
//  >= 1024  (laptop+)  — full sidebar by default, but the user can manually
//                        collapse it to the same icon-only rail via the
//                        toggle handle on its right edge (collapsed prop)

export function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapse,
}: {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  // Labels/section-headers/footer are visible on mobile (full drawer) and
  // on laptop+ unless the user collapsed it; always hidden on the tablet
  // rail, which has no manual override.
  const showLabels = cn("md:hidden", collapsed ? "lg:hidden" : "lg:inline");
  const showBlock = cn("md:hidden", collapsed ? "lg:hidden" : "lg:block");

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar-bg border-r border-sidebar-border",
        "fixed inset-y-0 left-0 z-40 transition-all duration-200 ease-out",
        "w-64 md:w-[76px]",
        collapsed ? "lg:w-[76px]" : "lg:w-64",
        "md:translate-x-0 md:shadow-none",
        open
          ? "translate-x-0 shadow-[12px_0_32px_-8px_rgba(8,15,30,0.28)]"
          : "-translate-x-full pointer-events-none md:pointer-events-auto"
      )}
    >
      {/* Laptop+ collapse/expand handle, floats on the sidebar's edge */}
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

      <div
        className={cn(
          "flex items-center justify-between px-6 md:px-0 md:justify-center h-16 border-b border-sidebar-border shrink-0",
          collapsed ? "lg:px-0 lg:justify-center" : "lg:px-6 lg:justify-between"
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center shadow-[0_4px_14px_-4px_rgba(21,94,239,0.5)]">
            <QrCode className="h-4 w-4 text-white" strokeWidth={2.25} />
          </div>
          <span className={cn("font-display text-[17px] font-medium tracking-tight text-sidebar-text-active", showLabels)}>
            PayERupee
          </span>
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

      <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-6 space-y-7">
        {groups.map((group) => (
          <div key={group.label || "root"}>
            {group.label && (
              <p className={cn("px-3 mb-2 text-[11px] font-medium text-sidebar-section-label", showBlock)}>
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    title={item.label}
                    className={cn(
                      "group w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] transition-colors",
                      "md:justify-center",
                      collapsed ? "lg:justify-center" : "lg:justify-start",
                      active
                        ? "bg-sidebar-active-bg text-sidebar-text-active"
                        : "text-sidebar-text hover:text-sidebar-text-active hover:bg-sidebar-active-bg/60"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-[17px] w-[17px] shrink-0",
                        active
                          ? "text-sidebar-icon-active"
                          : "text-sidebar-icon group-hover:text-sidebar-icon-active"
                      )}
                      strokeWidth={1.75}
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

      <div className={cn("p-3 border-t border-sidebar-border shrink-0", showBlock)}>
        <div className="rounded-xl bg-sidebar-footer-bg p-3.5">
          <p className="text-[12.5px] text-sidebar-text-active font-medium">System status</p>
          <p className="text-[12px] text-sidebar-text mt-1 leading-relaxed">
            API endpoints are operating normally.
          </p>
        </div>
      </div>
    </aside>
  );
}
