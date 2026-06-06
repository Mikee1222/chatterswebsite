"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Gauge,
  ListChecks,
  Search,
  Timer,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { BeautifulDetailModal } from "@/components/beautiful-detail-modal";
import { MobileCard } from "@/components/mobile-card";
import { FormInput } from "@/components/ui/form-input";
import { GlassModal } from "@/components/ui/glass-modal";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { gradientClassForContentType } from "@/lib/detail-modal-gradients";
import { formatDateEuropean } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { VaContentAssignmentRecord } from "@/types";

export type AdminVaContentAssignmentDTO = VaContentAssignmentRecord & {
  va_name: string;
  model_name: string;
};

export type AdminVaContentClientProps = {
  rows: AdminVaContentAssignmentDTO[];
  vaOptions: { id: string; full_name: string; status: string }[];
  modelOptions: { id: string; model_name: string }[];
};

type StatusFilterValue =
  | "all"
  | "pending_approval"
  | "pending"
  | "scheduled"
  | "completed"
  | "rejected"
  | "cancelled";

function statusKey(s: string): string {
  return (s || "").trim().toLowerCase();
}

function statusLabelForList(s: string): string {
  const k = statusKey(s);
  if (k === "pending_approval") return "pending approval";
  return k || "—";
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

function priorityClass(p: string): string {
  const x = (p || "").toLowerCase();
  if (x === "urgent") return "border-rose-500/40 bg-rose-500/15 text-rose-200";
  if (x === "high") return "border-amber-500/35 bg-amber-500/12 text-amber-200";
  if (x === "low") return "border-white/15 bg-white/[0.06] text-white/65";
  return "border-sky-400/30 bg-sky-500/12 text-sky-200";
}

function StatusBadge({ status }: { status: string }) {
  const k = statusKey(status);
  const label = statusLabelForList(status);
  const variant =
    k === "completed"
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
      : k === "pending"
        ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
        : k === "pending_approval"
          ? "border-sky-500/30 bg-sky-500/15 text-sky-300"
          : k === "rejected"
            ? "border-rose-500/35 bg-rose-500/15 text-rose-300"
            : k === "cancelled"
              ? "border-red-500/30 bg-red-500/15 text-red-300"
              : k === "scheduled"
                ? "border-violet-500/30 bg-violet-500/15 text-violet-300"
                : "border-white/15 bg-white/[0.06] text-white/70";

  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize", variant)}>
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accentClass,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  accentClass: string;
}) {
  return (
    <MobileCard
      padding="md"
      className={cn("min-w-[140px] shrink-0 snap-start border-white/10 bg-white/[0.04]", accentClass)}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/55">
          <Icon className="h-4 w-4" aria-hidden />
        </div>
      </div>
    </MobileCard>
  );
}

const STATUS_TABS: StatusFilterValue[] = [
  "pending_approval",
  "pending",
  "scheduled",
  "completed",
  "rejected",
];

