"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ClipboardList, Search, X } from "lucide-react";
import type { VaContentAssignmentRecord } from "@/types";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/custom-select";
import { ROUTES } from "@/lib/routes";

export type AdminVaContentAssignmentDTO = VaContentAssignmentRecord & {
  va_name: string;
  model_name: string;
};

export type AdminVaContentClientProps = {
  rows: AdminVaContentAssignmentDTO[];
  vaOptions: { id: string; full_name: string; status: string }[];
  modelOptions: { id: string; model_name: string }[];
};

function statusKey(s: string): string {
  return (s || "").trim().toLowerCase();
}

function ymdFromField(value: string | null | undefined): string | null {
  if (value == null || typeof value !== "string") return null;
  const t = value.trim();
  if (t.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const d = Date.parse(t);
  if (!Number.isFinite(d)) return null;
  return new Date(d).toISOString().slice(0, 10);
}

function dateInOrOverlapsRange(
  createdRaw: string,
  deadlineRaw: string | null,
  fromYmd: string,
  toYmd: string
): boolean {
  if (!fromYmd && !toYmd) return true;
  const created = ymdFromField(createdRaw);
  const deadline = ymdFromField(deadlineRaw ?? null);

  const inRange = (ymd: string | null): boolean => {
    if (!ymd) return false;
    if (fromYmd && ymd < fromYmd) return false;
    if (toYmd && ymd > toYmd) return false;
    return true;
  };

  return inRange(created) || inRange(deadline);
}

type StatusFilterValue = "all" | "pending" | "pending_approval" | "rejected" | "completed" | "cancelled" | "scheduled";

function StatusBadge({ status }: { status: string }) {
  const k = statusKey(status);
  const label = (status || "—").trim() || "—";
  const variant =
    k === "completed"
      ? "bg-green-500/20 text-green-400 border border-green-500/30"
      : k === "pending"
        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
        : k === "pending_approval"
          ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
          : k === "rejected"
            ? "bg-rose-500/20 text-rose-300 border border-rose-500/35"
            : k === "cancelled"
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : k === "scheduled"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "border border-white/15 bg-white/10 text-white/70";

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        variant
      )}
    >
      {label}
    </span>
  );
}

const selectTriggerClass =
  "border-white/12 bg-black/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-pink-400/25 hover:bg-white/[0.06]";

