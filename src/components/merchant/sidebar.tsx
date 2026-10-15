
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Receipt, Code2, LogOut, Settings, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const pathname = usePathname();
  
  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Transactions", href: "/transactions", icon: Receipt },
    { name: "API Keys", href: "/developers/api-keys", icon: Code2 },
    { name: "Bans", href: "/settings/bans", icon: ShieldAlert },
    { name: "Settings", href: "/settings/profile", icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/v1/auth/sign-out", { method: "POST" });
      window.location.href = "/login";
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <aside className="w-64 border-r border-slate-200 bg-white hidden md:flex flex-col h-full shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-slate-200 shrink-0">
        <h1 className="font-bold text-xl text-slate-900 tracking-tight">PayERupee</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider px-2">Menu</div>
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
            >
              <Icon className="w-4 h-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-200 shrink-0">
        <Button variant="ghost" className="w-full justify-start text-slate-600 hover:text-slate-900" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
