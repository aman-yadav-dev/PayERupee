"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { ChartExportMenu, type CsvExport } from "./ChartExportMenu";

export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className = "",
  csv,
  delayMs,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  csv?: CsvExport;
  delayMs?: number;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const style: CSSProperties | undefined = delayMs ? { animationDelay: `${delayMs}ms` } : undefined;

  return (
    <div
      className={`rounded-2xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-pop)] hover:border-blue-500/20 ${delayMs ? "animate-fade-up" : ""} ${className}`}
      style={style}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-[15px] font-medium text-text-primary">{title}</h3>
          {subtitle && <p className="text-[12px] text-text-muted mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          {action}
          {csv && <ChartExportMenu chartRef={chartRef} csv={csv} />}
        </div>
      </div>
      <div className="mt-3" ref={chartRef}>
        {children}
      </div>
    </div>
  );
}
