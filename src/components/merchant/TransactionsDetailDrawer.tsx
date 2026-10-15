"use client";

import { useEffect, useState } from "react";
import { X, AlertCircle, Copy, Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { formatDateTimeIST } from "@/lib/date";
import { formatINR } from "@/lib/utils";
import { StatusPill } from "@/components/dashboard/StatusPill";

export function TransactionsDetailDrawer({ 
  transactionId, 
  onClose,
  transactions = [],
  onNavigate
}: { 
  transactionId: string | null; 
  onClose: () => void; 
  transactions?: any[];
  onNavigate?: (id: string) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [ledgerExpanded, setLedgerExpanded] = useState(false);

  const currentIndex = transactions.findIndex(t => t.id === transactionId);
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < transactions.length - 1;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowLeft" && hasPrevious && onNavigate) {
        onNavigate(transactions[currentIndex - 1].id);
      }
      if (e.key === "ArrowRight" && hasNext && onNavigate) {
        onNavigate(transactions[currentIndex + 1].id);
      }
    };
    if (transactionId) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [transactionId, hasPrevious, hasNext, currentIndex, transactions, onNavigate]);

  // Fetch Data
  useEffect(() => {
    if (!transactionId) {
      setData(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);
    setLedgerExpanded(false);

    fetch(`/api/v1/merchant/transactions/${transactionId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load transaction details");
        return res.json();
      })
      .then((json) => {
        if (mounted) {
          setData(json.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || "An unexpected error occurred");
          setLoading(false);
        }
      });

    return () => { mounted = false; };
  }, [transactionId]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 250); // wait for exit animation
  };

  if (!transactionId && !closing) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-40 bg-[#0f172a]/20 backdrop-blur-[6px] transition-opacity duration-300 ${closing ? 'opacity-0' : 'opacity-100'}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Drawer Shell */}
      <div 
        className={`fixed z-50 flex flex-col bg-surface shadow-2xl border border-line overflow-hidden transition-transform duration-300 ease-out
          bottom-0 left-0 right-0 top-[10%] rounded-t-[20px] 
          sm:inset-y-4 sm:right-4 sm:left-auto sm:w-[600px] sm:h-auto sm:max-w-full sm:rounded-[18px]
          ${closing ? 'translate-y-full sm:translate-y-0 sm:translate-x-full' : 'translate-y-0 sm:translate-x-0'}
          ${!transactionId && closing ? 'sm:translate-x-full translate-y-full' : ''}`}
        role="dialog"
        aria-label="Transaction Details"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 shrink-0 flex items-center justify-between px-6 py-4 bg-surface/95 backdrop-blur-sm border-b border-line-soft">
          <div>
            <h2 className="text-[15px] font-semibold text-text-primary tracking-tight">Transaction Details</h2>
            {data && <p className="text-[13px] text-text-muted mt-0.5">Payout &middot; {data.reference || data.id}</p>}
            {!data && <p className="text-[13px] text-text-muted mt-0.5 opacity-0">Loading...</p>}
          </div>
          
          <div className="flex items-center gap-4">
            {currentIndex !== -1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate && onNavigate(transactions[currentIndex - 1].id)}
                  disabled={!hasPrevious}
                  className="p-1.5 rounded-md text-text-secondary hover:bg-line-soft disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  aria-label="Previous transaction"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[12px] font-medium text-text-muted tabular-nums">
                  {currentIndex + 1} of {transactions.length}
                </span>
                <button
                  onClick={() => onNavigate && onNavigate(transactions[currentIndex + 1].id)}
                  disabled={!hasNext}
                  className="p-1.5 rounded-md text-text-secondary hover:bg-line-soft disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  aria-label="Next transaction"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            
            <div className="w-px h-6 bg-line-soft" />
            
            <button
              onClick={handleClose}
              className="p-1.5 rounded-md text-text-secondary hover:bg-line-soft hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              aria-label="Close details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-coral-50 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-coral-500" />
              </div>
              <div>
                <h3 className="text-[14px] font-medium text-text-primary">Unable to load details</h3>
                <p className="text-[13px] text-text-muted mt-1">{error}</p>
              </div>
              <button
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  // forces re-render of effect
                  setData(null);
                }}
                className="mt-2 px-4 py-2 bg-surface border border-line shadow-sm rounded-lg text-[13px] font-medium hover:bg-canvas transition-colors"
              >
                Retry
              </button>
            </div>
          ) : loading || !data ? (
            <div className="animate-pulse space-y-8">
              <div className="space-y-4">
                <div className="h-4 w-24 bg-line-soft rounded-full" />
                <div className="h-10 w-40 bg-line-soft rounded-lg" />
                <div className="h-4 w-32 bg-line-soft rounded-full" />
              </div>
              <div className="space-y-3">
                <div className="h-4 w-32 bg-line-soft rounded-full mb-4" />
                <div className="h-12 bg-line-soft rounded-xl" />
                <div className="h-12 bg-line-soft rounded-xl" />
                <div className="h-12 bg-line-soft rounded-xl" />
              </div>
              <div className="space-y-3">
                <div className="h-4 w-32 bg-line-soft rounded-full mb-4" />
                <div className="h-12 bg-line-soft rounded-xl" />
                <div className="h-12 bg-line-soft rounded-xl" />
              </div>
            </div>
          ) : (
            <div className="space-y-8 pb-8 animate-fade-in">
              
              {/* Hero */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <StatusPill status={data.status} />
                  {data.paymentMode && (
                    <span className="inline-flex items-center rounded-full border border-line bg-canvas px-2.5 py-0.5 text-[12px] font-medium text-text-secondary">
                      {data.paymentMode}
                    </span>
                  )}
                </div>
                <h3 className="text-3xl font-semibold text-text-primary tracking-tight tabular-nums">
                  {formatINR(Number(data.amount))}
                </h3>
                <p className="text-[13px] text-text-secondary">
                  Payout {data.paymentMode ? `· ${data.paymentMode}` : ""} <br/>
                  Completed {formatDateTimeIST(data.updatedAt)}
                </p>
              </div>

              {/* Transaction Information */}
              <section>
                <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Transaction
                </h4>
                <div className="bg-surface rounded-xl border border-line-soft overflow-hidden divide-y divide-line-soft shadow-sm">
                  <DetailRow label="Transaction ID" value={<span className="font-mono text-[12.5px]">{data.id}</span>} copyable={data.id} />
                  {data.reference !== data.id && (
                    <DetailRow label="Merchant Reference" value={data.reference} copyable={data.reference} />
                  )}
                  <DetailRow label="Payment Mode" value={data.paymentMode || "N/A"} />
                  <DetailRow label="Created" value={formatDateTimeIST(data.createdAt)} />
                  <DetailRow label="Updated" value={formatDateTimeIST(data.updatedAt)} />
                </div>
              </section>

              {/* Destination */}
              <section>
                <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Destination
                </h4>
                <div className="bg-surface rounded-xl border border-line-soft overflow-hidden divide-y divide-line-soft shadow-sm">
                  <DetailRow label="Account Holder" value={data.destination?.accountName || "N/A"} />
                  {data.paymentMode === 'UPI' ? (
                    <DetailRow label="UPI ID" value={<span className="font-mono text-[13px]">{data.destination?.vpa || "N/A"}</span>} />
                  ) : (
                    <>
                      <DetailRow label="Destination" value={<span className="font-mono text-[13px]">{data.destination?.accountNumber || "N/A"}</span>} />
                      <DetailRow label="IFSC Code" value={<span className="font-mono text-[13px]">{data.destination?.ifscCode || "N/A"}</span>} />
                    </>
                  )}
                </div>
              </section>

              {/* Amount Breakdown */}
              <section>
                <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Amount Breakdown
                </h4>
                <div className="bg-surface rounded-xl border border-line-soft overflow-hidden divide-y divide-line-soft shadow-sm">
                  <DetailRow label="Transaction Amount" value={formatINR(Number(data.amount))} />
                  {Number(data.fee) > 0 && <DetailRow label="Fee" value={formatINR(Number(data.fee))} />}
                  {Number(data.tax) > 0 && <DetailRow label="Tax" value={formatINR(Number(data.tax))} />}
                  {(Number(data.fee) > 0 || Number(data.tax) > 0) && (
                    <DetailRow label="Total Charges" value={formatINR(Number(data.fee || 0) + Number(data.tax || 0))} />
                  )}
                  <div className="flex justify-between items-center px-4 py-3 bg-canvas/40">
                    <span className="text-[13.5px] font-medium text-text-primary">Total Debited</span>
                    <span className="text-[14.5px] font-semibold text-text-primary tracking-tight tabular-nums">{formatINR(Number(data.totalDebitAmount))}</span>
                  </div>
                </div>
              </section>

              {/* Provider / Processing */}
              {(data.provider || data.providerReference) && (
                <section>
                  <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                    Processing
                  </h4>
                  <div className="bg-surface rounded-xl border border-line-soft overflow-hidden divide-y divide-line-soft shadow-sm">
                    {data.provider && <DetailRow label="Provider" value={data.provider} />}
                    {data.providerReference && <DetailRow label="Provider Reference" value={<span className="font-mono text-[12.5px]">{data.providerReference}</span>} copyable={data.providerReference} />}
                  </div>
                </section>
              )}

              {/* Failure Details */}
              {data.status === "FAILED" && data.failureReason && (
                <section>
                  <h4 className="text-[12px] font-semibold text-coral-600 uppercase tracking-wider mb-3">
                    Failure Details
                  </h4>
                  <div className="bg-[#FEF2F2] rounded-xl border border-[#FECACA] p-4 text-[13.5px] text-[#991B1B] leading-relaxed shadow-sm">
                    <span className="font-medium block mb-1">Reason:</span>
                    {data.failureReason}
                  </div>
                </section>
              )}

              {/* Ledger Audit */}
              {data.ledgerEntries && data.ledgerEntries.length > 0 && (
                <section className="pt-2">
                  <button 
                    onClick={() => setLedgerExpanded(!ledgerExpanded)}
                    className="w-full flex items-center justify-between text-[12px] font-semibold text-text-muted uppercase tracking-wider hover:text-text-primary transition-colors outline-none group"
                    aria-expanded={ledgerExpanded}
                  >
                    <span>Accounting Audit</span>
                    <span className="text-[11px] font-medium lowercase tracking-normal text-text-secondary bg-line-soft px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      {ledgerExpanded ? "Hide" : "Show"}
                    </span>
                  </button>
                  
                  {ledgerExpanded && (
                    <div className="mt-4 space-y-2 animate-fade-in">
                      {data.ledgerEntries.map((entry: any) => (
                        <div key={entry.id} className="p-3.5 rounded-xl border border-line-soft bg-canvas/40 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary bg-surface px-2 py-0.5 rounded border border-line-soft shadow-sm">
                              {entry.purpose}
                            </span>
                            <span className="text-[13.5px] font-medium text-text-primary tabular-nums">
                              {formatINR(Number(entry.amount))}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11.5px] text-text-secondary mt-1">
                            <span className="font-mono truncate max-w-[180px]" title={entry.id}>{entry.id}</span>
                            <span>{formatDateTimeIST(entry.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Required for custom scrollbar aesthetics without heavy global CSS */}
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
    </>
  );
}

function DetailRow({ 
  label, 
  value, 
  copyable 
}: { 
  label: React.ReactNode; 
  value: React.ReactNode;
  copyable?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!copyable) return;
    navigator.clipboard.writeText(copyable);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-start justify-between px-4 py-3 group">
      <span className="text-[13.5px] text-text-secondary shrink-0 pt-0.5">{label}</span>
      <div className="flex items-start justify-end gap-2 text-right text-[13.5px] font-medium text-text-primary break-all pl-4">
        <div className="pt-0.5">{value}</div>
        {copyable && (
          <button
            onClick={handleCopy}
            className={`shrink-0 p-1 rounded-md transition-all outline-none ${
              copied 
                ? "bg-emerald-50 text-emerald-600 opacity-100" 
                : "text-text-muted hover:bg-line-soft hover:text-text-primary opacity-0 group-hover:opacity-100 focus:opacity-100"
            }`}
            title="Copy to clipboard"
            aria-label="Copy to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
