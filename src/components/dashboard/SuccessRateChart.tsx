"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useDashboardFilters } from "./useDashboardFilters";

export function SuccessRateChart() {
  const filters = useDashboardFilters();
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      setIsLoading(true);
      try {
        let url = "/api/v1/merchant/wallet";
        const params = new URLSearchParams();
        if (filters.startDate) params.set("startDate", filters.startDate);
        if (filters.endDate) params.set("endDate", filters.endDate);
        if (filters.status) params.set("status", filters.status);
        if (filters.minAmount !== undefined) params.set("minAmount", String(filters.minAmount));
        if (filters.maxAmount !== undefined) params.set("maxAmount", String(filters.maxAmount));
        
        const qs = params.toString();
        if (qs) url += `?${qs}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        
        if (mounted && json.success && json.data?.trendData) {
          const rateData = json.data.trendData.map((d: any) => ({
            date: d.date,
            rate: d.total > 0 ? Math.round((d.successful / d.total) * 100) : 0
          }));
          setData(rateData);
          setHasError(false);
        }
      } catch (err) {
        if (mounted) setHasError(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    fetchData();
    return () => { mounted = false; };
  }, [filters]);

  if (isLoading) {
    return (
      <div className="h-[220px] w-full flex items-center justify-center bg-surface/50 rounded-xl border border-dashed border-line-soft">
        <span className="text-[13px] text-text-muted animate-pulse">Loading trend data...</span>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="h-[220px] w-full flex flex-col items-center justify-center bg-surface/50 rounded-xl border border-dashed border-line-soft text-[13px] text-text-muted">
        <p>Failed to load trend data</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-[220px] w-full flex flex-col items-center justify-center bg-surface/50 rounded-xl border border-dashed border-line-soft text-[13px] text-text-muted">
        <p>No transaction data available for the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line-soft)" />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            dy={10}
            minTickGap={20}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            tickFormatter={(value) => `${value}%`}
            domain={[0, 100]}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--surface)',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              fontSize: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}
            itemStyle={{ color: 'var(--text-primary)' }}
            formatter={(value: any) => [`${value}%`, 'Success Rate']}
          />
          <Area 
            type="monotone" 
            dataKey="rate" 
            stroke="#10b981" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorRate)" 
            animationDuration={1000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
