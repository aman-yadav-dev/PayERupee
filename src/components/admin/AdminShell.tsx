"use client";

import { useState } from "react";
import { AdminSidebar, AdminUserContext } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import { cn } from "@/lib/utils";

export function AdminShell({
  user,
  children,
}: {
  user: AdminUserContext;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-full min-w-0 bg-canvas">
      {/* Responsive Admin Sidebar */}
      <AdminSidebar
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        user={user}
      />

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[39] bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Content Area with Responsive Rail Offset */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-[padding] duration-200",
          "md:pl-[76px]",
          collapsed ? "lg:pl-[76px]" : "lg:pl-64"
        )}
      >
        <AdminTopbar onMenuClick={() => setMobileOpen(true)} user={user} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
