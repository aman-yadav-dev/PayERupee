"use client";

import React, { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { lockScroll, unlockScroll } from "@/lib/scroll-lock";

const emptySubscribe = () => () => {};

export interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: LucideIcon | React.ReactNode;
  iconClassName?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  bodyClassName?: string;
}

const maxWidthMap: Record<NonNullable<AdminModalProps["maxWidth"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

export function AdminModal({
  isOpen,
  onClose,
  title,
  description,
  icon,
  iconClassName,
  children,
  footer,
  maxWidth = "md",
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className,
  bodyClassName,
}: AdminModalProps) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const titleId = useId();
  const descId = useId();
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus management: focus modal on mount and restore focus on unmount
  useEffect(() => {
    if (!isOpen) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();

    return () => {
      previousActiveElement?.focus?.();
    };
  }, [isOpen]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeOnEscape, onClose]);

  // Prevent background scroll
  useEffect(() => {
    if (!isOpen) return;

    lockScroll();

    return () => {
      unlockScroll();
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  const renderIconBlock = () => {
    if (!icon) return null;

    if (React.isValidElement(icon)) {
      return (
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-blue-600 bg-blue-50 dark:bg-blue-950/40 border border-line-soft",
            iconClassName
          )}
        >
          {icon}
        </div>
      );
    }

    if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
      const IconComponent = icon as LucideIcon;
      return (
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-blue-600 bg-blue-50 dark:bg-blue-950/40 border border-line-soft",
            iconClassName
          )}
        >
          <IconComponent className="w-4 h-4" />
        </div>
      );
    }

    return null;
  };

  const modalContent = (
    <div className="dashboard-theme !bg-transparent pointer-events-none">
      {/* 1. Translucent Dark Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-[#0f172a]/40 backdrop-blur-[6px] animate-in fade-in duration-200 pointer-events-auto"
        onClick={() => {
          if (closeOnBackdropClick) {
            onClose();
          }
        }}
        aria-hidden="true"
      />

      {/* 2. Modal Positioning Wrapper */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none overflow-y-auto">
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "pointer-events-auto w-full max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] bg-white dark:bg-[#0e1420] border border-line text-text-primary rounded-[18px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 outline-none flex flex-col my-auto",
            maxWidthMap[maxWidth],
            className
          )}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-line-soft flex items-center justify-between shrink-0 bg-white/95 dark:bg-[#0e1420]/95 backdrop-blur-sm gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {renderIconBlock()}
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="text-[15px] font-semibold text-text-primary tracking-tight font-display break-words"
                >
                  {title}
                </h2>
                {description && (
                  <p
                    id={descId}
                    className="text-[13px] text-text-muted mt-0.5 leading-relaxed break-words"
                  >
                    {description}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-md text-text-secondary hover:bg-line-soft hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content */}
          <div className={cn("flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-4", bodyClassName)}>
            {children}
          </div>

          {/* Docked Footer (if provided) */}
          {footer && (
            <div className="px-6 py-4 border-t border-line-soft bg-[#f5f8fc]/60 dark:bg-[#070b14]/60 flex items-center justify-end gap-3 shrink-0">
              {footer}
            </div>
          )}
        </div>
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

  return createPortal(modalContent, document.body);
}