export function AdminVaContentClient({ rows, vaOptions, modelOptions }: AdminVaContentClientProps) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const [reviewModal, setReviewModal] = React.useState<AdminVaContentAssignmentDTO | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editDeadline, setEditDeadline] = React.useState("");
  const [editPriority, setEditPriority] = React.useState("normal");
  const [editAdminNotes, setEditAdminNotes] = React.useState("");
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [reviewing, setReviewing] = React.useState(false);

  React.useEffect(() => {
    if (!reviewModal) return;
    setEditTitle(reviewModal.title ?? "");
    setEditDescription(reviewModal.description ?? "");
    const d = (reviewModal.deadline ?? "").trim();
    setEditDeadline(d.length >= 10 ? d.slice(0, 10) : "");
    setEditPriority((reviewModal.priority ?? "normal").trim().toLowerCase() || "normal");
    setEditAdminNotes("");
    setRejectionReason("");
  }, [reviewModal]);

  const pendingApprovalItems = React.useMemo(
    () => rows.filter((r) => statusKey(r.status) === "pending_approval"),
    [rows]
  );

  const [searchTitle, setSearchTitle] = React.useState("");
  const [filterModelId, setFilterModelId] = React.useState("");
  const [filterVaId, setFilterVaId] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState<StatusFilterValue>("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const modelSelectOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const m of modelOptions) {
      map.set(m.id, (m.model_name || "").trim() || "Model");
    }
    for (const r of rows) {
      map.set(r.model_id, (r.model_name || "").trim() || "Model");
    }
    const entries = [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    return [{ value: "", label: "All Models" }, ...entries.map(([value, label]) => ({ value, label }))];
  }, [rows, modelOptions]);

  const vaSelectOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vaOptions) {
      map.set(v.id, (v.full_name || "").trim() || "VA");
    }
    for (const r of rows) {
      const id = r.va_id?.trim() || "";
      const name = (r.va_name || "").trim() || "Unassigned";
      if (id) map.set(id, name);
    }
    const entries = [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    return [{ value: "", label: "All VAs" }, { value: "__unassigned__", label: "Unassigned" }, ...entries.map(([value, label]) => ({ value, label }))];
  }, [rows, vaOptions]);

  const statusSelectOptions = React.useMemo(
    () => [
      { value: "all", label: "All Statuses" },
      { value: "pending_approval", label: "Pending approval" },
      { value: "pending", label: "Pending (model)" },
      { value: "rejected", label: "Rejected" },
      { value: "completed", label: "Completed" },
      { value: "cancelled", label: "Cancelled" },
      { value: "scheduled", label: "Scheduled" },
    ],
    []
  );

  const filteredRows = React.useMemo(() => {
    const q = searchTitle.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !(r.title || "").toLowerCase().includes(q)) return false;
      if (filterModelId && r.model_id !== filterModelId) return false;
      if (filterVaId === "__unassigned__") {
        if ((r.va_id ?? "").trim()) return false;
      } else if (filterVaId && r.va_id !== filterVaId) return false;
      if (filterStatus !== "all" && statusKey(r.status) !== filterStatus) return false;
      if (!dateInOrOverlapsRange(r.created_at, r.deadline, dateFrom, dateTo)) return false;
      return true;
    });
  }, [rows, searchTitle, filterModelId, filterVaId, filterStatus, dateFrom, dateTo]);

  const filtersActive =
    searchTitle.trim() !== "" ||
    filterModelId !== "" ||
    filterVaId !== "" ||
    filterStatus !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  const clearFilters = () => {
    setSearchTitle("");
    setFilterModelId("");
    setFilterVaId("");
    setFilterStatus("all");
    setDateFrom("");
    setDateTo("");
  };

  const onRemind = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/va-content/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: id }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error ?? "Remind failed");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  async function handleReview(action: "approve" | "reject" | "edit_and_approve") {
    if (!reviewModal) return;
    setReviewing(true);
    try {
      const res = await fetch(`/api/admin/va-content-assignments/${reviewModal.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action,
          rejection_reason: rejectionReason,
          edits: {
            title: editTitle,
            description: editDescription,
            deadline: editDeadline.trim() ? editDeadline.trim() : null,
            priority: editPriority,
            admin_edit_notes: editAdminNotes,
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error ?? "Review failed");
        return;
      }
      setReviewModal(null);
      router.refresh();
    } catch (e) {
      console.error(e);
      alert("Review failed");
    } finally {
      setReviewing(false);
    }
  }

  const onCancel = async (id: string) => {
    const reason = window.prompt("Cancellation reason (min 3 characters):")?.trim();
    if (!reason || reason.length < 3) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/va-content/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: id, reason }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error ?? "Cancel failed");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  };

  const showActionButtons = (r: AdminVaContentAssignmentDTO) => {
    const k = statusKey(r.status);
    return k === "pending" || k === "scheduled" || k === "pending_approval";
  };

  const showRemind = (r: AdminVaContentAssignmentDTO) => {
    const k = statusKey(r.status);
    return k === "pending";
  };

  const showCancel = (r: AdminVaContentAssignmentDTO) => showActionButtons(r);

  const showReview = (r: AdminVaContentAssignmentDTO) => statusKey(r.status) === "pending_approval";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">VA content assignments</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/60">
            Remind models or cancel assignments from the agency side. Use filters to narrow the list; all data is loaded
            already and updates when you refresh the page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-pink-400/35 px-4 py-2.5 text-sm font-semibold text-pink-50 shadow-[0_0_24px_-8px_hsl(330_80%_55%/0.35)] transition hover:brightness-110",
            "bg-gradient-to-r from-pink-500/25 to-fuchsia-600/20"
          )}
        >
          + New assignment
        </button>
      </div>

      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[201] w-[min(calc(100vw-2rem),440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-zinc-950/95 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-pink-500/25 bg-pink-500/15 text-pink-200">
                <ClipboardList className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-lg font-semibold text-white">Create new assignments</Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-relaxed text-white/55">
                  In the app, new VA content rows are created by accounts with the{""}
                  <span className="font-medium text-white/75">Virtual Assistant</span> role from their{""}
                  <span className="font-medium text-white/75">Content assignments</span> workspace (the form posts as
                  that VA user). Admins and managers can still add or edit rows in Airtable if needed.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
            <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/45">
              VA path (sign in as a VA):{""}
              <span className="font-mono text-white/65">{ROUTES.va.contentAssignments}</span>
            </p>
            <div className="mt-5 flex justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
                >
                  Got it
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {pendingApprovalItems.length > 0 ? (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 shrink-0 rounded-full bg-sky-400 animate-pulse" aria-hidden />
            <p className="text-sky-300 font-semibold text-sm">
              {pendingApprovalItems.length} assignment{pendingApprovalItems.length > 1 ? "s" : ""} waiting for review
            </p>
          </div>
          <div className="space-y-2">
            {pendingApprovalItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl bg-black/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm text-white truncate">{item.title}</p>
                  <p className="text-white/45 text-xs mt-0.5">
                    {item.va_name} → {item.model_name} · {item.content_type}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewModal(item)}
                  className="shrink-0 rounded-xl border border-sky-500/35 bg-sky-500/15 px-3 py-1.5 text-sky-200 text-xs font-semibold transition hover:bg-sky-500/25"
                >
                  Review →
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {reviewModal ? (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl"
            role="dialog"
            aria-modal
            aria-labelledby="va-review-title"
          >
            <h3 id="va-review-title" className="text-white font-bold text-xl mb-1">
              Review assignment
            </h3>
            <p className="text-white/40 text-sm mb-5">
              {reviewModal.va_name} → {reviewModal.model_name}
            </p>

            <div className="mb-5 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Title</p>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-pink-500/50"
                />
              </div>
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Description</p>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-pink-500/50"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Deadline</p>
                  <input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-pink-500/50 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Priority</p>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Edit notes (optional)</p>
                <textarea
                  value={editAdminNotes}
                  onChange={(e) => setEditAdminNotes(e.target.value)}
                  rows={2}
                  placeholder="Note what you changed…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-pink-500/50"
                />
              </div>
            </div>

            <div className="mb-5">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Rejection reason (required to reject)</p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
                placeholder="Explain why this is being rejected…"
                className="w-full resize-none rounded-xl border border-rose-500/25 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-rose-500/50"
              />
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void handleReview("approve")}
                disabled={reviewing}
                className="w-full rounded-2xl border border-emerald-500/35 bg-emerald-500/15 py-3 font-bold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-40"
              >
                Approve &amp; send to model
              </button>
              <button
                type="button"
                onClick={() => void handleReview("edit_and_approve")}
                disabled={reviewing}
                className="w-full rounded-2xl border border-sky-500/35 bg-sky-500/15 py-3 font-bold text-sky-200 transition hover:bg-sky-500/25 disabled:opacity-40"
              >
                Edit &amp; approve
              </button>
              <button
                type="button"
                onClick={() => void handleReview("reject")}
                disabled={reviewing || !rejectionReason.trim()}
                className="w-full rounded-2xl border border-rose-500/40 bg-rose-500/15 py-3 font-bold text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-40"
              >
                Reject (send reason to VA)
              </button>
              <button
                type="button"
                onClick={() => setReviewModal(null)}
                disabled={reviewing}
                className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 text-white/55 transition hover:bg-white/10 disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl md:p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0 md:col-span-2 lg:col-span-2">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-pink-200/70">
              <Search className="h-3 w-3 opacity-80" aria-hidden />
              Search
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-pink-300/40" aria-hidden />
              <input
                type="search"
                placeholder="Search by title…"
                value={searchTitle}
                onChange={(e) => setSearchTitle(e.target.value)}
                className={cn(
                  "h-11 w-full rounded-xl border py-0 pl-10 pr-4 text-sm text-white outline-none transition-all",
                  "border-white/12 bg-black/35 placeholder:text-white/35",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
                  "focus:border-pink-400/45 focus:bg-black/50 focus:ring-2 focus:ring-pink-500/20"
                )}
              />
            </div>
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Model</p>
            <CustomSelect
              value={filterModelId}
              onChange={setFilterModelId}
              options={modelSelectOptions}
              triggerClassName={selectTriggerClass}
              portaled
            />
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">VA</p>
            <CustomSelect
              value={filterVaId}
              onChange={setFilterVaId}
              options={vaSelectOptions}
              triggerClassName={selectTriggerClass}
              portaled
            />
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Status</p>
            <CustomSelect
              value={filterStatus}
              onChange={(v) => setFilterStatus((v || "all") as StatusFilterValue)}
              options={statusSelectOptions}
              triggerClassName={selectTriggerClass}
              portaled
            />
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">From</p>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={cn(
                "h-11 w-full rounded-xl border px-3 text-sm text-white outline-none transition-all [color-scheme:dark]",
                "border-white/12 bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
                "focus:border-pink-400/45 focus:ring-2 focus:ring-pink-500/20"
              )}
            />
          </div>
          <div className="min-w-0">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">To</p>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={cn(
                "h-11 w-full rounded-xl border px-3 text-sm text-white outline-none transition-all [color-scheme:dark]",
                "border-white/12 bg-black/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
                "focus:border-pink-400/45 focus:ring-2 focus:ring-pink-500/20"
              )}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/55">
            Showing <span className="font-semibold text-white/90">{filteredRows.length}</span> of{""}
            <span className="font-semibold text-white/90">{rows.length}</span> assignments
          </p>
          {filtersActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className="self-start rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-pink-400/30 hover:bg-pink-500/10 hover:text-pink-100 sm:self-auto"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm text-white/90">
            <thead className="border-b border-white/10 bg-white/[0.04] text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
              <tr>
                <th className="px-4 py-3.5 font-medium md:px-5">VA</th>
                <th className="px-4 py-3.5 font-medium md:px-5">Model</th>
                <th className="px-4 py-3.5 font-medium md:px-5">Title</th>
                <th className="px-4 py-3.5 font-medium md:px-5">Status</th>
                <th className="px-4 py-3.5 text-right font-medium md:px-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center md:px-5">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/35">
                        <ClipboardList className="h-7 w-7" aria-hidden />
                      </div>
                      <p className="mt-4 text-base font-semibold text-white/90">No assignments yet</p>
                      <p className="mt-2 text-sm leading-relaxed text-white/50">
                        When VAs create content work for models, rows will show up here for agency oversight.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center md:px-5">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-200/90">
                        <Search className="h-6 w-6" aria-hidden />
                      </div>
                      <p className="mt-3 text-sm font-medium text-white/85">No assignments match your filters</p>
                      <p className="mt-1.5 text-xs text-white/45">Try clearing filters or widening the date range.</p>
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-4 rounded-xl border border-pink-400/35 bg-gradient-to-r from-pink-500/20 to-fuchsia-600/15 px-4 py-2 text-xs font-semibold text-pink-100 transition hover:brightness-110"
                      >
                        Clear filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-white/[0.06] transition-colors last:border-b-0 hover:bg-white/5"
                  >
                    <td className="px-4 py-3.5 align-middle text-white/85 md:px-5">{r.va_name}</td>
                    <td className="px-4 py-3.5 align-middle text-white/85 md:px-5">{r.model_name}</td>
                    <td className="max-w-[280px] px-4 py-3.5 align-middle font-medium text-white md:max-w-xs md:px-5">
                      <span className="line-clamp-2">{r.title || "—"}</span>
                    </td>
                    <td className="px-4 py-3.5 align-middle md:px-5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle md:px-5">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {showReview(r) ? (
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => setReviewModal(r)}
                            className={cn(
                              "rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-200",
                              "transition hover:border-sky-400/55 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            )}
                          >
                            Review
                          </button>
                        ) : null}
                        {showRemind(r) ? (
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void onRemind(r.id)}
                            className={cn(
                              "rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-xs font-medium text-white/85",
                              "transition hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                            )}
                          >
                            Remind
                          </button>
                        ) : null}
                        {showCancel(r) ? (
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void onCancel(r.id)}
                            className={cn(
                              "rounded-lg border border-rose-500/40 bg-transparent px-3 py-1.5 text-xs font-medium text-rose-200",
                              "transition hover:border-rose-400/55 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                            )}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
