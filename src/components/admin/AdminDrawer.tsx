"use client";

import { useEffect, useState, useRef, useCallback, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { lockScroll, unlockScroll } from "@/lib/scroll-lock";

const emptySubscribe = () => () => {};

export interface AdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string | React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "md" | "lg" | "xl";
  ariaLabel?: string;
}

export function AdminDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footer,
  width = "lg",
  ariaLabel,
}: AdminDrawerProps) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [closing, setClosing] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // 1. Smooth exit transition
  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 250);
  }, [onClose]);

  // 2. Body scroll lock and Escape key handling
  useEffect(() => {
    if (!isOpen) return;

    lockScroll();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      unlockScroll();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleClose]);

  if (!mounted || (!isOpen && !closing)) {
    return null;
  }

  const widthClasses = {
    md: "sm:w-[480px]",
    lg: "sm:w-[600px]",
    xl: "sm:w-[720px]",
  }[width];

  const drawerContent = (
    <div className="dashboard-theme !bg-transparent pointer-events-none">
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-[#0f172a]/40 backdrop-blur-[6px] transition-opacity duration-300 ease-out pointer-events-auto",
          closing ? "opacity-0" : "opacity-100"
        )}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer Shell */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === "string" ? title : "Detail Panel")}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "pointer-events-auto fixed z-50 flex flex-col bg-white dark:bg-[#0e1420] shadow-2xl border border-line overflow-hidden transition-transform duration-300 ease-out",
          // Mobile: bottom sheet
          "bottom-0 left-0 right-0 top-[10%] rounded-t-[20px]",
          // Desktop (sm+): floating card matching /transactions
          "sm:inset-y-4 sm:right-4 sm:left-auto sm:h-auto sm:max-w-full sm:rounded-[18px]",
          widthClasses,
          closing
            ? "translate-y-full sm:translate-y-0 sm:translate-x-full"
            : "translate-y-0 sm:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 shrink-0 flex items-center justify-between px-6 py-4 bg-white/95 dark:bg-[#0e1420]/95 backdrop-blur-sm border-b border-line-soft gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-text-primary tracking-tight font-display truncate">
              {title}
            </h3>
            {subtitle && (
              <div className="text-[13px] text-text-muted mt-0.5 truncate">
                {subtitle}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {badge}
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close detail panel"
              className="p-1.5 rounded-md text-text-secondary hover:bg-line-soft hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-6 text-xs text-text-secondary">
          {children}
        </div>

        {/* Footer (Always stays docked and reachable) */}
        {footer ? (
          <div className="shrink-0 px-6 py-4 border-t border-line-soft bg-[#f5f8fc]/60 dark:bg-[#070b14]/60 flex items-center justify-end gap-3">
            {footer}
          </div>
        ) : (
          <div className="shrink-0 px-6 py-4 border-t border-line-soft bg-[#f5f8fc]/60 dark:bg-[#070b14]/60 flex items-center justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl border border-line bg-white dark:bg-[#0e1420] text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Custom scrollbar style injection */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(0,0,0,0.1);
          border-radius: 20px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: rgba(0,0,0,0.2);
        }
      `}} />
    </div>
  );

  return createPortal(drawerContent, document.body);
}
