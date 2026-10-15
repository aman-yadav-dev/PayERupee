"use client";

import React, { useId } from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdminPaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newSize: number) => void;
  pageSizeOptions?: number[];
  disabled?: boolean;
  itemName?: string;
  className?: string;
}

export function AdminPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  disabled = false,
  itemName = "items",
  className,
}: AdminPaginationProps) {
  const pageSizeSelectId = useId();

  const start = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = totalCount === 0 ? 0 : Math.min(page * pageSize, totalCount);
  const safeTotalPages = Math.max(1, totalPages);

  return (
    <div
      className={cn(
        "bg-surface border-t border-line px-4 py-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4",
        className
      )}
    >
      {/* Left side: Showing summary */}
      <div className="text-xs text-text-muted">
        Showing <span className="font-semibold text-text-primary">{start}</span> to{" "}
        <span className="font-semibold text-text-primary">{end}</span> of{" "}
        <span className="font-semibold text-text-primary">
          {totalCount.toLocaleString()}
        </span>{" "}
        {itemName}
      </div>

      {/* Right side: Page size selector & Page navigation */}
      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-6 w-full sm:w-auto">
        {/* Page size dropdown */}
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <label
              htmlFor={pageSizeSelectId}
              className="text-xs text-text-muted whitespace-nowrap"
            >
              <span className="hidden sm:inline">Rows </span>per page:
            </label>
            <div className="relative inline-flex items-center">
              <select
                id={pageSizeSelectId}
                value={pageSize}
                disabled={disabled}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="appearance-none pl-2.5 pr-7 py-1 text-xs font-medium bg-surface border border-line rounded-lg text-text-primary hover:bg-canvas focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size} className="bg-surface text-text-primary">
                    {size}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
            </div>
          </div>
        )}

        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={disabled || page <= 1}
            aria-label="Previous page"
            className="p-1.5 rounded-lg border border-line bg-surface text-text-secondary hover:bg-canvas hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="text-xs text-text-muted font-medium select-none px-1">
            Page <span className="font-semibold text-text-primary">{page}</span> of{" "}
            <span className="font-semibold text-text-primary">{safeTotalPages}</span>
          </span>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={disabled || page >= totalPages}
            aria-label="Next page"
            className="p-1.5 rounded-lg border border-line bg-surface text-text-secondary hover:bg-canvas hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
