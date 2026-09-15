
"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TopNav({ user }: { user: any }) {
  return (
    <header className="h-16 shrink-0 border-b border-slate-200 bg-white flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="md:hidden text-slate-600 -ml-2">
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="font-bold text-lg text-slate-900 tracking-tight md:hidden">PayERupee</h1>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="px-2.5 py-1 text-[10px] sm:text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200">
          LIVE
        </span>
        <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
            {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase()}
          </div>
          <div className="text-sm text-slate-700 font-medium truncate max-w-[150px]">
            {user?.name || user?.email}
          </div>
        </div>
      </div>
    </header>
  );
}
