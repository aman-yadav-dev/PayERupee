"use client";

import { useEffect, useState } from "react";
import {
  FileCheck2,
  RefreshCw,
  Loader2,
  Download,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminDrawer } from "@/components/admin/AdminDrawer";

interface KycApplicationItem {
  id: string;
  merchantProfileId: string;
  status: "PENDING_SUBMISSION" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  submittedAt: string | null;
  reviewedAt: string | null;
  merchantProfile?: {
    user?: {
      name?: string;
      email?: string;
    };
  };
}

interface KycAnswerDetail {
  id: string;
  fieldKey?: string | null;
  fieldLabel?: string | null;
  fieldDefinitionId: string;
  fieldDescription?: string | null;
  section?: string | null;
  dataType?: string | null;
  inputType?: string | null;
  order?: number;
  isRequired?: boolean;
  isUnmapped?: boolean;
  value: unknown;
}

interface KycDocumentDetail {
  id: string;
  originalFilename: string;
  mimeType: string;
  status: string;
}

interface KycApplicationDetail extends KycApplicationItem {
  answers?: KycAnswerDetail[];
  documents?: KycDocumentDetail[];
}

export default function AdminKycPage() {
  const [applications, setApplications] = useState<KycApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedApp, setSelectedApp] = useState<KycApplicationDetail | null>(null);

  // Action states
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [allowResubmission, setAllowResubmission] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard");
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2000);
  };

  const fetchApplications = (targetPage = page, targetPageSize = pageSize) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    params.set("page", targetPage.toString());
    params.set("limit", targetPageSize.toString());

    fetch(`/api/v1/admin/kyc/applications?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          const list = Array.isArray(json.data) ? json.data : (json.data.data || []);
          setApplications(list);
        } else {
          toast.error("Failed to load KYC applications");
        }
        if (json.meta) {
          setTotalPages(json.meta.totalPages || 1);
          setTotalCount(json.meta.total || 0);
        }
      })
      .catch(() => toast.error("Error connecting to administrative API"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    params.set("page", page.toString());
    params.set("limit", pageSize.toString());

    fetch(`/api/v1/admin/kyc/applications?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (mounted && json.success && json.data) {
          const list = Array.isArray(json.data) ? json.data : (json.data.data || []);
          setApplications(list);
          if (json.meta) {
            setTotalPages(json.meta.totalPages || 1);
            setTotalCount(json.meta.total || 0);
          }
        }
      })
      .catch(() => {
        if (mounted) toast.error("Failed to fetch applications");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [statusFilter, page, pageSize]);

  const openReviewModal = (id: string) => {
    fetch(`/api/v1/admin/kyc/applications/${id}`)
      .then((res) => res.json())
      .then((json) => {
        const detail = json.data || (json.success ? json.data : null);
        if (detail) setSelectedApp(detail);
        else toast.error("Could not load application details");
      })
      .catch(() => toast.error("Error loading application detail"));
  };

  const handleApprove = async () => {
    if (!selectedApp) return;
    setIsApproving(true);
    try {
      const res = await fetch(`/api/v1/admin/kyc/applications/${selectedApp.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("KYC Application successfully approved.");
        setSelectedApp({ ...selectedApp, status: "APPROVED" });
        fetchApplications();
      } else {
        toast.error(data.error || "Failed to approve application");
      }
    } catch {
      toast.error("Network error while submitting approval");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    if (!rejectionReason.trim() || rejectionReason.trim().length < 3) {
      toast.error("Rejection reason must be at least 3 characters.");
      return;
    }

    setIsRejecting(true);
    try {
      const res = await fetch(`/api/v1/admin/kyc/applications/${selectedApp.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectionReason: rejectionReason.trim(),
          allowResubmission,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("KYC Application rejected.");
        setSelectedApp({ ...selectedApp, status: "REJECTED" });
        setRejectModalOpen(false);
        setRejectionReason("");
        fetchApplications();
      } else {
        toast.error(data.error || "Failed to reject application");
      }
    } catch {
      toast.error("Network error while submitting rejection");
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h2 className="text-[22px] font-semibold font-display text-text-primary tracking-tight flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-blue-600" />
            <span>Merchant KYC Verification Queue</span>
          </h2>
          <p className="text-[13px] text-text-muted mt-0.5">
            Review submitted merchant business identity dossiers, answers, and supporting documents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchApplications()}
            disabled={loading}
            className="p-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary hover:bg-canvas transition-colors disabled:opacity-50 press-feedback"
            title="Refresh Applications"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="overflow-x-auto table-scrollbar max-w-full py-0.5">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-canvas border border-line text-xs font-medium w-max">
          {["ALL", "UNDER_REVIEW", "APPROVED", "REJECTED", "PENDING_SUBMISSION"].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setStatusFilter(tab);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                statusFilter === tab
                  ? "bg-surface text-text-primary shadow-sm font-semibold"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {tab.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Applications Table Card */}
      <div className="rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted text-xs">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span>Loading verification dossiers...</span>
          </div>
        ) : applications.length === 0 ? (
          <div className="py-20 text-center text-text-muted text-xs">
            No KYC applications found matching the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto table-scrollbar">
            <table className="w-full min-w-[780px] text-left text-[13px] border-collapse">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  <th className="py-3 px-2 sm:px-4">Applicant</th>
                  <th className="py-3 px-1.5 sm:px-3 whitespace-nowrap">Status</th>
                  <th className="py-3 px-3 hidden lg:table-cell">Submitted At</th>
                  <th className="py-3 px-4 hidden lg:table-cell">Reviewed At</th>
                  <th className="py-3 px-2 sm:px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {applications.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => openReviewModal(app.id)}
                    className="hover:bg-canvas/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-2 sm:px-4">
                      <div className="font-medium text-text-primary truncate max-w-[95px] sm:max-w-[180px] lg:max-w-none">
                        {app.merchantProfile?.user?.name || "Merchant"}
                      </div>
                      <div className="text-[11px] sm:text-[12px] text-text-muted truncate max-w-[95px] sm:max-w-[180px] lg:max-w-none">
                        {app.merchantProfile?.user?.email}
                      </div>
                    </td>
                    <td className="py-3 px-1.5 sm:px-3 whitespace-nowrap">
                      <StatusPill status={app.status} />
                    </td>
                    <td className="py-3 px-3 text-text-muted text-[12px] hidden lg:table-cell">
                      {app.submittedAt
                        ? new Date(app.submittedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="py-3 px-4 text-text-muted text-[12px] hidden lg:table-cell">
                      {app.reviewedAt
                        ? new Date(app.reviewedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openReviewModal(app.id);
                        }}
                        className="inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg border border-line bg-surface text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-xs font-medium transition-colors press-feedback shadow-sm"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">Review Dossier</span>
                        <span className="md:hidden">Review</span>
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
          itemName="applications"
          disabled={loading}
        />
      </div>

      {/* Dossier Review Drawer via AdminDrawer */}
      <AdminDrawer
        isOpen={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        title="KYC Verification Dossier"
        subtitle={
          selectedApp ? (
            <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-text-muted">
              <span>Application ID: {selectedApp.id}</span>
              <button
                type="button"
                onClick={() => handleCopy(selectedApp.id, "app-id")}
                className="hover:text-blue-600 transition-colors p-0.5 shrink-0"
                title="Copy Application ID"
              >
                {copiedKey === "app-id" ? (
                  <Check className="h-3 w-3 text-emerald-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          ) : undefined
        }
        badge={selectedApp ? <StatusPill status={selectedApp.status} /> : null}
        width="xl"
        footer={
          selectedApp ? (
            <div className="w-full flex items-center justify-between gap-3">
              <span className="text-xs text-text-muted truncate">
                {selectedApp.status === "APPROVED" && "Application is already approved."}
                {selectedApp.status === "REJECTED" && "Application is rejected."}
                {(selectedApp.status === "UNDER_REVIEW" || selectedApp.status === "PENDING_SUBMISSION") &&
                  "Decision will notify merchant via email."}
              </span>

              <div className="flex items-center gap-2.5 shrink-0">
                {(selectedApp.status === "UNDER_REVIEW" || selectedApp.status === "PENDING_SUBMISSION") && (
                  <>
                    <button
                      type="button"
                      onClick={() => setRejectModalOpen(true)}
                      disabled={isApproving || isRejecting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 text-xs font-semibold transition-colors disabled:opacity-50 press-feedback shadow-sm"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Reject Application</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isApproving || isRejecting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold transition-colors disabled:opacity-50 press-feedback shadow-sm shadow-blue-600/20"
                    >
                      {isApproving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Approving...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>Approve Application</span>
                        </>
                      )}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="px-4 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          ) : null
        }
      >
        {selectedApp && (
          <div className="space-y-6">
            {/* Applicant Summary Section */}
            <section>
              <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-3">
                Applicant Overview
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-canvas border border-line-soft space-y-1">
                  <span className="text-[11px] text-text-muted uppercase font-semibold">Applicant</span>
                  <div className="text-[13px] font-medium text-text-primary truncate">
                    {selectedApp.merchantProfile?.user?.name || "Merchant"}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-canvas border border-line-soft space-y-1">
                  <span className="text-[11px] text-text-muted uppercase font-semibold">Email</span>
                  <div className="text-[13px] text-text-primary truncate">
                    {selectedApp.merchantProfile?.user?.email}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-canvas border border-line-soft space-y-1">
                  <span className="text-[11px] text-text-muted uppercase font-semibold">Status</span>
                  <div>
                    <StatusPill status={selectedApp.status} />
                  </div>
                </div>
              </div>
            </section>

            {/* Form Answers Grouped by Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-1">
                  Submitted Questionnaire Answers
                </h4>
                <span className="text-[11px] font-medium text-text-muted">
                  {selectedApp.answers?.length || 0} fields recorded
                </span>
              </div>

              {selectedApp.answers && selectedApp.answers.length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(
                    selectedApp.answers.reduce<Record<string, KycAnswerDetail[]>>((acc, ans) => {
                      const sec = ans.section || "General Information";
                      if (!acc[sec]) acc[sec] = [];
                      acc[sec].push(ans);
                      return acc;
                    }, {})
                  ).map(([sectionTitle, sectionAnswers]) => (
                    <div key={sectionTitle} className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted px-1 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                        <span>{sectionTitle}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {sectionAnswers.map((ans) => {
                          const isNullOrEmpty =
                            ans.value === null || ans.value === undefined || ans.value === "";
                          const isUnmapped =
                            Boolean(ans.isUnmapped || ans.fieldLabel === "Unmapped field");
                          const questionLabel = ans.fieldLabel || "Unmapped field";

                          return (
                            <div
                              key={ans.id}
                              className={`p-3.5 rounded-xl border space-y-2 transition-colors ${
                                isUnmapped
                                  ? "bg-amber-500/[0.04] border-amber-500/30 dark:border-amber-500/20"
                                  : "bg-canvas border-line-soft hover:border-line"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="space-y-1 min-w-0">
                                  <div className="text-[11.5px] text-text-primary font-semibold flex items-center gap-1.5 flex-wrap">
                                    <span>{questionLabel}</span>
                                    {ans.isRequired && (
                                      <span className="text-red-500 font-bold" title="Required field">
                                        *
                                      </span>
                                    )}
                                    {isUnmapped && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                        <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                                        <span>Unmapped field</span>
                                      </span>
                                    )}
                                  </div>

                                  {isUnmapped && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-mono text-text-muted">
                                        ID: {ans.fieldDefinitionId}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopy(ans.fieldDefinitionId, `id-${ans.id}`)}
                                        className="p-0.5 rounded hover:bg-surface text-text-muted hover:text-text-primary transition-colors inline-flex items-center shrink-0"
                                        title="Copy field identifier"
                                      >
                                        {copiedKey === `id-${ans.id}` ? (
                                          <Check className="h-2.5 w-2.5 text-emerald-600" />
                                        ) : (
                                          <Copy className="h-2.5 w-2.5" />
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {ans.dataType && (
                                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface border border-line-soft text-text-muted shrink-0">
                                    {ans.dataType}
                                  </span>
                                )}
                              </div>

                              {ans.fieldDescription && (
                                <p className="text-[11px] text-text-muted leading-tight">
                                  {ans.fieldDescription}
                                </p>
                              )}

                              <div className="text-[13px] font-medium text-text-primary break-words pt-0.5">
                                {isNullOrEmpty ? (
                                  <span className="text-text-muted italic text-xs">
                                    Not provided
                                  </span>
                                ) : typeof ans.value === "boolean" ? (
                                  <span
                                    className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                      ans.value
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                        : "bg-surface text-text-muted border border-line-soft"
                                    }`}
                                  >
                                    {ans.value ? "Yes" : "No"}
                                  </span>
                                ) : typeof ans.value === "object" ? (
                                  Array.isArray(ans.value) ? (
                                    ans.value.length === 0 ? (
                                      <span className="text-text-muted italic text-xs">
                                        Not provided
                                      </span>
                                    ) : (
                                      <div className="flex flex-wrap gap-1 items-center">
                                        {ans.value.map((item, idx) => (
                                          <span
                                            key={idx}
                                            className="px-2 py-0.5 rounded bg-surface border border-line-soft text-xs font-mono"
                                          >
                                            {typeof item === "object" ? JSON.stringify(item) : String(item)}
                                          </span>
                                        ))}
                                        <button
                                          type="button"
                                          onClick={() => handleCopy(JSON.stringify(ans.value), `arr-${ans.id}`)}
                                          className="p-1 rounded hover:bg-surface text-text-muted hover:text-text-primary transition-colors inline-flex items-center shrink-0 ml-1"
                                          title="Copy array"
                                        >
                                          {copiedKey === `arr-${ans.id}` ? (
                                            <Check className="h-3 w-3 text-emerald-600" />
                                          ) : (
                                            <Copy className="h-3 w-3" />
                                          )}
                                        </button>
                                      </div>
                                    )
                                  ) : (
                                    <div className="relative group">
                                      <pre className="text-[11px] font-mono bg-surface p-2.5 rounded-lg border border-line-soft overflow-x-auto whitespace-pre-wrap max-h-40 overflow-y-auto">
                                        {JSON.stringify(ans.value, null, 2)}
                                      </pre>
                                      <button
                                        type="button"
                                        onClick={() => handleCopy(JSON.stringify(ans.value, null, 2), `obj-${ans.id}`)}
                                        className="absolute top-2 right-2 p-1 rounded bg-surface/80 border border-line-soft text-text-muted hover:text-text-primary transition-colors opacity-80 group-hover:opacity-100"
                                        title="Copy JSON"
                                      >
                                        {copiedKey === `obj-${ans.id}` ? (
                                          <Check className="h-3 w-3 text-emerald-600" />
                                        ) : (
                                          <Copy className="h-3 w-3" />
                                        )}
                                      </button>
                                    </div>
                                  )
                                ) : (
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="break-words">{String(ans.value)}</span>
                                    {String(ans.value).length > 25 && (
                                      <button
                                        type="button"
                                        onClick={() => handleCopy(String(ans.value), `val-${ans.id}`)}
                                        className="p-1 rounded hover:bg-surface text-text-muted hover:text-text-primary transition-colors inline-flex items-center shrink-0"
                                        title="Copy value"
                                      >
                                        {copiedKey === `val-${ans.id}` ? (
                                          <Check className="h-3 w-3 text-emerald-600" />
                                        ) : (
                                          <Copy className="h-3 w-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-text-muted text-xs p-4 bg-canvas rounded-xl border border-line-soft">
                  No textual answers recorded for this submission cycle.
                </div>
              )}
            </section>

            {/* Verification Documents */}
            <section className="space-y-3">
              <h4 className="text-[12px] font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5 text-blue-600" />
                <span>Uploaded Documents ({selectedApp.documents?.length || 0})</span>
              </h4>
              {selectedApp.documents && selectedApp.documents.length > 0 ? (
                <div className="space-y-2">
                  {selectedApp.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 rounded-xl bg-canvas border border-line-soft flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="text-[13px] font-medium text-text-primary">{doc.originalFilename}</div>
                        <div className="text-[11.5px] text-text-muted flex items-center gap-2 mt-1">
                          <span>{doc.mimeType}</span>
                          <span>&middot;</span>
                          <StatusPill status={doc.status} />
                        </div>
                      </div>
                      <a
                        href={`/api/v1/admin/kyc/applications/${selectedApp.id}/documents/${doc.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors shadow-sm"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-text-muted text-xs p-3 bg-canvas rounded-xl border border-line-soft">
                  No binary documents uploaded for this cycle.
                </div>
              )}
            </section>
          </div>
        )}
      </AdminDrawer>

      {/* Mandatory Rejection Reason Dialog */}
      <AdminModal
        isOpen={rejectModalOpen}
        onClose={() => {
          setRejectModalOpen(false);
          setRejectionReason("");
        }}
        title="Reject KYC Application"
        description="Please provide a clear, mandatory reason for rejecting this KYC application."
        icon={XCircle}
        iconClassName="text-red-600 bg-red-50 dark:bg-red-950/40"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setRejectModalOpen(false);
                setRejectionReason("");
              }}
              className="px-4 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="reject-kyc-form"
              disabled={isRejecting || rejectionReason.trim().length < 3}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-xs font-semibold transition-colors disabled:opacity-50 press-feedback shadow-sm"
            >
              {isRejecting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Rejecting...</span>
                </>
              ) : (
                <span>Confirm Rejection</span>
              )}
            </button>
          </>
        }
      >
        <form id="reject-kyc-form" onSubmit={handleReject} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-text-primary">
              Rejection Reason (Required, min 3 characters)
            </label>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Document photo is blurry and illegible. Please submit a clearer scan."
              className="w-full rounded-xl border border-line bg-canvas p-3 text-xs text-text-primary placeholder:text-text-muted focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allowResubmission"
              checked={allowResubmission}
              onChange={(e) => setAllowResubmission(e.target.checked)}
              className="h-4 w-4 rounded border-line text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="allowResubmission" className="text-xs text-text-primary cursor-pointer select-none">
              Allow merchant to submit updated documents in a new cycle
            </label>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