export function AdminVaContentClient({ rows, vaOptions, modelOptions }: AdminVaContentClientProps) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  const [reviewModal, setReviewModal] = React.useState<AdminVaContentAssignmentDTO | null>(null);
  const [selected, setSelected] = React.useState<AdminVaContentAssignmentDTO | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editDeadline, setEditDeadline] = React.useState("");
  const [editPriority, setEditPriority] = React.useState("normal");
  const [editAdminNotes, setEditAdminNotes] = React.useState("");
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [reviewing, setReviewing] = React.useState(false);

  const [searchTitle, setSearchTitle] = React.useState("");
  const [filterModelId, setFilterModelId] = React.useState("");
  const [filterVaId, setFilterVaId] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState<StatusFilterValue>("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

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
    return [
      { value: "", label: "All VAs" },
      { value: "__unassigned__", label: "Unassigned" },
      ...entries.map(([value, label]) => ({ value, label })),
    ];
  }, [rows, vaOptions]);

  const counts = React.useMemo(() => {
    const c = {
      total: rows.length,
      pending_approval: 0,
      pending: 0,
      scheduled: 0,
      completed: 0,
      rejected: 0,
    };
    for (const r of rows) {
      const k = statusKey(r.status);
      if (k in c) (c as Record<string, number>)[k] += 1;
    }
    return c;
  }, [rows]);

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

  const { page, setPage, totalPages, paginated, reset } = usePagination(filteredRows, 20);

  React.useEffect(() => {
    reset();
  }, [searchTitle, filterModelId, filterVaId, filterStatus, dateFrom, dateTo, reset]);

  const filtersActive =
    searchTitle.trim() !== "" ||
    filterModelId !== "" ||
    filterVaId !== "" ||
    filterStatus !== "all" ||
    dateFrom !== "" ||
    dateTo !== "";

  const activeFilterCount =
    (searchTitle.trim() ? 1 : 0) +
    (filterModelId ? 1 : 0) +
    (filterVaId ? 1 : 0) +
    (filterStatus !== "all" ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const clearFilters = () => {
    setSearchTitle("");
    setFilterModelId("");
    setFilterVaId("");
    setFilterStatus("all");
    setDateFrom("");
    setDateTo("");
  };

  const tabLabel = (key: StatusFilterValue): string => {
    if (key === "all") return "All";
    if (key === "pending_approval") return "Pending approval";
    if (key === "pending") return "Pending";
    if (key === "scheduled") return "Scheduled";
    if (key === "completed") return "Completed";
    if (key === "rejected") return "Rejected";
    return "Cancelled";
  };

  const tabCount = (key: StatusFilterValue): number => {
    if (key === "all") return counts.total;
    return (counts as Record<string, number>)[key] ?? 0;
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

  const showRemind = (r: AdminVaContentAssignmentDTO) => statusKey(r.status) === "pending";

  const showCancel = (r: AdminVaContentAssignmentDTO) => showActionButtons(r);

  const showReview = (r: AdminVaContentAssignmentDTO) => statusKey(r.status) === "pending_approval";

  const pendingApprovalItems = React.useMemo(
    () => rows.filter((r) => statusKey(r.status) === "pending_approval"),
    [rows]
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Administration</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">VA content assignments</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            Review VA-submitted work, approve assignments for models, and manage reminders or cancellations from the
            agency side.
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
      </header>

      <div className="-mx-1 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
        <div className="flex min-w-min gap-3">
          <StatCard label="Total" value={counts.total} icon={ListChecks} accentClass="border-white/10 ring-white/[0.06]" />
          <StatCard
            label="Pending approval"
            value={counts.pending_approval}
            icon={Clock}
            accentClass="border-sky-500/25 bg-sky-500/5 ring-sky-500/10"
          />
          <StatCard
            label="Pending"
            value={counts.pending}
            icon={Timer}
            accentClass="border-amber-500/25 bg-amber-500/5 ring-amber-500/10"
          />
          <StatCard
            label="Scheduled"
            value={counts.scheduled}
            icon={CalendarClock}
            accentClass="border-violet-500/25 bg-violet-500/5 ring-violet-500/10"
          />
          <StatCard
            label="Completed"
            value={counts.completed}
            icon={CheckCircle2}
            accentClass="border-emerald-500/25 bg-emerald-500/5 ring-emerald-500/10"
          />
          <StatCard
            label="Rejected"
            value={counts.rejected}
            icon={XCircle}
            accentClass="border-rose-500/25 bg-rose-500/5 ring-rose-500/10"
          />
        </div>
      </div>

      {pendingApprovalItems.length > 0 ? (
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4 md:p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-sky-400" aria-hidden />
            <p className="text-sm font-semibold text-sky-300">
              {pendingApprovalItems.length} assignment{pendingApprovalItems.length > 1 ? "s" : ""} waiting for review
            </p>
          </div>
          <div className="space-y-2">
            {pendingApprovalItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl bg-black/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-0.5 text-xs text-white/45">
                    {item.va_name} → {item.model_name} · {item.content_type}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewModal(item)}
                  className="shrink-0 rounded-xl border border-sky-500/35 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/25"
                >
                  Review →
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/45">Status</span>
          {(["all", ...STATUS_TABS] as StatusFilterValue[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterStatus(key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filterStatus === key
                  ? "border-pink-400/55 bg-pink-500/20 text-pink-100"
                  : "border-white/12 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
              )}
            >
              {tabLabel(key)}
              <span className="ml-1 text-white/45">{tabCount(key)}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="relative md:col-span-2 lg:col-span-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <FormInput
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
              placeholder="Search by title…"
              className="border-white/10 bg-zinc-950/80 pl-9"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-white/50">Model</label>
            <select
              value={filterModelId}
              onChange={(e) => setFilterModelId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              {modelSelectOptions.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-white/50">VA</label>
            <select
              value={filterVaId}
              onChange={(e) => setFilterVaId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              {vaSelectOptions.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-white/50">From</label>
              <FormInput
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="border-white/10 bg-zinc-950/80 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-white/50">To</label>
              <FormInput
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="border-white/10 bg-zinc-950/80 [color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeFilterCount > 0 ? (
            <span className="rounded-full border border-pink-500/35 bg-pink-500/10 px-2 py-0.5 text-[11px] font-medium text-pink-100">
              {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
            </span>
          ) : null}
          <button
            type="button"
            onClick={clearFilters}
            disabled={!filtersActive}
            className="inline-flex items-center gap-1 text-xs font-medium text-pink-300/90 underline-offset-4 hover:text-pink-200 hover:underline disabled:opacity-40"
          >
            <X className="h-3 w-3" aria-hidden />
            Clear filters
          </button>
          <span className="ml-auto text-xs text-white/45">
            {filteredRows.length} of {rows.length} assignments
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/35">
            <ClipboardList className="h-7 w-7" aria-hidden />
          </div>
          <p className="mt-4 text-sm font-medium text-white/75">No assignments yet</p>
          <p className="mt-1 text-xs text-white/45">
            When VAs create content work for models, rows will show up here for agency oversight.
          </p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-200/90">
            <Search className="h-6 w-6" aria-hidden />
          </div>
          <p className="mt-3 text-sm font-medium text-white/85">No assignments match your filters</p>
          <p className="mt-1 text-xs text-white/45">Try clearing filters or widening the date range.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-pink-500/35 bg-pink-500/15 px-4 py-2 text-xs font-semibold text-pink-200 hover:bg-pink-500/25"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((r) => (
              <MobileCard
                key={r.id}
                onClick={() => setSelected(r)}
                padding="none"
                className="flex overflow-hidden border-white/10 bg-zinc-950/80 ring-white/[0.06] transition hover:bg-white/[0.03]"
              >
                <div
                  className={cn("w-1 shrink-0 bg-gradient-to-b", gradientClassForContentType(r.content_type))}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 p-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white" title={r.title || "—"}>
                        {r.title || "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-white/55">
                        {r.va_name} → {r.model_name}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/70">
                      {r.content_type || "Type"}
                    </span>
                    <span
                      className={cn(
                        "inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
                        priorityClass(r.priority)
                      )}
                    >
                      {r.priority || "normal"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
                      <CalendarClock className="h-3 w-3" aria-hidden />
                      Due {formatDateEuropean(r.deadline)}
                    </span>
                  </div>

                  {statusKey(r.status) === "rejected" && (r.rejection_reason ?? "").trim() ? (
                    <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2">
                      <p className="text-[11px] font-semibold text-rose-300">Rejected</p>
                      <p className="mt-0.5 text-[11px] text-white/55">{r.rejection_reason}</p>
                    </div>
                  ) : null}

                  {showActionButtons(r) ? (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3" onClick={(e) => e.stopPropagation()}>
                      {showReview(r) ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => setReviewModal(r)}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-500/35 bg-sky-500/15 py-2 text-xs font-medium text-sky-200 hover:bg-sky-500/25 disabled:opacity-50"
                        >
                          Review
                        </button>
                      ) : null}
                      {showRemind(r) ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void onRemind(r.id)}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 py-2 text-xs font-medium text-white/85 hover:bg-white/10 disabled:opacity-50"
                        >
                          <Bell className="h-3.5 w-3.5" aria-hidden />
                          Remind
                        </button>
                      ) : null}
                      {showCancel(r) ? (
                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => void onCancel(r.id)}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/15 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/25 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </MobileCard>
            ))}
          </div>

          <PaginationControls page={page} totalPages={totalPages} onPage={setPage} totalItems={filteredRows.length} />
        </>
      )}

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
                  In the app, new VA content rows are created by accounts with the{" "}
                  <span className="font-medium text-white/75">Virtual Assistant</span> role from their{" "}
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
              VA path (sign in as a VA):{" "}
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

      {reviewModal ? (
        <GlassModal
          onClose={() => !reviewing && setReviewModal(null)}
          title="Review assignment"
          subtitle={`${reviewModal.va_name} → ${reviewModal.model_name}`}
          className="md:max-w-lg"
        >
          <div className="space-y-5 p-5">
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div>
                <p className="mb-1 text-xs uppercase tracking-widest text-white/40">Title</p>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-pink-500/50"
                />
              </div>
              <div>
                <p className="mb-1 text-xs uppercase tracking-widest text-white/40">Description</p>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-pink-500/50"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-widest text-white/40">Deadline</p>
                  <input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-pink-500/50 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-widest text-white/40">Priority</p>
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
                <p className="mb-1 text-xs uppercase tracking-widest text-white/40">Edit notes (optional)</p>
                <textarea
                  value={editAdminNotes}
                  onChange={(e) => setEditAdminNotes(e.target.value)}
                  rows={2}
                  placeholder="Note what you changed…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-pink-500/50"
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-white/40">Rejection reason (required to reject)</p>
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
        </GlassModal>
      ) : null}

      <BeautifulDetailModal
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.title || "Assignment details"}
        subtitle={selected ? `${selected.va_name} → ${selected.model_name} · ${selected.content_type || "Content"}` : ""}
        badge="VA content assignment"
        headerGradientClass={selected ? gradientClassForContentType(selected.content_type) : undefined}
        stats={
          selected
            ? [
                {
                  label: "Status",
                  value: statusLabelForList(selected.status),
                  accent: "blue" as const,
                  icon: <ListChecks className="h-5 w-5" aria-hidden />,
                },
                {
                  label: "Priority",
                  value: selected.priority || "normal",
                  accent: "purple" as const,
                  icon: <Gauge className="h-5 w-5" aria-hidden />,
                },
                {
                  label: "Deadline",
                  value: formatDateEuropean(selected.deadline),
                  accent: "amber" as const,
                  icon: <CalendarClock className="h-5 w-5" aria-hidden />,
                },
                {
                  label: "Scheduled",
                  value: formatDateEuropean(selected.scheduled_date),
                  accent: "pink" as const,
                  icon: <Timer className="h-5 w-5" aria-hidden />,
                },
              ]
            : []
        }
        description={selected?.description || undefined}
        children={
          selected && statusKey(selected.status) === "rejected" ? (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2">
              <p className="text-xs font-semibold text-rose-300">Rejected</p>
              {(selected.rejection_reason ?? "").trim() ? (
                <p className="mt-1 text-xs text-white/55">{selected.rejection_reason}</p>
              ) : null}
            </div>
          ) : selected && statusKey(selected.status) === "pending_approval" ? (
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2">
              <p className="text-xs font-semibold text-sky-300">Waiting for admin approval</p>
            </div>
          ) : null
        }
        uploadInfo={
          selected?.file_url ? (
            <a href={selected.file_url} target="_blank" rel="noreferrer" className="text-sky-300 underline">
              Open file URL
            </a>
          ) : undefined
        }
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {selected && showReview(selected) ? (
              <button
                type="button"
                onClick={() => {
                  setReviewModal(selected);
                  setSelected(null);
                }}
                className="rounded-xl border border-sky-500/35 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/25"
              >
                Review
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Close
            </button>
          </div>
        }
      />
    </div>
  );
}
