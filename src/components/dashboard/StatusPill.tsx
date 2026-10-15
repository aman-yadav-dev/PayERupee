import { cn } from "@/lib/utils";

export type StatusType =
  | "completed"
  | "active"
  | "approved"
  | "pending"
  | "pending_submission"
  | "pending_verification"
  | "under_review"
  | "processing"
  | "failed"
  | "rejected"
  | "suspended"
  | "reversed"
  | "validation_failed"
  | "unknown";

const config: Record<
  StatusType,
  { label: string; dot: string; text: string; bg: string }
> = {
  completed: { label: "Completed", dot: "bg-blue-600", text: "text-blue-700 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-950/40" },
  active: { label: "Active", dot: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/40" },
  approved: { label: "Approved", dot: "bg-emerald-600", text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/40" },
  pending: { label: "Pending", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950/40" },
  pending_submission: { label: "Pending Submission", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950/40" },
  pending_verification: { label: "Pending Verification", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-950/40" },
  under_review: { label: "Under Review", dot: "bg-indigo-500", text: "text-indigo-700 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/40" },
  processing: { label: "Processing", dot: "bg-indigo-500", text: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-950/40" },
  failed: { label: "Failed", dot: "bg-coral-500", text: "text-coral-600 dark:text-coral-400", bg: "bg-coral-100 dark:bg-coral-950/40" },
  rejected: { label: "Rejected", dot: "bg-coral-500", text: "text-coral-700 dark:text-coral-400", bg: "bg-coral-100 dark:bg-coral-950/40" },
  suspended: { label: "Suspended", dot: "bg-red-500", text: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-950/40" },
  reversed: { label: "Reversed", dot: "bg-neutral-500", text: "text-text-secondary", bg: "bg-neutral-chip" },
  validation_failed: {
    label: "Validation failed",
    dot: "bg-neutral-500",
    text: "text-text-secondary",
    bg: "bg-neutral-chip",
  },
  unknown: { label: "Not Available", dot: "bg-neutral-500", text: "text-text-secondary", bg: "bg-neutral-chip" },
};

export function StatusPill({ status }: { status?: StatusType | string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium bg-neutral-chip text-text-secondary">
        <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
        Not Provided
      </span>
    );
  }

  const raw = String(status).trim();
  const normalized = raw.toLowerCase().replace(/[-\s]+/g, "_");

  let mapped: StatusType;
  if (normalized === "success" || normalized === "completed") mapped = "completed";
  else if (normalized === "active") mapped = "active";
  else if (normalized === "approved") mapped = "approved";
  else if (normalized === "pending") mapped = "pending";
  else if (normalized === "pending_submission") mapped = "pending_submission";
  else if (normalized === "pending_verification") mapped = "pending_verification";
  else if (normalized === "under_review") mapped = "under_review";
  else if (
    normalized === "processing" ||
    normalized === "in_flight" ||
    normalized === "queued" ||
    normalized === "submitted" ||
    normalized === "initiated"
  )
    mapped = "processing";
  else if (normalized === "failed") mapped = "failed";
  else if (normalized === "rejected") mapped = "rejected";
  else if (normalized === "suspended") mapped = "suspended";
  else if (normalized === "reversed") mapped = "reversed";
  else if (normalized === "validation_failed") mapped = "validation_failed";
  else if ((normalized as StatusType) in config) mapped = normalized as StatusType;
  else {
    // Graceful formatting for any domain status instead of showing "Unknown"
    const label = raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium bg-neutral-chip text-text-secondary">
        <span className="h-1.5 w-1.5 rounded-full bg-neutral-500" />
        {label}
      </span>
    );
  }

  const c = config[mapped] || config["unknown"];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium",
        c.bg,
        c.text
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {c.label}
    </span>
  );
}
