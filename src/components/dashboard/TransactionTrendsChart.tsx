"use client";

import { useEffect, useState } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatINR } from "@/lib/utils";
import { useDashboardFilters } from "./useDashboardFilters";

interface TrendPoint {
  date: string;
  total: number;
  successful: number;
  amount: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3 shadow-[var(--shadow-pop)] text-[12.5px]">
      <p className="mb-2 font-medium text-text-primary">{label}</p>
      <div className="flex flex-col gap-1.5">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-text-secondary">{entry.name}</span>
            </div>
            <span className="font-medium text-text-primary tabular-nums">
              {entry.name.includes("Amount")
                ? formatINR(entry.value)
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TransactionTrendsChart() {
  const filters = useDashboardFilters();
  const [data, setData] = useState<TrendPoint[]>([]);
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
        
        if (mounted && json.success && Array.isArray(json.data.trendData)) {
          setData(json.data.trendData);
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
    return <div className="h-[320px] w-full flex items-center justify-center"><span className="opacity-50">Loading...</span></div>;
  }

  if (data.length === 0) {
    return (
      <div className="h-[320px] w-full flex flex-col items-center justify-center text-[13px] text-text-muted bg-surface/50 rounded-xl border border-dashed border-line-soft">
        <p>No trend data available for the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" opacity={0.5} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            dy={10}
            minTickGap={20}
          />
          <YAxis
            yAxisId="left"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            dx={-10}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(1) + "k" : val}`}
            dx={10}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--line)", opacity: 0.4 }} />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }}
          />
          <Bar
            yAxisId="left"
            dataKey="total"
            name="Total Requests"
            fill="var(--blue-200)"
            radius={[4, 4, 0, 0]}
            barSize={12}
          />
          <Bar
            yAxisId="left"
            dataKey="successful"
            name="Successful"
            fill="var(--blue-600)"
            radius={[4, 4, 0, 0]}
            barSize={12}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="amount"
            name="Settled Amount"
            stroke="var(--amber-500)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--amber-500)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
