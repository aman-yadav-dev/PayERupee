"use client";

import { useRef, useState, type RefObject } from "react";
import { Menu, ImageDown, FileCode2, FileSpreadsheet } from "lucide-react";
import { useClickOutside } from "@/lib/useClickOutside";

export type CsvExport = {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
};

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getSvg(container: HTMLDivElement | null): SVGSVGElement | null {
  return container?.querySelector("svg") ?? null;
}

function downloadSvg(container: HTMLDivElement | null, filename: string) {
  const svg = getSvg(container);
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#ffffff");
  clone.insertBefore(bg, clone.firstChild);
  const svgString = new XMLSerializer().serializeToString(clone);
  triggerDownload(new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }), `${filename}.svg`);
}

function downloadPng(container: HTMLDivElement | null, filename: string) {
  const svg = getSvg(container);
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const svgString = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.drawImage(img, 0, 0, rect.width, rect.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, `${filename}.png`);
    });
  };
  img.src = url;
}

function downloadCsv(csv: CsvExport) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [csv.headers.map(escape).join(","), ...csv.rows.map((r) => r.map(escape).join(","))];
  triggerDownload(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${csv.filename}.csv`);
}

export function ChartExportMenu({
  chartRef,
  csv,
}: {
  chartRef: RefObject<HTMLDivElement | null>;
  csv: CsvExport;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const items = [
    { label: "Download PNG", icon: ImageDown, type: "png" as const },
    { label: "Download SVG", icon: FileCode2, type: "svg" as const },
    { label: "Download CSV", icon: FileSpreadsheet, type: "csv" as const },
  ];

  function handleExport(type: "png" | "svg" | "csv") {
    if (type === "png") downloadPng(chartRef.current, csv.filename);
    if (type === "svg") downloadSvg(chartRef.current, csv.filename);
    if (type === "csv") downloadCsv(csv);
    setOpen(false);
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Export chart"
        className="h-7 w-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-canvas transition-colors press-feedback"
      >
        <Menu className="h-4 w-4" strokeWidth={1.9} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-44 rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)] p-1.5 z-50 animate-pop-in origin-top-right">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleExport(item.type)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12.5px] text-text-secondary hover:bg-canvas hover:text-text-primary transition-colors press-feedback"
            >
              <item.icon className="h-3.5 w-3.5" strokeWidth={1.9} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
