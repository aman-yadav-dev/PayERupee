"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { CalendarRange, SlidersHorizontal, ChevronDown, Loader2, Check, Download, Search, X } from "lucide-react";
import { useDashboardFilters, setDashboardFilters, getDashboardFilters } from "./useDashboardFilters";
import { formatDateIST, getISTDateBoundaries } from "@/lib/date";
import { useClickOutside } from "@/lib/useClickOutside";
import { cn } from "@/lib/utils";

type FieldKey = "date" | "status" | "amount" | "type" | "paymentMode";

const DATE_OPTIONS = ["Last 7 days", "Last 30 days", "This month"];
const TYPE_OPTIONS = ["All types", "Add Money", "Withdraw"];
const PAYMENT_MODE_OPTIONS = ["All modes", "UPI", "IMPS", "NEFT", "RTGS", "WALLET", "CARD"];
const STATUS_OPTIONS = [
  { label: "All statuses", dot: null },
  { label: "Completed", dot: "bg-blue-600" },
  { label: "Pending", dot: "bg-amber-500" },
  { label: "Failed", dot: "bg-coral-500" },
  
];
const AMOUNT_OPTIONS = [
  "All amounts",
  "\u20b90 \u2013 \u20b91,000",
  "\u20b91,001 \u2013 \u20b95,000",
  "\u20b95,001 \u2013 \u20b910,000",
  "\u20b910,001+",
];

// Clearer "this is a selectable menu" affordance: the active option gets
// its own tinted background (not just colored text, which is easy to miss)
// plus a checkmark, so it reads as a select control rather than a block of
// list text.
function OptionButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
      return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-[13px] transition-colors press-feedback",
        active ? "bg-blue-50 text-blue-700 font-medium" : "text-text-secondary hover:bg-canvas hover:text-text-primary"
      )}
    >
      <span className="flex items-center gap-2 min-w-0">{children}</span>
      {active && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600" strokeWidth={2.5} />}
    </button>
  );
}

