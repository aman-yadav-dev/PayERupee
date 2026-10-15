"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import {
  ScrollText,
  RefreshCw,
  Loader2,
  Copy,
  ShieldCheck,
  User,
  Shield,
  FileCode,
  Calendar,
  Globe,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminPagination } from "@/components/admin/AdminPagination";

interface AuditLogItem {
  id: string;
  actorId: string | null;
  actorType: "ADMIN" | "MERCHANT" | "SYSTEM";
  entityId: string | null;
  entityType: string;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actorTypeFilter, setActorTypeFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [entityTypeFilter, setEntityTypeFilter] = useState("ALL");
  const [entityIdSearch, setEntityIdSearch] = useState("");
  const [appliedEntityId, setAppliedEntityId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [, startTransition] = useTransition();

  const fetchLogs = useCallback(
    (
      currentPage: number,
      currentPageSize: number,
      currentActorType: string,
      currentAction: string,
      currentEntityType: string,
      currentEntityId: string,
      currentStartDate: string,
      currentEndDate: string
    ) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", currentPageSize.toString());
      if (currentActorType !== "ALL") params.set("actorType", currentActorType);
      if (currentAction !== "ALL") params.set("action", currentAction);
      if (currentEntityType !== "ALL") params.set("entityType", currentEntityType);
      if (currentEntityId.trim()) params.set("entityId", currentEntityId.trim());
      if (currentStartDate) params.set("startDate", currentStartDate);
      if (currentEndDate) params.set("endDate", currentEndDate);

      fetch(`/api/v1/admin/audit-logs?${params.toString()}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setLogs(json.data || []);
            setTotalPages(json.meta?.totalPages || 1);
            setTotalCount(json.meta?.total || 0);
          } else {
            toast.error("Failed to load audit logs");
          }
        })
        .catch(() => toast.error("Communication error with audit logs API"))
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", pageSize.toString());
    if (actorTypeFilter !== "ALL") params.set("actorType", actorTypeFilter);
    if (actionFilter !== "ALL") params.set("action", actionFilter);
    if (entityTypeFilter !== "ALL") params.set("entityType", entityTypeFilter);
    if (appliedEntityId) params.set("entityId", appliedEntityId);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    fetch(`/api/v1/admin/audit-logs?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (mounted && json.success) {
          setLogs(json.data || []);
          setTotalPages(json.meta?.totalPages || 1);
          setTotalCount(json.meta?.total || 0);
        }
      })
      .catch(() => {
        if (mounted) toast.error("Failed to fetch audit logs");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [page, pageSize, actorTypeFilter, actionFilter, entityTypeFilter, appliedEntityId, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      setAppliedEntityId(entityIdSearch.trim());
      setPage(1);
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getActorBadge = (actorType: string) => {
    switch (actorType) {
      case "ADMIN":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700">
            <Shield className="h-3 w-3" />
            ADMIN
          </span>
        );
      case "MERCHANT":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700">
            <User className="h-3 w-3" />
            MERCHANT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-canvas text-text-muted">
            SYSTEM
          </span>
        );
    }
  };

  const getActionBadge = (action: string) => {
    if (action.includes("APPROVE") || action.includes("CREATE")) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700">
          {action}
        </span>
      );
    }
    if (action.includes("REJECT") || action.includes("SUSPEND") || action.includes("BAN")) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-coral-50 text-coral-700">
          {action}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700">
        {action}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h2 className="text-[22px] font-semibold font-display text-text-primary tracking-tight flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-blue-600" />
            <span>Platform Audit Trail</span>
          </h2>
          <p className="text-[13px] text-text-muted mt-0.5">
            Immutable administrative and merchant compliance event logs with masked destination forensics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search Entity ID..."
              value={entityIdSearch}
              onChange={(e) => setEntityIdSearch(e.target.value)}
              className="h-9 w-64 rounded-xl border border-line bg-surface pl-10 pr-4 text-xs text-text-primary placeholder:text-text-muted focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </form>

          <button
            onClick={() =>
              fetchLogs(
                page,
                pageSize,
                actorTypeFilter,
                actionFilter,
                entityTypeFilter,
                appliedEntityId,
                startDate,
                endDate
              )
            }
            disabled={loading}
            className="p-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary hover:bg-canvas transition-colors disabled:opacity-50 press-feedback"
            title="Refresh Audit Logs"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="space-y-3">
        {/* Row 1: Actor Type Tabs + Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="overflow-x-auto table-scrollbar max-w-full py-0.5">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-canvas border border-line text-xs font-medium w-max">
              {["ALL", "ADMIN", "MERCHANT", "SYSTEM"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActorTypeFilter(tab);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                    actorTypeFilter === tab
                      ? "bg-surface text-text-primary shadow-sm font-semibold"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-text-muted font-medium shrink-0">
            Total: <span className="text-text-primary font-semibold">{totalCount}</span> events
          </div>
        </div>

        {/* Row 2: Action, Entity Type, Date Range Dropdowns & Inputs */}
        <div className="overflow-x-auto table-scrollbar max-w-full py-0.5">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-line text-xs shadow-xs w-max">
            {/* Action Filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-text-muted font-medium">Action:</span>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 px-2.5 rounded-lg border border-line bg-canvas text-xs text-text-primary font-medium focus:border-blue-500 focus:outline-none"
              >
                {[
                  "ALL",
                  "CREATE",
                  "UPDATE",
                  "DELETE",
                  "APPROVE",
                  "REJECT",
                  "SUSPEND",
                  "RESTORE",
                  "PROCESS",
                  "BAN",
                  "UNBAN",
                ].map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
            </div>

            {/* Entity Type Filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-text-muted font-medium">Entity:</span>
              <select
                value={entityTypeFilter}
                onChange={(e) => {
                  setEntityTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 px-2.5 rounded-lg border border-line bg-canvas text-xs text-text-primary font-medium focus:border-blue-500 focus:outline-none"
              >
                {[
                  "ALL",
                  "USER",
                  "MERCHANT_PROFILE",
                  "KYC_APPLICATION",
                  "PAYOUT",
                  "FUND_REQUEST",
                  "WALLET",
                  "BLACKLIST",
                  "SYSTEM",
                ].map((ent) => (
                  <option key={ent} value={ent}>
                    {ent}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-text-muted font-medium">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="h-8 px-2 rounded-lg border border-line bg-canvas text-xs text-text-primary focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* End Date */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-text-muted font-medium">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="h-8 px-2 rounded-lg border border-line bg-canvas text-xs text-text-primary focus:border-blue-500 focus:outline-none"
              />
            </div>

            {(actionFilter !== "ALL" ||
              entityTypeFilter !== "ALL" ||
              startDate ||
              endDate ||
              entityIdSearch ||
              appliedEntityId) && (
              <button
                type="button"
                onClick={() => {
                  setActionFilter("ALL");
                  setEntityTypeFilter("ALL");
                  setStartDate("");
                  setEndDate("");
                  setEntityIdSearch("");
                  setAppliedEntityId("");
                  setPage(1);
                }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap ml-2"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Audit Logs Table Card */}
      <div className="rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted text-xs">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span>Loading security events...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center text-text-muted text-xs">
            No audit log entries found matching criteria.
          </div>
        ) : (
          <div className="overflow-x-auto table-scrollbar">
            <table className="w-full min-w-[960px] text-left text-[13px] border-collapse">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  <th className="py-3 px-4">Event ID</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity Type</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-canvas/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-mono text-[12px] text-text-primary flex items-center gap-1.5">
                      <span>{log.id ? `${log.id.slice(0, 8)}...` : "—"}</span>
                      {log.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(log.id, "Log ID");
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-blue-600 transition-opacity"
                          title="Copy Log ID"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        {getActorBadge(log.actorType)}
                        <span
                          className="text-[11px] text-text-muted font-mono truncate max-w-[90px]"
                          title={log.actorId ?? (log.actorType === "SYSTEM" ? "System Service (Automated)" : "Actor unavailable")}
                        >
                          {log.actorId
                            ? `${log.actorId.slice(0, 8)}...`
                            : log.actorType === "SYSTEM"
                            ? "System"
                            : "Unavailable"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">{getActionBadge(log.action)}</td>
                    <td className="py-3.5 px-4 font-mono text-[12px] text-text-secondary">
                      {log.entityType}
                    </td>
                    <td
                      className="py-3.5 px-4 font-mono text-text-muted text-[11px] truncate max-w-[120px]"
                      title={log.entityId || "N/A"}
                    >
                      {log.entityId || "—"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-text-muted text-[11.5px]">
                      {log.ipAddress ? (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3 text-text-muted" />
                          <span>{log.ipAddress}</span>
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-text-muted text-[12px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-line bg-surface hover:bg-canvas text-text-secondary text-xs font-medium transition-colors"
                      >
                        Metadata
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setPage(1);
          }}
          itemName="audit events"
          disabled={loading}
        />
      </div>

      {/* AdminModal for Audit Event Metadata Payload */}
      <AdminModal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Audit Event Metadata"
        description={selectedLog ? `Event ID: ${selectedLog.id}` : undefined}
        maxWidth="lg"
      >
        {selectedLog && (
          <div className="space-y-5 text-xs">
            {/* Event Overview */}
            <div className="p-4 rounded-xl bg-canvas border border-line-soft space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Actor Type:</span>
                <div>{getActorBadge(selectedLog.actorType)}</div>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Actor ID:</span>
                <span className="text-text-primary font-mono text-[11.5px]">
                  {selectedLog.actorId || (selectedLog.actorType === "SYSTEM" ? "System Service (Automated)" : "Actor unavailable")}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-muted">Action:</span>
                <div>{getActionBadge(selectedLog.action)}</div>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Entity Type:</span>
                <span className="text-text-primary font-medium">{selectedLog.entityType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Entity ID:</span>
                <span className="text-text-primary font-mono text-[11.5px]">{selectedLog.entityId || "—"}</span>
              </div>
            </div>

            {/* Network Attribution */}
            <div className="space-y-2">
              <div className="text-[12px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-blue-600" />
                <span>Network Origin</span>
              </div>
              <div className="p-3.5 rounded-xl bg-canvas border border-line-soft space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-muted">Client IP:</span>
                  <span className="text-text-primary font-mono">{selectedLog.ipAddress || "Internal / System"}</span>
                </div>
                <div>
                  <span className="text-text-muted block mb-1">User Agent:</span>
                  <span className="text-text-secondary break-all bg-surface p-2 rounded-lg border border-line-soft block font-mono text-[11px]">
                    {selectedLog.userAgent || "No user-agent string recorded"}
                  </span>
                </div>
              </div>
            </div>

            {/* JSON Metadata Payload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <FileCode className="h-3.5 w-3.5 text-blue-600" />
                  <span>Metadata Payload</span>
                </div>
                {selectedLog.metadata && (
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(selectedLog.metadata, null, 2), "Metadata JSON")}
                    className="text-[11.5px] text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy JSON</span>
                  </button>
                )}
              </div>
              <div className="rounded-xl bg-canvas border border-line-soft p-3.5 font-mono text-[11.5px] overflow-x-auto max-h-64 custom-scrollbar">
                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 ? (
                  <pre className="text-text-primary whitespace-pre-wrap">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                ) : (
                  <span className="text-text-muted italic">No additional metadata payload attached to this event.</span>
                )}
              </div>
            </div>

            {/* Privacy & Compliance Assurance */}
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/40 flex items-start gap-2.5">
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-[12px] text-blue-900 dark:text-blue-200">
                <span className="font-semibold block text-blue-700 dark:text-blue-300">Sanitization Guard</span>
                Sensitive destinations are masked before audit logging. No plaintext bank accounts, VPAs, or secret keys are stored in metadata.
              </div>
            </div>

            {/* Timestamp */}
            <div className="p-3.5 rounded-xl bg-canvas border border-line-soft space-y-1 text-text-muted">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>Recorded: {new Date(selectedLog.createdAt).toLocaleString("en-IN")}</span>
              </div>
              <div className="text-[10.5px] font-mono">ISO: {selectedLog.createdAt}</div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-line-soft flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
              >
                Close Inspector
              </button>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
