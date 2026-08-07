"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { BeautifulDetailModal } from "@/components/beautiful-detail-modal";
import { ContentPipelineHero } from "@/components/content-pipeline-ui";
import {
  ChattingStatusBadge,
  chattingPriorityClass,
  chattingStatusKey,
  chattingStatusLabel,
  dateInOrOverlapsRange,
} from "@/components/chatting-content-ui";
import { FilterBar, FilterChip, ReviewEmptyState } from "@/components/manager-review-ui";
import { CountUp, InflowwCustomDateRange, LuxuryStatCard } from "@/components/infloww-performance-ui";
import { FormInput } from "@/components/ui/form-input";
import { GlassModal } from "@/components/ui/glass-modal";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { VaContentAssignmentForm } from "@/components/va-content-assignment-form";
import { gradientClassForContentType } from "@/lib/detail-modal-gradients";
import { addDaysAthensYmd, getTodayYmdAthens } from "@/lib/airtable-datetime";
import { formatDateEuropean } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import {
  VA_BTN_PRIMARY,
  VA_BTN_SECONDARY,
  VA_CARD,
  VA_CARD_GLOW,
  VA_FILTER_INPUT,
} from "@/lib/va-tasks-tokens";
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
  /** When true, admin can create assignments on behalf of any VA (`content:manage`). */
  canManage?: boolean;
};

type StatusFilterValue =
  | "all"
  | "pending_approval"
  | "pending"
  | "scheduled"
  | "completed"
  | "rejected"
  | "cancelled";

const statusKey = chattingStatusKey;
const statusLabelForList = chattingStatusLabel;
const priorityClass = chattingPriorityClass;

const STATUS_TABS: StatusFilterValue[] = [
  "pending_approval",
  "pending",
  "scheduled",
  "completed",
  "rejected",
];

