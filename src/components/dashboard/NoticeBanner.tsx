"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";

export function NoticeBanner() {
  // No active notices at this time.
  const [open, setOpen] = useState(false);
  if (!open) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-500/25 bg-blue-50/70 px-4 py-3">
      <Info className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" strokeWidth={2} />
      <p className="text-[13px] text-text-primary leading-relaxed">
        <span className="font-medium">Welcome to PayERupee —</span> Your dashboard is now active.
      </p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Dismiss notice"
        className="ml-auto text-blue-600/70 hover:text-blue-600 transition-colors press-feedback"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