function FilterField({
  label,
  value,
  align,
  isOpen,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  align: "left" | "center" | "right";
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-1.5 h-11 rounded-lg border border-line bg-surface px-2.5 sm:px-3.5 text-left hover:border-blue-500/30 transition-colors press-feedback"
      >
        <span className="min-w-0">
          <span className="block text-[10px] sm:text-[10.5px] text-text-muted leading-none mb-1 truncate">{label}</span>
          <span className="block text-[12px] sm:text-[13px] text-text-primary truncate">{value}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-text-muted shrink-0 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Desktop only: floating popover. There's ample horizontal room at
          sm+ so an overlay never collides with anything below it — the
          crowding problem only exists on mobile, which uses the inline
          panel rendered by FilterBar instead (never this). */}
      {isOpen && (
        <div
          className={cn(
            "hidden sm:block absolute mt-2 w-64 rounded-xl border border-line bg-surface shadow-[var(--shadow-pop)] p-1.5 z-50 animate-pop-in origin-top",
            "sm:left-0",
            align === "center" && "sm:left-1/2 sm:-translate-x-1/2 origin-top",
            align === "right" && "sm:left-auto sm:right-0 origin-top-right"
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function FilterBar({ 
  showType = false, 
  showSearch = false,
  showPaymentMode = false,
  exportEndpoint = "/api/v1/merchant/export"
}: { 
  showType?: boolean; 
  showSearch?: boolean;
  showPaymentMode?: boolean;
  exportEndpoint?: string;
} = {}) {
  const pathname = usePathname() || "/dashboard";
  const [dateValue, setDateValue] = useState("Last 30 days");
  const [statusValue, setStatusValue] = useState("All statuses");
  const [amountValue, setAmountValue] = useState("All amounts");
  const [typeValue, setTypeValue] = useState("All types");
  const [paymentModeValue, setPaymentModeValue] = useState("All modes");
  const [searchValue, setSearchValue] = useState("");
  const [openField, setOpenField] = useState<FieldKey | null>(null);
  const [applying, setApplying] = useState(false);
  const [justApplied, setJustApplied] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const filters = useDashboardFilters();

  const wrapRef = useRef<HTMLDivElement>(null);
  useClickOutside(wrapRef, () => setOpenField(null));

  function toggle(field: FieldKey) {
    setOpenField((cur) => (cur === field ? null : field));
  }

  function handleApply() {
    setOpenField(null);
    setApplying(true);
    setJustApplied(false);
    
    const { startDate, endDate } = getISTDateBoundaries(dateValue, customStart, customEnd);

    let minAmount: number | undefined;
    let maxAmount: number | undefined;
    if (amountValue === AMOUNT_OPTIONS[1]) { minAmount = 0; maxAmount = 1000; }
    else if (amountValue === AMOUNT_OPTIONS[2]) { minAmount = 1001; maxAmount = 5000; }
    else if (amountValue === AMOUNT_OPTIONS[3]) { minAmount = 5001; maxAmount = 10000; }
    else if (amountValue === AMOUNT_OPTIONS[4]) { minAmount = 10001; }

    const detail: any = { 
      status: statusValue, 
      startDate, 
      endDate, 
      minAmount, 
      maxAmount,
      type: (showType && typeValue !== "All types") ? (typeValue === "Add Money" ? "ADD_MONEY" : "WITHDRAWAL") : undefined,
      search: (showSearch && searchValue) ? searchValue : undefined,
      paymentMode: (showPaymentMode && paymentModeValue !== "All modes") ? paymentModeValue : undefined
    };

    setDashboardFilters(pathname, detail);

    setTimeout(() => {
      setApplying(false);
      setJustApplied(true);
      setTimeout(() => setJustApplied(false), 2000);
    }, 650);
  }

  function applyCustomRange() {
    if (!customStart || !customEnd) return;
    const fmt = (iso: string) =>
      formatDateIST(iso);
    setDateValue(`${fmt(customStart)} – ${fmt(customEnd)}`);
    setOpenField(null);
  }

  const typeOptions = (
    <>
      {TYPE_OPTIONS.map((opt) => (
        <OptionButton
          key={opt}
          active={opt === typeValue}
          onClick={() => {
            setTypeValue(opt);
            setOpenField(null);
          }}
        >
          {opt}
        </OptionButton>
      ))}
    </>
  );

  const dateOptions = (
    <>
      {DATE_OPTIONS.map((opt) => (
        <OptionButton
          key={opt}
          active={opt === dateValue}
          onClick={() => {
            setDateValue(opt);
            setOpenField(null);
          }}
        >
          {opt}
        </OptionButton>
      ))}
      <div
        className="border-t border-line-soft mt-1.5 pt-2.5 px-1"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="px-2 pb-1.5 text-[10.5px] font-medium text-text-muted uppercase tracking-wide">
          Custom range
        </p>
        <div className="flex items-center gap-2 px-1">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="flex-1 min-w-0 h-8 rounded-md border border-line bg-canvas px-2 text-[12px] text-text-primary"
          />
          <span className="text-text-muted text-[12px]">–</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="flex-1 min-w-0 h-8 rounded-md border border-line bg-canvas px-2 text-[12px] text-text-primary"
          />
        </div>
        <button
          type="button"
          onClick={applyCustomRange}
          disabled={!customStart || !customEnd}
          className="w-full h-8 mt-2 mb-1 rounded-md bg-blue-600 text-white text-[12px] font-medium hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors press-feedback"
        >
          Use custom range
        </button>
      </div>
    </>
  );

  const statusOptions = (
    <>
      {STATUS_OPTIONS.map((opt) => (
        <OptionButton
          key={opt.label}
          active={opt.label === statusValue}
          onClick={() => {
            setStatusValue(opt.label);
            setOpenField(null);
          }}
        >
          {opt.dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", opt.dot)} />}
          {opt.label}
        </OptionButton>
      ))}
    </>
  );


  const paymentModeOptions = (
    <>
      {PAYMENT_MODE_OPTIONS.map((opt) => (
        <OptionButton
          key={opt}
          active={opt === paymentModeValue}
          onClick={() => {
            setPaymentModeValue(opt);
            setOpenField(null);
          }}
        >
          {opt}
        </OptionButton>
      ))}
    </>
  );

  const amountOptions = (
    <>
      {AMOUNT_OPTIONS.map((opt) => (
        <OptionButton
          key={opt}
          active={opt === amountValue}
          onClick={() => {
            setAmountValue(opt);
            setOpenField(null);
          }}
        >
          {opt}
        </OptionButton>
      ))}
    </>
  );

  return (
    <div ref={wrapRef} className="rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
        <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <CalendarRange className="h-[17px] w-[17px]" strokeWidth={1.9} />
        </div>

        {/* On mobile these three sit in a compact 3-col grid (one row).
            "sm:contents" dissolves this wrapper at sm+ so the fields
            become direct flex children again, unchanged from before. */}
        <div className="grid grid-cols-2 gap-2 w-full sm:contents mb-2 sm:mb-0">
          {showSearch && (
            <div className="col-span-2 sm:col-span-1 w-full sm:w-64 shrink-0 relative flex items-center mb-2 sm:mb-0">
              <Search className="absolute left-3 h-4 w-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search reference..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => { if(e.key === "Enter") handleApply(); }}
                className="w-full h-11 pl-9 pr-3 rounded-lg border border-line bg-surface text-[13px] text-text-primary focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>
          )}
          {showType && (
            <FilterField label="Type" value={typeValue} align="left" isOpen={openField === "type"} onToggle={() => toggle("type")}>
              {typeOptions}
            </FilterField>
          )}
          <FilterField label="Date range" value={dateValue} align={showType ? "center" : "left"} isOpen={openField === "date"} onToggle={() => toggle("date")}>
            {dateOptions}
          </FilterField>
          <FilterField label="Status" value={statusValue} align="center" isOpen={openField === "status"} onToggle={() => toggle("status")}>
            {statusOptions}
          </FilterField>
          {showPaymentMode && (
            <FilterField label="Payment Mode" value={paymentModeValue} align="center" isOpen={openField === "paymentMode"} onToggle={() => toggle("paymentMode")}>
              {paymentModeOptions}
            </FilterField>
          )}
          <FilterField label="Amount range" value={amountValue} align="right" isOpen={openField === "amount"} onToggle={() => toggle("amount")}>
            {amountOptions}
          </FilterField>
        </div>

        <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
          <button
            type="button"
            onClick={handleApply}
            disabled={applying}
            className="flex-1 sm:flex-none h-11 px-4 rounded-lg bg-blue-600 text-white text-[13px] font-medium flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-70 transition-colors relative press-feedback"
          >
            {applying ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.5} />
            ) : (
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            <span className="truncate">{applying ? "Applying..." : justApplied ? "Applied" : "Apply filters"}</span>
          </button>
          

          <button
            type="button"
            onClick={() => {
              setDateValue("Last 30 days");
              setStatusValue("All statuses");
              setCustomStart("");
              setCustomEnd("");
              setAmountValue("All amounts");
              setTypeValue("All types");
              setPaymentModeValue("All modes");
              setSearchValue("");
              setDashboardFilters(pathname, { _reset: true });
            }}
            className="h-11 px-3 sm:px-4 rounded-lg bg-surface border border-line text-text-secondary text-[13px] font-medium flex items-center justify-center gap-2 hover:bg-canvas hover:text-text-primary transition-colors press-feedback shrink-0"
            title="Clear filters"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Clear</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const filters = getDashboardFilters(pathname);
              const searchParams = new URLSearchParams();
              if (filters.status && filters.status !== "All statuses") searchParams.set("status", filters.status);
              if (filters.startDate) searchParams.set("startDate", filters.startDate);
              if (filters.endDate) searchParams.set("endDate", filters.endDate);
              if (filters.minAmount !== undefined) searchParams.set("minAmount", filters.minAmount.toString());
              if (filters.maxAmount !== undefined) searchParams.set("maxAmount", filters.maxAmount.toString());
              if (filters.search) searchParams.set("search", filters.search);
              if (filters.type && filters.type !== "All types") searchParams.set("type", filters.type);
              if (filters.paymentMode && filters.paymentMode !== "All modes") searchParams.set("paymentMode", filters.paymentMode);
              
              const queryStr = searchParams.toString();
              window.location.href = queryStr ? `${exportEndpoint}?${queryStr}` : exportEndpoint;
            }}
            className="h-11 px-3 sm:px-4 rounded-lg bg-surface border border-line text-text-secondary text-[13px] font-medium flex items-center justify-center gap-2 hover:bg-canvas hover:text-text-primary transition-colors press-feedback shrink-0"
            title="Export filtered transactions as CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Mobile only: selected field's options expand inline here, below
          the whole row (including Apply), in normal document flow — never
          overlapping anything. No z-index/backdrop trick fixes a panel
          that clips a button's text; not overlapping it at all does. */}
      {openField && (
        <div className="sm:hidden mt-2.5 rounded-lg border border-line bg-canvas p-1.5 animate-expand-down">
          {openField === "date" && dateOptions}
          {openField === "status" && statusOptions}
          {openField === "amount" && amountOptions}
          {openField === "type" && typeOptions}
          {openField === "paymentMode" && paymentModeOptions}
        </div>
      )}
    </div>
  );
}