export function AdminVaContentClient({ rows, vaOptions, modelOptions, canManage = false }: AdminVaContentClientProps) {
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

  const today = getTodayYmdAthens();
  const [searchTitle, setSearchTitle] = React.useState("");
  const [filterModelId, setFilterModelId] = React.useState("");
  const [filterVaId, setFilterVaId] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState<StatusFilterValue>("all");
  const [dateFrom, setDateFrom] = React.useState(() => addDaysAthensYmd(today, -90));
  const [dateTo, setDateTo] = React.useState(today);
  const [dateActive, setDateActive] = React.useState(false);

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
      if (dateActive && !dateInOrOverlapsRange(r.created_at, r.deadline, dateFrom, dateTo)) return false;
      return true;
    });
  }, [rows, searchTitle, filterModelId, filterVaId, filterStatus, dateFrom, dateTo, dateActive]);

  const { page, setPage, totalPages, paginated, reset } = usePagination(filteredRows, 12);

  React.useEffect(() => {
    reset();
  }, [searchTitle, filterModelId, filterVaId, filterStatus, dateFrom, dateTo, dateActive, reset]);

  const filtersActive =
    searchTitle.trim() !== "" ||
    filterModelId !== "" ||
    filterVaId !== "" ||
    filterStatus !== "all" ||
    dateActive;

  const activeFilterCount =
    (searchTitle.trim() ? 1 : 0) +
    (filterModelId ? 1 : 0) +
    (filterVaId ? 1 : 0) +
    (filterStatus !== "all" ? 1 : 0) +
    (dateActive ? 1 : 0);

  const clearFilters = () => {
    setSearchTitle("");
    setFilterModelId("");
    setFilterVaId("");
    setFilterStatus("all");
    setDateActive(false);
    setDateFrom(addDaysAthensYmd(today, -90));
    setDateTo(today);
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

  const reduce = useReducedMotion();

  return (
    <div className="space-y-6">
      <ContentPipelineHero
        eyebrow="Administration"
        title="Chatting Content"
        description="Review VA-submitted briefs, approve work for models, and manage reminders or cancellations."
        orb="both"
        actions={
          canManage ? (
            <button type="button" onClick={() => setCreateOpen(true)} className={cn(VA_BTN_PRIMARY, "px-4 py-2.5 text-sm")}>
              + New Content
            </button>
          ) : null
        }
        stats={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <LuxuryStatCard label="Total" value={<CountUp value={counts.total} />} accent="champagne" tooltip="All chatting content across models" />
            <LuxuryStatCard label="Pending approval" value={<CountUp value={counts.pending_approval} />} accent="pink" glow tooltip="Waiting for your review" />
            <LuxuryStatCard label="Pending" value={<CountUp value={counts.pending} />} accent="amber" tooltip="Approved, awaiting model schedule" />
            <LuxuryStatCard label="Scheduled" value={<CountUp value={counts.scheduled} />} accent="white" tooltip="Model has set a date" />
            <LuxuryStatCard label="Completed" value={<CountUp value={counts.completed} />} accent="emerald" tooltip="Marked complete" />
            <LuxuryStatCard label="Rejected" value={<CountUp value={counts.rejected} />} accent="white" tooltip="Sent back to VA" />
          </div>
        }
      />

      {pendingApprovalItems.length > 0 ? (
        <div className={cn(VA_CARD, VA_CARD_GLOW, "border border-sky-500/25 bg-sky-500/10 p-4 md:p-5")}>
          <div className="mb-3 flex items-center gap-2">
            <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-sky-400 motion-reduce:animate-none" aria-hidden />
            <p className="text-sm font-semibold text-sky-300">
              {pendingApprovalItems.length} item{pendingApprovalItems.length > 1 ? "s" : ""} waiting for review
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

      <FilterBar className={cn(VA_CARD, VA_CARD_GLOW, "space-y-3 p-4")}>
        <div className="flex flex-wrap items-center gap-2">
          {(["all", ...STATUS_TABS] as StatusFilterValue[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterStatus(key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filterStatus === key
                  ? "border-[#FF1493]/55 bg-[#FF1493]/20 text-pink-100"
                  : "border-white/12 bg-white/[0.04] text-[#B8B4B8]/80 hover:bg-white/[0.08]"
              )}
            >
              {tabLabel(key)}
              <span className="ml-1 text-white/45">{tabCount(key)}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#B8B4B8]/35" />
            <input
              type="search"
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
              placeholder="Search by title…"
              className={cn(VA_FILTER_INPUT, "w-full pl-9")}
            />
          </label>
          <select
            value={filterModelId}
            onChange={(e) => setFilterModelId(e.target.value)}
            className={cn(VA_FILTER_INPUT, "w-full lg:w-44")}
            aria-label="Filter by model"
          >
            {modelSelectOptions.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={filterVaId}
            onChange={(e) => setFilterVaId(e.target.value)}
            className={cn(VA_FILTER_INPUT, "w-full lg:w-44")}
            aria-label="Filter by submitter"
          >
            {vaSelectOptions.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <InflowwCustomDateRange
          startYmd={dateFrom}
          endYmd={dateTo}
          onChange={(s, e) => {
            setDateFrom(s);
            setDateTo(e);
          }}
          onApply={(s, e) => {
            setDateFrom(s);
            setDateTo(e);
            setDateActive(true);
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          {searchTitle.trim() ? <FilterChip label={`Search: ${searchTitle.trim()}`} onRemove={() => setSearchTitle("")} /> : null}
          {filterModelId ? (
            <FilterChip
              label={`Model: ${modelSelectOptions.find((o) => o.value === filterModelId)?.label || filterModelId}`}
              onRemove={() => setFilterModelId("")}
            />
          ) : null}
          {filterVaId ? (
            <FilterChip
              label={`Submitter: ${vaSelectOptions.find((o) => o.value === filterVaId)?.label || filterVaId}`}
              onRemove={() => setFilterVaId("")}
            />
          ) : null}
          {dateActive ? <FilterChip label={`${dateFrom} → ${dateTo}`} onRemove={() => setDateActive(false)} /> : null}
          {filtersActive ? (
            <button type="button" onClick={clearFilters} className={cn(VA_BTN_SECONDARY, "px-3 py-1.5 text-xs")}>
              <X className="mr-1 inline h-3 w-3" aria-hidden />
              Clear filters
            </button>
          ) : null}
          <span className="ml-auto text-xs text-[#B8B4B8]/45">
            {filteredRows.length} of {rows.length}
          </span>
        </div>
      </FilterBar>

      {rows.length === 0 ? (
        <ReviewEmptyState
          icon={ClipboardList}
          title="No chatting content yet"
          description="When VAs create briefs for models, they will appear here for agency oversight."
        />
      ) : filteredRows.length === 0 ? (
        <ReviewEmptyState
          icon={Search}
          title="No content matches your filters"
          description="Try clearing filters or widening the date range."
          action={
            <button type="button" onClick={clearFilters} className={cn(VA_BTN_SECONDARY, "px-4 py-2 text-xs")}>
              Clear filters
            </button>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((r, i) => (
              <motion.button
                key={r.id}
                type="button"
                onClick={() => setSelected(r)}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.25, delay: reduce ? 0 : Math.min(i * 0.03, 0.18) }}
                className={cn(VA_CARD, VA_CARD_GLOW, "flex w-full overflow-hidden border border-white/10 bg-[#151315]/90 p-0 text-left")}
              >
                <div
                  className={cn("w-1 shrink-0 bg-gradient-to-b", gradientClassForContentType(r.content_type))}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white" title={r.title || "—"}>
                        {r.title || "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-[#B8B4B8]/70">
                        {r.va_name} → {r.model_name}
                      </p>
                    </div>
                    <ChattingStatusBadge status={r.status} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-[#B8B4B8]/80">
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
                    <span className="inline-flex items-center gap-1 text-[11px] text-[#B8B4B8]/50">
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
              </motion.button>
            ))}
          </div>

          <PaginationControls page={page} totalPages={totalPages} onPage={setPage} totalItems={filteredRows.length} />
        </>
      )}

      {canManage && createOpen ? (
        <GlassModal
          onClose={() => setCreateOpen(false)}
          title="New Chatting Content"
          subtitle="Assign content work directly to a VA and model"
          className="md:max-w-lg"
        >
          <VaContentAssignmentForm
            models={modelOptions}
            vaOptions={vaOptions}
            embedded
            submitLabel="Create & send to model"
            onSuccess={() => setCreateOpen(false)}
          />
        </GlassModal>
      ) : null}

      {reviewModal ? (
        <GlassModal
          onClose={() => !reviewing && setReviewModal(null)}
          title="Review Chatting Content"
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
        title={selected?.title || "Content details"}
        subtitle={selected ? `${selected.va_name} → ${selected.model_name} · ${selected.content_type || "Content"}` : ""}
        badge="Chatting Content"
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
