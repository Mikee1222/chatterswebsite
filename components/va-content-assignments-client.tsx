"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Gauge,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Timer,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { VaContentAssignmentForm } from "@/components/va-content-assignment-form";
import { AiContentQualityPreCheck } from "@/components/ai-content-quality-precheck";
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
import { Label } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GlassModal } from "@/components/ui/glass-modal";
import { PaginationControls } from "@/components/ui/pagination-controls";
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
import type { ModelRecord, VaContentAssignmentRecord } from "@/types";

export type VaAssignmentWithModel = VaContentAssignmentRecord & { model_name: string };

type StatusTab = "pending" | "scheduled" | "completed" | "rejected";

function isPendingTabStatus(s: string): boolean {
  const k = chattingStatusKey(s);
  return k === "pending" || k === "pending_approval";
}

const PRIORITIES = ["urgent", "high", "normal", "low"] as const;
const PAGE_SIZE = 12;

export type VaContentAssignmentsClientProps = {
  models: Pick<ModelRecord, "id" | "model_name">[];
  rows: VaAssignmentWithModel[];
};

function AssignmentCard({
  row,
  onSelect,
  onEdit,
  onDelete,
  index,
}: {
  row: VaAssignmentWithModel;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  index: number;
}) {
  const reduce = useReducedMotion();
  const k = chattingStatusKey(row.status);
  const canEdit = k === "pending" || k === "pending_approval";

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.28, delay: reduce ? 0 : Math.min(index * 0.03, 0.2) }}
      className={cn(
        VA_CARD,
        VA_CARD_GLOW,
        "flex w-full overflow-hidden border border-white/10 bg-[#151315]/90 p-0 text-left",
      )}
    >
      <div
        className={cn("w-1 shrink-0 bg-gradient-to-b", gradientClassForContentType(row.content_type))}
        aria-hidden
      />
      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-white" title={row.title}>
              {row.title || "—"}
            </p>
            <p className="mt-0.5 text-xs text-[#B8B4B8]/70">{row.model_name}</p>
          </div>
          <ChattingStatusBadge status={row.status} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-[#B8B4B8]/80">
            {row.content_type || "Type"}
          </span>
          <span
            className={cn(
              "inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
              chattingPriorityClass(row.priority),
            )}
          >
            {row.priority || "normal"}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-[#B8B4B8]/50">
            <CalendarClock className="h-3 w-3" aria-hidden />
            Due {formatDateEuropean(row.deadline)}
          </span>
        </div>

        {k === "rejected" ? (
          <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2">
            <p className="text-[11px] font-semibold text-rose-300">Rejected by admin</p>
            {(row.rejection_reason ?? "").trim() ? (
              <p className="mt-0.5 text-[11px] text-white/55">{row.rejection_reason}</p>
            ) : null}
          </div>
        ) : null}

        {k === "pending_approval" ? (
          <div className="mt-3 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2">
            <p className="text-[11px] font-semibold text-sky-300">Waiting for admin approval</p>
          </div>
        ) : null}

        {canEdit ? (
          <div className="mt-3 flex gap-2 border-t border-white/10 pt-3" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#D4AF8C]/35 bg-[#D4AF8C]/10 py-2 text-xs font-medium text-[#D4AF8C] hover:bg-[#D4AF8C]/18"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/35 bg-red-500/15 py-2 text-xs font-medium text-red-200 hover:bg-red-500/25"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </motion.button>
  );
}

export function VaContentAssignmentsClient({ models, rows }: VaContentAssignmentsClientProps) {
  const router = useRouter();
  const today = getTodayYmdAthens();
  const visible = rows.filter((r) => chattingStatusKey(r.status) !== "cancelled");
  const [filter, setFilter] = React.useState<StatusTab>("pending");
  const [selected, setSelected] = React.useState<VaAssignmentWithModel | null>(null);
  const [search, setSearch] = React.useState("");
  const [modelId, setModelId] = React.useState<string>("all");
  const [prioritySet, setPrioritySet] = React.useState<Set<string>>(() => new Set());
  const [dateFrom, setDateFrom] = React.useState(() => addDaysAthensYmd(today, -90));
  const [dateTo, setDateTo] = React.useState(today);
  const [dateActive, setDateActive] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  const [editFor, setEditFor] = React.useState<VaAssignmentWithModel | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editDeadline, setEditDeadline] = React.useState("");
  const [editPriority, setEditPriority] = React.useState<string>("normal");
  const [editSaving, setEditSaving] = React.useState(false);
  const [editErr, setEditErr] = React.useState<string | null>(null);

  const [deleteFor, setDeleteFor] = React.useState<VaAssignmentWithModel | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [deleteErr, setDeleteErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (deleteFor) setDeleteErr(null);
  }, [deleteFor]);

  React.useEffect(() => {
    if (!editFor) return;
    setEditTitle(editFor.title || "");
    setEditDescription(editFor.description || "");
    const d = (editFor.deadline || "").trim();
    setEditDeadline(d.length >= 10 ? d.slice(0, 10) : "");
    setEditPriority((editFor.priority || "normal").trim().toLowerCase() || "normal");
    setEditErr(null);
  }, [editFor]);

  const modelOptions = React.useMemo(() => {
    return [...models].sort((a, b) => (a.model_name || "").localeCompare(b.model_name || ""));
  }, [models]);

  const counts = React.useMemo(() => {
    return {
      pendingAction: visible.filter((r) => isPendingTabStatus(r.status)).length,
      scheduled: visible.filter((r) => chattingStatusKey(r.status) === "scheduled").length,
      completed: visible.filter((r) => chattingStatusKey(r.status) === "completed").length,
      rejected: visible.filter((r) => chattingStatusKey(r.status) === "rejected").length,
      total: visible.length,
    };
  }, [visible]);

  const filtered = React.useMemo(() => {
    let list =
      filter === "rejected"
        ? visible.filter((r) => chattingStatusKey(r.status) === "rejected")
        : filter === "pending"
          ? visible.filter((r) => isPendingTabStatus(r.status))
          : visible.filter((r) => chattingStatusKey(r.status) === filter);
    if (modelId !== "all") list = list.filter((r) => r.model_id === modelId);
    if (prioritySet.size > 0) {
      list = list.filter((r) => prioritySet.has((r.priority || "normal").toLowerCase()));
    }
    if (dateActive) {
      list = list.filter((r) => dateInOrOverlapsRange(r.created_at, r.deadline, dateFrom, dateTo));
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const blob = `${r.title ?? ""} ${r.model_name ?? ""} ${r.description ?? ""} ${r.content_type ?? ""}`.toLowerCase();
        return blob.includes(q);
      });
    }
    const createdMs = (r: VaAssignmentWithModel) => Date.parse(r.created_at || "") || 0;
    return [...list].sort((a, b) => createdMs(b) - createdMs(a));
  }, [visible, filter, modelId, prioritySet, search, dateActive, dateFrom, dateTo]);

  const { page, setPage, totalPages, paginated, reset } = usePagination(filtered, PAGE_SIZE);

  React.useEffect(() => {
    reset();
  }, [filter, search, modelId, prioritySet, dateActive, dateFrom, dateTo, reset]);

  const togglePriority = (p: string) => {
    setPrioritySet((prev) => {
      const next = new Set(prev);
      const key = p.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearFilters = () => {
    setSearch("");
    setModelId("all");
    setPrioritySet(new Set());
    setDateActive(false);
    setDateFrom(addDaysAthensYmd(today, -90));
    setDateTo(today);
  };

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (modelId !== "all" ? 1 : 0) +
    (prioritySet.size > 0 ? 1 : 0) +
    (dateActive ? 1 : 0);

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editFor || editSaving) return;
    setEditSaving(true);
    setEditErr(null);
    try {
      const res = await fetch(`/api/va/content-assignments/${editFor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          deadline: editDeadline.trim() ? editDeadline.trim() : null,
          priority: editPriority,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not save changes");
      }
      setEditFor(null);
      router.refresh();
    } catch (err) {
      setEditErr(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDeleteAssignment() {
    if (!deleteFor || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteErr(null);
    try {
      const res = await fetch(`/api/va/content-assignments/${deleteFor.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDeleteErr(typeof data.error === "string" ? data.error : "Could not delete.");
        return;
      }
      const id = deleteFor.id;
      setDeleteFor(null);
      setSelected((s) => (s?.id === id ? null : s));
      router.refresh();
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <ContentPipelineHero
        eyebrow="Content"
        title="Chatting Content"
        description="Create chatting briefs for models and track approval, scheduling, and completion."
        orb="both"
        actions={
          <button type="button" onClick={() => setCreateOpen(true)} className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-2 px-4 py-2.5 text-sm")}>
            <Plus className="h-4 w-4" aria-hidden />
            New Content
          </button>
        }
        stats={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <LuxuryStatCard label="Total" value={<CountUp value={counts.total} />} accent="champagne" tooltip="All of your chatting content items" />
            <LuxuryStatCard label="Pending" value={<CountUp value={counts.pendingAction} />} accent="amber" glow tooltip="Awaiting approval or model action" />
            <LuxuryStatCard label="Scheduled" value={<CountUp value={counts.scheduled} />} accent="pink" tooltip="Model has scheduled a date" />
            <LuxuryStatCard label="Completed" value={<CountUp value={counts.completed} />} accent="emerald" tooltip="Marked complete by the model" />
            <LuxuryStatCard
              label="Rejected"
              value={<CountUp value={counts.rejected} />}
              accent="white"
              hint={counts.rejected > 0 ? "Needs revision" : undefined}
              tooltip="Rejected by admin — edit and resubmit"
            />
          </div>
        }
      />

      <FilterBar className={cn(VA_CARD, VA_CARD_GLOW, "space-y-3 p-4")}>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["pending", "Pending", counts.pendingAction],
              ["scheduled", "Scheduled", counts.scheduled],
              ["completed", "Completed", counts.completed],
              ["rejected", "Rejected", counts.rejected],
            ] as const
          ).map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === key
                  ? "border-[#FF1493]/55 bg-[#FF1493]/20 text-pink-100"
                  : "border-white/12 bg-white/[0.04] text-[#B8B4B8]/80 hover:bg-white/[0.08]",
              )}
            >
              {label}
              <span className="ml-1 text-white/45">{n}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#B8B4B8]/35" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, model, description…"
              className={cn(VA_FILTER_INPUT, "w-full pl-9")}
            />
          </label>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className={cn(VA_FILTER_INPUT, "w-full lg:w-48")}
            aria-label="Filter by model"
          >
            <option value="all">All models</option>
            {modelOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {(m.model_name || "").trim() || "Model"}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PRIORITIES.map((p) => {
            const on = prioritySet.has(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePriority(p)}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs capitalize transition",
                  on
                    ? "border-[#D4AF8C]/50 bg-[#D4AF8C]/15 text-[#D4AF8C]"
                    : "border-white/12 bg-white/[0.04] text-[#B8B4B8]/65 hover:bg-white/[0.08]",
                )}
              >
                {p}
              </button>
            );
          })}
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
          {search.trim() ? <FilterChip label={`Search: ${search.trim()}`} onRemove={() => setSearch("")} /> : null}
          {modelId !== "all" ? (
            <FilterChip
              label={`Model: ${modelOptions.find((m) => m.id === modelId)?.model_name || modelId}`}
              onRemove={() => setModelId("all")}
            />
          ) : null}
          {dateActive ? (
            <FilterChip label={`${dateFrom} → ${dateTo}`} onRemove={() => setDateActive(false)} />
          ) : null}
          {activeFilterCount > 0 ? (
            <button type="button" onClick={clearFilters} className={cn(VA_BTN_SECONDARY, "px-3 py-1.5 text-xs")}>
              <X className="mr-1 inline h-3 w-3" aria-hidden />
              Clear filters
            </button>
          ) : null}
          <span className="ml-auto text-xs text-[#B8B4B8]/45">{filtered.length} shown</span>
        </div>
      </FilterBar>

      {filtered.length === 0 ? (
        <ReviewEmptyState
          icon={ListChecks}
          title="No matching chatting content"
          description={
            visible.length === 0
              ? "Create your first brief for a model to schedule and complete."
              : "Try a different status tab or clear your filters."
          }
          action={
            activeFilterCount > 0 ? (
              <button type="button" onClick={clearFilters} className={cn(VA_BTN_SECONDARY, "px-4 py-2 text-xs")}>
                Clear filters
              </button>
            ) : (
              <button type="button" onClick={() => setCreateOpen(true)} className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-1.5 px-4 py-2 text-xs")}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                New Content
              </button>
            )
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((r, i) => (
              <AssignmentCard
                key={r.id}
                row={r}
                index={i}
                onSelect={() => setSelected(r)}
                onEdit={() => setEditFor(r)}
                onDelete={() => setDeleteFor(r)}
              />
            ))}
          </div>
          <PaginationControls page={page} totalPages={totalPages} onPage={setPage} totalItems={filtered.length} />
        </>
      )}

      {createOpen ? (
        <GlassModal
          onClose={() => setCreateOpen(false)}
          title="New Chatting Content"
          subtitle="Create work for a model to schedule and complete"
          className="md:max-w-lg"
        >
          <VaContentAssignmentForm models={models} embedded onSuccess={() => setCreateOpen(false)} />
        </GlassModal>
      ) : null}

      {editFor ? (
        <GlassModal
          onClose={() => !editSaving && setEditFor(null)}
          title="Edit Chatting Content"
          subtitle={editFor.model_name}
          className="md:max-w-lg"
        >
          <form onSubmit={(e) => void submitEdit(e)} className="space-y-4 p-5">
            {editErr ? (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{editErr}</p>
            ) : null}
            <div>
              <Label htmlFor="va-edit-title">Title</Label>
              <FormInput
                id="va-edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
                className="mt-1 border-white/10 bg-zinc-950/80"
              />
            </div>
            <div>
              <Label htmlFor="va-edit-desc">Description</Label>
              <textarea
                id="va-edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none focus:border-[#FF1493]/40"
              />
            </div>
            <div>
              <Label htmlFor="va-edit-deadline">Due date</Label>
              <FormInput
                id="va-edit-deadline"
                type="date"
                value={editDeadline}
                onChange={(e) => setEditDeadline(e.target.value)}
                className="mt-1 border-white/10 bg-zinc-950/80"
              />
            </div>
            <div>
              <Label htmlFor="va-edit-priority">Priority</Label>
              <select
                id="va-edit-priority"
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p} className="capitalize">
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setEditFor(null)}
                className={cn(VA_BTN_SECONDARY, "px-4 py-2 text-sm disabled:opacity-50")}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving || !editTitle.trim()}
                className={cn(VA_BTN_PRIMARY, "px-4 py-2 text-sm disabled:opacity-45")}
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </GlassModal>
      ) : null}

      <ConfirmDialog
        open={deleteFor != null}
        onClose={() => {
          if (!deleteBusy) {
            setDeleteFor(null);
            setDeleteErr(null);
          }
        }}
        onConfirm={() => confirmDeleteAssignment()}
        title="Delete chatting content?"
        description={
          deleteFor
            ? `${deleteErr ? `${deleteErr}\n\n` : ""}Remove “${(deleteFor.title || "Untitled").slice(0, 80)}” for ${deleteFor.model_name}? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={deleteBusy}
      />

      <BeautifulDetailModal
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.title || "Content details"}
        subtitle={selected ? `${selected.model_name} · ${selected.content_type || "Content"}` : ""}
        badge="Chatting Content"
        headerGradientClass={selected ? gradientClassForContentType(selected.content_type) : undefined}
        stats={
          selected
            ? [
                {
                  label: "Status",
                  value: chattingStatusLabel(selected.status),
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
          selected && chattingStatusKey(selected.status) === "rejected" ? (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2">
              <p className="text-xs font-semibold text-rose-300">Rejected by admin</p>
              {(selected.rejection_reason ?? "").trim() ? (
                <p className="mt-1 text-xs text-white/55">{selected.rejection_reason}</p>
              ) : null}
            </div>
          ) : selected && chattingStatusKey(selected.status) === "pending_approval" ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2">
                <p className="text-xs font-semibold text-sky-300">Waiting for admin approval</p>
              </div>
              <AiContentQualityPreCheck fileUrl={selected.file_url} assignmentId={selected.id} />
            </div>
          ) : null
        }
        uploadInfo={
          selected?.file_url ? (
            <a href={selected.file_url} target="_blank" rel="noreferrer" className="text-[#FF1493] underline">
              Open file URL
            </a>
          ) : undefined
        }
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className={cn(VA_BTN_SECONDARY, "px-4 py-2 text-sm")}
            >
              Close
            </button>
          </div>
        }
      />
    </div>
  );
}
