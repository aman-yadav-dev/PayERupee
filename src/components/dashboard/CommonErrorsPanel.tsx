"use client";

import { useEffect, useState, CSSProperties } from "react";
import { useDashboardFilters } from "./useDashboardFilters";

interface CommonError {
  code: string;
  message: string;
  occurrences: number;
  percentage: number;
}

export function CommonErrorsPanel() {
  const filters = useDashboardFilters();
  const [commonErrors, setCommonErrors] = useState<CommonError[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      setIsLoading(true);
      try {
        let url = "/api/v1/merchant/wallet";
        const params = new URLSearchParams();
        if (filters.status && filters.status !== "All statuses") {
          const mapped = filters.status === "Completed" ? "SUCCESS" : filters.status === "Pending" ? "PENDING" : filters.status === "Failed" ? "FAILED" : "";
          if (mapped) params.set("status", mapped);
        }
        if (filters.startDate) params.set("startDate", filters.startDate);
        if (filters.endDate) params.set("endDate", filters.endDate);
        if (filters.minAmount !== undefined) params.set("minAmount", String(filters.minAmount));
        if (filters.maxAmount !== undefined) params.set("maxAmount", String(filters.maxAmount));
        
        const qs = params.toString();
        if (qs) url += `?${qs}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        
        if (mounted && json.success && Array.isArray(json.data.commonErrors)) {
          setCommonErrors(json.data.commonErrors);
        }
      } catch (err) {
        // silently ignore error and leave empty
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    fetchData();
    return () => { mounted = false; };
  }, [filters]);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 h-full">
      <h3 className="font-display text-[15px] font-medium text-text-primary">
        Common failure reasons
      </h3>
      <p className="text-[12px] text-text-muted mt-0.5">
        Grouped from the last 30 days of declined transactions
      </p>

      {isLoading ? (
        <div className="mt-8 flex items-center justify-center">
          <span className="opacity-50 text-[13px]">Loading...</span>
        </div>
      ) : commonErrors.length === 0 ? (
        <div className="mt-8 flex items-center justify-center text-text-muted text-[13px]">
          No failed transactions recorded
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {commonErrors.map((e, i) => (
            <div key={e.code || i}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] text-text-secondary leading-snug">{e.message || "Unknown error"}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="h-1.5 flex-1 rounded-full bg-line-soft overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600 animate-grow-width"
                        style={
                          {
                            "--bar-w": `${e.percentage}%`,
                            animationDelay: `${950 + i * 90}ms`,
                          } as CSSProperties
                        }
                      />
                    </div>
                    <span className="text-[11.5px] text-text-muted tabular-nums w-16 text-right shrink-0">
                      {e.occurrences} &middot; {e.percentage}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
