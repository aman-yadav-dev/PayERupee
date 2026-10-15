"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  Users,
  UserPlus,
  RefreshCw,
  Loader2,
  Trash2,
  LogOut,
  Edit2,
  Lock,
  Mail,
  User,
  KeyRound,
  AlertTriangle,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { AdminModal } from "@/components/admin/AdminModal";
import { AdminPagination } from "@/components/admin/AdminPagination";

interface AdminListItem {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN";
  createdAt: string;
  updatedAt: string;
  emailVerified: boolean;
  activeSessionsCount: number;
  isCurrentActor: boolean;
}

export default function AdminManagementPage() {
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Pagination & Filtering state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    role: "ADMIN" as "ADMIN" | "SUPER_ADMIN",
    password: "",
  });

  const [roleTarget, setRoleTarget] = useState<AdminListItem | null>(null);
  const [newRole, setNewRole] = useState<"ADMIN" | "SUPER_ADMIN">("ADMIN");
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const [sessionTarget, setSessionTarget] = useState<AdminListItem | null>(null);
  const [isRevokingSessions, setIsRevokingSessions] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AdminListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAdmins = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (roleFilter !== "ALL") params.set("role", roleFilter);

    fetch(`/api/v1/admin/admins?${params.toString()}`)
      .then(async (res) => {
        if (res.status === 403) {
          setAccessDenied(true);
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (!json) return;
        if (json.success && json.data) {
          setAdmins(json.data);
          setAccessDenied(false);
          if (json.meta) {
            setTotalCount(json.meta.total);
            setTotalPages(json.meta.totalPages);
          }
        } else {
          toast.error(json.error || "Failed to load administrator accounts");
        }
      })
      .catch(() => toast.error("Error communicating with admin management API"))
      .finally(() => setLoading(false));
  }, [page, pageSize, searchQuery, roleFilter]);

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (roleFilter !== "ALL") params.set("role", roleFilter);

    fetch(`/api/v1/admin/admins?${params.toString()}`)
      .then(async (res) => {
        if (res.status === 403) {
          if (mounted) setAccessDenied(true);
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (!mounted || !json) return;
        if (json.success && json.data) {
          setAdmins(json.data);
          setAccessDenied(false);
          if (json.meta) {
            setTotalCount(json.meta.total);
            setTotalPages(json.meta.totalPages);
          }
        } else {
          toast.error(json.error || "Failed to load administrator accounts");
        }
      })
      .catch(() => {
        if (mounted) toast.error("Error communicating with admin management API");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [page, pageSize, searchQuery, roleFilter]);

  const superAdminCount = admins.filter((a) => a.role === "SUPER_ADMIN").length;

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name || !createForm.email || !createForm.password) {
      toast.error("All fields are required.");
      return;
    }
    if (createForm.password.length < 10) {
      toast.error("Password must be at least 10 characters.");
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/v1/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create administrator");
      }
      toast.success(json.message || "Administrator account created successfully.");
      setCreateModalOpen(false);
      setCreateForm({ name: "", email: "", role: "ADMIN", password: "" });
      fetchAdmins();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error creating administrator");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!roleTarget) return;
    setIsUpdatingRole(true);
    try {
      const res = await fetch(`/api/v1/admin/admins/${roleTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update role");
      }
      toast.success(json.message || "Role updated successfully.");
      setRoleTarget(null);
      fetchAdmins();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error updating role");
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleRevokeSessions = async () => {
    if (!sessionTarget) return;
    setIsRevokingSessions(true);
    try {
      const res = await fetch(`/api/v1/admin/admins/${sessionTarget.id}/sessions`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to revoke sessions");
      }
      toast.success(json.message || "Sessions revoked successfully.");
      setSessionTarget(null);
      fetchAdmins();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error revoking sessions");
    } finally {
      setIsRevokingSessions(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/admin/admins/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to revoke admin privileges");
      }
      toast.success(json.message || "Administrator access revoked.");
      setDeleteTarget(null);
      fetchAdmins();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error revoking access");
    } finally {
      setIsDeleting(false);
    }
  };

  if (accessDenied) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
        <div className="rounded-2xl border border-line bg-surface p-8 sm:p-12 text-center shadow-[var(--shadow-card)] space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shadow-xs">
            <ShieldAlert className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary font-display">
              Super Administrator Privileges Required
            </h1>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-md mx-auto">
              Administrator management, role assignment, and provisioning operations are restricted to platform Super Administrators.
            </p>
          </div>

          <div className="rounded-xl border border-line bg-canvas p-4 text-left text-xs text-text-secondary space-y-1">
            <div className="flex items-center gap-2 font-medium text-text-primary">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Restricted Administrative Domain</span>
            </div>
            <p className="text-[11px] text-text-muted leading-normal">
              Your current account does not have sufficient governance privileges. If you need access to this console, please contact a platform Super Administrator.
            </p>
          </div>

          <div className="pt-2 flex justify-center">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 text-xs font-semibold transition-colors shadow-sm press-feedback"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-semibold text-text-primary tracking-tight flex items-center gap-2 font-display">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
              <span>Administrator Governance</span>
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/40">
              SUPER_ADMIN Only
            </span>
          </div>
          <p className="text-[13px] text-text-muted mt-0.5">
            Provision platform administrators, manage roles, audit privileges, and revoke active sessions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchAdmins}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-line text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-canvas transition-colors disabled:opacity-50 press-feedback shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 text-xs font-semibold transition-colors shadow-sm press-feedback"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Administrator</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-surface border border-line shadow-[var(--shadow-card)] space-y-1">
          <div className="flex items-center justify-between text-text-muted text-xs">
            <span>Total Administrators</span>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-[22px] font-semibold text-text-primary font-display tabular-nums">
            {admins.length}
          </div>
          <div className="text-[11px] text-text-muted">Active accounts with console access</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-[var(--shadow-card)] space-y-1">
          <div className="flex items-center justify-between text-text-muted text-xs">
            <span>Super Administrators</span>
            <ShieldCheck className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-[22px] font-semibold text-purple-600 font-display tabular-nums">
            {superAdminCount}
          </div>
          <div className="text-[11px] text-text-muted">Full administrative and provisioning authority</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-line shadow-[var(--shadow-card)] space-y-1">
          <div className="flex items-center justify-between text-text-muted text-xs">
            <span>Active Browser Sessions</span>
            <Lock className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-[22px] font-semibold text-emerald-600 font-display tabular-nums">
            {admins.reduce((acc, a) => acc + a.activeSessionsCount, 0)}
          </div>
          <div className="text-[11px] text-text-muted">Currently active authentication tokens</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-line bg-surface text-text-primary placeholder:text-text-muted text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all"
          />
        </div>

        <div className="overflow-x-auto table-scrollbar max-w-full py-0.5">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-canvas border border-line text-xs font-medium w-max">
            {["ALL", "SUPER_ADMIN", "ADMIN"].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setRoleFilter(tab);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  roleFilter === tab
                    ? "bg-surface text-text-primary shadow-sm font-semibold"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {tab === "ALL" ? "All Roles" : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Admins Table */}
      <div className="rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-text-muted text-xs">
            <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
            <span>Loading administrator directory...</span>
          </div>
        ) : admins.length === 0 ? (
          <div className="py-20 text-center text-text-muted text-xs">
            No administrators found.
          </div>
        ) : (
          <div className="overflow-x-auto table-scrollbar">
            <table className="w-full min-w-[680px] text-left text-[13px] border-collapse">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  <th className="py-3 px-2.5 sm:px-4">Administrator</th>
                  <th className="py-3 px-2 sm:px-4">Role</th>
                  <th className="py-3 px-3 hidden sm:table-cell">Active Sessions</th>
                  <th className="py-3 px-4 hidden lg:table-cell">Created Date</th>
                  <th className="py-3 px-2.5 sm:px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {admins.map((admin) => {
                  const isLastSuperAdmin = admin.role === "SUPER_ADMIN" && superAdminCount <= 1;

                  return (
                    <tr
                      key={admin.id}
                      onClick={() => {
                        if (!isLastSuperAdmin) {
                          setRoleTarget(admin);
                          setNewRole(admin.role === "SUPER_ADMIN" ? "ADMIN" : "SUPER_ADMIN");
                        }
                      }}
                      className={`transition-colors ${
                        !isLastSuperAdmin
                          ? "cursor-pointer group hover:bg-canvas/50"
                          : "hover:bg-canvas/50"
                      }`}
                    >
                      <td className="py-3 px-2.5 sm:px-4">
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                          <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold flex items-center justify-center text-xs shrink-0">
                            {admin.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-text-primary flex items-center gap-1 min-w-0">
                              <span className="truncate max-w-[95px] sm:max-w-[150px] lg:max-w-none">{admin.name}</span>
                              {admin.isCurrentActor && (
                                <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shrink-0">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] sm:text-[12px] text-text-muted font-mono truncate max-w-[95px] sm:max-w-[150px] lg:max-w-none">
                              {admin.email}
                            </div>
                            <div className="text-[10px] text-text-muted font-medium sm:hidden mt-0.5 truncate">
                              {admin.activeSessionsCount} active session{admin.activeSessionsCount === 1 ? '' : 's'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-2 sm:px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10.5px] sm:text-xs font-semibold ${
                            admin.role === "SUPER_ADMIN"
                              ? "bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/40"
                              : "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40"
                          }`}
                        >
                          <ShieldCheck className="h-3 w-3 shrink-0" />
                          <span className="hidden sm:inline">{admin.role}</span>
                          <span className="sm:hidden">{admin.role === "SUPER_ADMIN" ? "SUPER" : "ADMIN"}</span>
                        </span>
                      </td>

                      <td className="py-3 px-3 hidden sm:table-cell">
                        <span className="font-mono text-xs font-medium text-text-primary">
                          {admin.activeSessionsCount}
                        </span>
                        <span className="text-text-muted text-[11px] ml-1">session(s)</span>
                      </td>

                      <td className="py-3 px-4 text-xs text-text-muted hidden lg:table-cell">
                        {new Date(admin.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      <td className="py-3 px-2.5 sm:px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                          {/* Change Role Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRoleTarget(admin);
                              setNewRole(admin.role === "SUPER_ADMIN" ? "ADMIN" : "SUPER_ADMIN");
                            }}
                            disabled={isLastSuperAdmin}
                            title={isLastSuperAdmin ? "Cannot demote the only remaining Super Admin" : "Change Role"}
                            className="p-1.5 rounded-lg border border-line bg-surface text-text-secondary hover:text-purple-600 hover:bg-canvas transition-colors disabled:opacity-30 disabled:cursor-not-allowed press-feedback shadow-xs"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Revoke Sessions Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionTarget(admin);
                            }}
                            disabled={admin.activeSessionsCount === 0}
                            title="Revoke active sessions"
                            className="p-1.5 rounded-lg border border-line bg-surface text-text-secondary hover:text-amber-600 hover:bg-canvas transition-colors disabled:opacity-30 disabled:cursor-not-allowed press-feedback shadow-xs"
                          >
                            <LogOut className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete/Revoke Access Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(admin);
                            }}
                            disabled={admin.isCurrentActor || isLastSuperAdmin}
                            title={
                              admin.isCurrentActor
                                ? "Cannot revoke your own account"
                                : isLastSuperAdmin
                                ? "Cannot remove the only remaining Super Admin"
                                : "Revoke Administrator Access"
                            }
                            className="p-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed press-feedback shadow-xs"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-Side Pagination */}
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
          itemName="administrators"
          disabled={loading}
        />
      </div>

      {/* 1. Modal: Provision Administrator */}
      <AdminModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Provision New Administrator"
        description="Creates an authorized administrator account. Passwords are encrypted and hashed via Better Auth."
        icon={UserPlus}
        iconClassName="text-purple-600 bg-purple-50 dark:bg-purple-950/40"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              disabled={isCreating}
              className="px-4 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-admin-form"
              disabled={isCreating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 text-xs font-semibold transition-colors disabled:opacity-50 press-feedback shadow-sm"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Provisioning...</span>
                </>
              ) : (
                <span>Confirm & Provision</span>
              )}
            </button>
          </>
        }
      >
        <form id="create-admin-form" onSubmit={handleCreateAdmin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-text-primary flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-text-muted" />
              <span>Full Name</span>
            </label>
            <input
              type="text"
              required
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="e.g. Rahul Sharma"
              className="w-full px-3.5 py-2.5 bg-canvas border border-line rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-text-primary flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-text-muted" />
              <span>Corporate Email Address</span>
            </label>
            <input
              type="email"
              required
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="e.g. rahul@payerupee.com"
              className="w-full px-3.5 py-2.5 bg-canvas border border-line rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-purple-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-text-primary flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-text-muted" />
              <span>Administrative Role</span>
            </label>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setCreateForm({ ...createForm, role: "ADMIN" })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  createForm.role === "ADMIN"
                    ? "border-purple-600 bg-purple-50/60 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20"
                    : "border-line bg-canvas text-text-secondary"
                }`}
              >
                <div className="font-semibold text-xs">ADMIN</div>
                <div className="text-[11px] text-text-muted mt-0.5">Operational review and decisioning</div>
              </button>

              <button
                type="button"
                onClick={() => setCreateForm({ ...createForm, role: "SUPER_ADMIN" })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  createForm.role === "SUPER_ADMIN"
                    ? "border-purple-600 bg-purple-50/60 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20"
                    : "border-line bg-canvas text-text-secondary"
                }`}
              >
                <div className="font-semibold text-xs">SUPER_ADMIN</div>
                <div className="text-[11px] text-text-muted mt-0.5">Full governance and provisioning</div>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-text-primary flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-text-muted" />
              <span>Initial Password (min 10 characters)</span>
            </label>
            <input
              type="password"
              required
              minLength={10}
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="Enter secure initial password"
              className="w-full px-3.5 py-2.5 bg-canvas border border-line rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-mono"
            />
          </div>
        </form>
      </AdminModal>

      {/* 2. Modal: Change Role */}
      <AdminModal
        isOpen={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        title="Modify Administrator Role"
        description={`Update role privileges for ${roleTarget?.email}`}
        icon={Edit2}
        iconClassName="text-purple-600 bg-purple-50 dark:bg-purple-950/40"
        footer={
          <>
            <button
              type="button"
              onClick={() => setRoleTarget(null)}
              disabled={isUpdatingRole}
              className="px-4 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdateRole}
              disabled={isUpdatingRole}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 text-xs font-semibold transition-colors disabled:opacity-50 press-feedback shadow-sm"
            >
              {isUpdatingRole ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Updating Role...</span>
                </>
              ) : (
                <span>Confirm Role Change</span>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-canvas border border-line-soft text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-text-muted">Administrator:</span>
              <span className="font-semibold text-text-primary">{roleTarget?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Current Role:</span>
              <span className="font-semibold text-purple-600">{roleTarget?.role}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[12px] font-medium text-text-primary">Designate New Role</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNewRole("ADMIN")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  newRole === "ADMIN"
                    ? "border-purple-600 bg-purple-50/60 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20"
                    : "border-line bg-canvas text-text-secondary"
                }`}
              >
                <div className="font-semibold text-xs">ADMIN</div>
                <div className="text-[11px] text-text-muted mt-0.5">Operational role</div>
              </button>

              <button
                type="button"
                onClick={() => setNewRole("SUPER_ADMIN")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  newRole === "SUPER_ADMIN"
                    ? "border-purple-600 bg-purple-50/60 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20"
                    : "border-line bg-canvas text-text-secondary"
                }`}
              >
                <div className="font-semibold text-xs">SUPER_ADMIN</div>
                <div className="text-[11px] text-text-muted mt-0.5">Governance role</div>
              </button>
            </div>
          </div>
        </div>
      </AdminModal>

      {/* 3. Modal: Revoke Sessions */}
      <AdminModal
        isOpen={!!sessionTarget}
        onClose={() => setSessionTarget(null)}
        title="Revoke Active Sessions"
        description={`Terminate all active browser sessions for ${sessionTarget?.email}`}
        icon={LogOut}
        iconClassName="text-amber-600 bg-amber-50 dark:bg-amber-950/40"
        footer={
          <>
            <button
              type="button"
              onClick={() => setSessionTarget(null)}
              disabled={isRevokingSessions}
              className="px-4 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRevokeSessions}
              disabled={isRevokingSessions}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 text-xs font-semibold transition-colors disabled:opacity-50 press-feedback shadow-sm"
            >
              {isRevokingSessions ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Revoking...</span>
                </>
              ) : (
                <span>Revoke All Sessions</span>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            This will immediately invalidate all active authentication cookies and tokens for{" "}
            <span className="font-semibold text-text-primary">{sessionTarget?.name}</span> (
            <span className="font-mono">{sessionTarget?.email}</span>). The user will be forced to log in again with credentials.
          </p>
        </div>
      </AdminModal>

      {/* 4. Modal: Revoke Admin Privileges */}
      <AdminModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Revoke Administrator Access"
        description={`Permanently revoke administrative console privileges for ${deleteTarget?.email}`}
        icon={AlertTriangle}
        iconClassName="text-red-600 bg-red-50 dark:bg-red-950/40"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl border border-line bg-surface text-text-secondary hover:text-text-primary text-xs font-medium transition-colors press-feedback shadow-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteAdmin}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 text-xs font-semibold transition-colors disabled:opacity-50 press-feedback shadow-sm"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Revoking Access...</span>
                </>
              ) : (
                <span>Confirm Revocation</span>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 dark:bg-red-950/30 dark:border-red-900/40 text-xs text-red-800 dark:text-red-200 leading-relaxed">
            <span className="font-semibold">Security Action:</span> Administrative privileges will be permanently stripped. 
            All active sessions will be instantly terminated, and this action will be written to the platform audit trail.
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
