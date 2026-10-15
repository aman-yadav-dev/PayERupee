"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatNumber } from "@/lib/utils";
import { useDashboardFilters } from "./useDashboardFilters";

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { color: string } }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-[var(--shadow-pop)] text-[12.5px]">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.payload.color }} />
        <span className="text-text-secondary">{d.name}</span>
      </div>
      <p className="font-medium text-text-primary tabular-nums mt-0.5">{formatNumber(d.value)}</p>
    </div>
  );
}

interface StatusItem {
  name: string;
  value: number;
  color: string;
}

export function StatusDonut() {
  const filters = useDashboardFilters();
  const [statusDistribution, setStatusDistribution] = useState<StatusItem[]>([]);
  const [total, setTotal] = useState(0);
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
        
        if (mounted && json.success && json.data.statusCounts) {
          const counts = json.data.statusCounts;
          const mapped = [
            { name: "Completed", value: counts.SUCCESS || 0, color: "var(--blue-600)" },
            { name: "Processing", value: counts.PROCESSING || 0, color: "var(--blue-400)" },
            { name: "Pending", value: counts.PENDING || 0, color: "var(--amber-500)" },
            { name: "Failed", value: counts.FAILED || 0, color: "var(--coral-500)" },
            { name: "Reversed", value: counts.REVERSED || 0, color: "var(--neutral-500)" },
          ].filter(d => d.value > 0);
          
          setStatusDistribution(mapped);
          setTotal(json.data.totalMonthCount || 0);
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

  if (isLoading) {
    return <div className="h-[220px] w-full flex items-center justify-center"><span className="opacity-50">Loading...</span></div>;
  }

  if (total === 0 || statusDistribution.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[220px] text-text-muted text-[13px]">
        No transactions this month
      </div>
    );
  }

  const successItem = statusDistribution.find((d) => d.name === "Completed");
  const successPct = successItem ? Math.round((successItem.value / total) * 100) : 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={statusDistribution}
              dataKey="value"
              nameKey="name"
              innerRadius={68}
              outerRadius={92}
              paddingAngle={3}
              stroke="none"
              cornerRadius={4}
            >
              {statusDistribution.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-display text-[24px] font-medium text-text-primary tabular-nums">
            {successPct}%
          </span>
          <span className="text-[11px] text-text-muted">completed</span>
        </div>
      </div>

      <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2.5 mt-2">
        {statusDistribution.map((d) => (
          <div key={d.name} className="flex items-center gap-2 min-w-0">
            <span
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: d.color }}
            />
            <span className="text-[12px] text-text-secondary truncate">{d.name}</span>
            <span className="text-[12px] font-medium text-text-primary tabular-nums ml-auto">
              {formatNumber(d.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
