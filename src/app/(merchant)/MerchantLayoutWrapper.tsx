"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/merchant/sidebar";
import { TopNav } from "@/components/merchant/top-nav";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import React from "react";
import "@/components/dashboard/dashboard.css";

export function MerchantLayoutWrapper({
  children,
  user,
}: {
  children: React.ReactNode;
  user: any;
}) {
  const pathname = usePathname();

  if (pathname === "/dashboard" || pathname === '/wallet' || pathname === '/transactions' || pathname.startsWith('/developers') || pathname.startsWith('/settings/security') || pathname.startsWith('/settings/profile') || pathname.startsWith('/settings/bans')) {
    // Phase 1: Dashboard page content is wrapped by DashboardShell.
    // We wrap it in the theme scope so globals don't leak.
    // Use flex layout to ensure the canvas background stretches seamlessly
    return (
      <div className="dashboard-theme flex-1 flex flex-col min-w-0 min-h-[100dvh]">
        <DashboardShell>
          {children}
        </DashboardShell>
      </div>
    );
  }

  // Legacy layout for /settings/notifications
  return (
    <div className="flex min-h-[100dvh] bg-canvas font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-[100dvh]">
        {user && <TopNav user={user} />}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
