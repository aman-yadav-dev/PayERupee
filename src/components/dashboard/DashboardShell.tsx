"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-full min-w-0 w-full max-w-full bg-canvas overflow-x-clip">
      <Sidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
      />

      {mobileOpen && (
        <div
          className="fixed inset-0 z-[39] bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className={cn("flex-1 flex flex-col min-w-0 w-full max-w-full overflow-x-clip transition-[padding] duration-200", "md:pl-[76px]", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        {children}
      </div>
    </div>
  );
}
