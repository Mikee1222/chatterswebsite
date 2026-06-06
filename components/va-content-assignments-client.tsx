"use client";

import * as React from "react";
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
  type LucideIcon,
} from "lucide-react";
import { VaContentAssignmentForm } from "@/components/va-content-assignment-form";
import { BeautifulDetailModal } from "@/components/beautiful-detail-modal";
import { MobileCard } from "@/components/mobile-card";
import { FormInput } from "@/components/ui/form-input";
import { Label } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GlassModal } from "@/components/ui/glass-modal";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { gradientClassForContentType } from "@/lib/detail-modal-gradients";
import { formatDateEuropean } from "@/lib/format";
import { usePagination } from "@/lib/use-pagination";
import { cn } from "@/lib/utils";
import type { ModelRecord, VaContentAssignmentRecord } from "@/types";

export type VaAssignmentWithModel = VaContentAssignmentRecord & { model_name: string };

type StatusTab = "pending" | "scheduled" | "completed" | "rejected";

function statusKey(s: string): string {
  return (s || "").trim().toLowerCase();
}

function isPendingTabStatus(s: string): boolean {
  const k = statusKey(s);
  return k === "pending" || k === "pending_approval";
}

function statusLabelForList(s: string): string {
  const k = statusKey(s);
  if (k === "pending_approval") return "pending approval";
  return k || "—";
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
      : k === "pending" || k === "pending_approval"
        ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
        : k === "scheduled"
          ? "border-sky-500/30 bg-sky-500/15 text-sky-300"
          : k === "rejected"
            ? "border-rose-500/35 bg-rose-500/15 text-rose-300"
            : "border-white/15 bg-white/[0.06] text-white/70";

  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize", variant)}>
      {label}
    </span>
  );
}

const PRIORITIES = ["urgent", "high", "normal", "low"] as const;

export type VaContentAssignmentsClientProps = {
  models: Pick<ModelRecord, "id" | "model_name">[];
  rows: VaAssignmentWithModel[];
};

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

function AssignmentCard({
  row,
  onSelect,
  onEdit,
  onDelete,
}: {
  row: VaAssignmentWithModel;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const k = statusKey(row.status);
  const canEdit = k === "pending" || k === "pending_approval";

  return (
    <MobileCard
      onClick={onSelect}
      padding="none"
      className="flex overflow-hidden border-white/10 bg-zinc-950/80 ring-white/[0.06] transition hover:bg-white/[0.03]"
    >
      <div
        className={cn("w-1 shrink-0 bg-gradient-to-b", gradientClassForContentType(row.content_type))}
        aria-hidden
      />
      <div className="min-w-0 flex-1 p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-white" title={row.title}>
              {row.title || "—"}
            </p>
            <p className="mt-0.5 text-xs text-white/55">{row.model_name}</p>
          </div>
          <StatusBadge status={row.status} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/70">
            {row.content_type || "Type"}
          </span>
          <span
            className={cn(
              "inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
              priorityClass(row.priority)
            )}
          >
            {row.priority || "normal"}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
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
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-500/35 bg-sky-500/15 py-2 text-xs font-medium text-sky-200 hover:bg-sky-500/25"
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
    </MobileCard>
  );
}

export function VaContentAssignmentsClient({ models, rows }: VaContentAssignmentsClientProps) {
  const router = useRouter();
  const visible = rows.filter((r) => statusKey(r.status) !== "cancelled");
  const [filter, setFilter] = React.useState<StatusTab>("pending");
  const [selected, setSelected] = React.useState<VaAssignmentWithModel | null>(null);
  const [search, setSearch] = React.useState("");
  const [modelId, setModelId] = React.useState<string>("all");
  const [prioritySet, setPrioritySet] = React.useState<Set<string>>(() => new Set());
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
      scheduled: visible.filter((r) => statusKey(r.status) === "scheduled").length,
      completed: visible.filter((r) => statusKey(r.status) === "completed").length,
      rejected: visible.filter((r) => statusKey(r.status) === "rejected").length,
      total: visible.length,
    };
  }, [visible]);

  const filtered = React.useMemo(() => {
    let list =
      filter === "rejected"
        ? visible.filter((r) => statusKey(r.status) === "rejected")
        : filter === "pending"
          ? visible.filter((r) => isPendingTabStatus(r.status))
          : visible.filter((r) => statusKey(r.status) === filter);
    if (modelId !== "all") list = list.filter((r) => r.model_id === modelId);
    if (prioritySet.size > 0) {
      list = list.filter((r) => prioritySet.has((r.priority || "normal").toLowerCase()));
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
  }, [visible, filter, modelId, prioritySet, search]);

  const { page, setPage, totalPages, paginated, reset } = usePagination(filtered, 20);

  React.useEffect(() => {
    reset();
  }, [filter, search, modelId, prioritySet, reset]);

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
  };

  const activeFilterCount =
    (search.trim() ? 1 : 0) + (modelId !== "all" ? 1 : 0) + (prioritySet.size > 0 ? 1 : 0);

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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Virtual assistant</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Content assignments</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60">
            Create work for models and track progress. Rows here are linked to your VA user in Airtable; models schedule
            and complete them from their dashboard.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className={cn(
            "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sky-400/35 px-4 py-2.5 text-sm font-semibold text-sky-50 shadow-[0_0_24px_-8px_hsl(199_89%_48%/0.35)] transition hover:brightness-110",
            "bg-gradient-to-r from-sky-500/25 to-blue-600/20"
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
          New Assignment
        </button>
      </header>

      <div className="-mx-1 overflow-x-auto px-1 pb-1 snap-x snap-mandatory">
        <div className="flex min-w-min gap-3">
          <StatCard
            label="Total"
            value={counts.total}
            icon={ListChecks}
            accentClass="border-white/10 ring-white/[0.06]"
          />
          <StatCard
            label="Pending"
            value={counts.pendingAction}
            icon={Clock}
            accentClass="border-amber-500/25 bg-amber-500/5 ring-amber-500/10"
          />
          <StatCard
            label="Scheduled"
            value={counts.scheduled}
            icon={CalendarClock}
            accentClass="border-sky-500/25 bg-sky-500/5 ring-sky-500/10"
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

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/45">Status</span>
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
                  ? "border-sky-400/55 bg-sky-500/20 text-sky-100"
                  : "border-white/12 bg-white/[0.04] text-white/70 hover:bg-white/[0.08]"
              )}
            >
              {label}
              <span className="ml-1 text-white/45">{n}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <FormInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, model, description, type…"
              className="border-white/10 bg-zinc-950/80 pl-9"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-white/50">Model</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              <option value="all">All models</option>
              {modelOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {(m.model_name || "").trim() || "Model"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-white/50">Priority</label>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITIES.map((p) => {
                const on = prioritySet.has(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePriority(p)}
                    className={cn(
                      "rounded-lg border px-2 py-1 text-xs capitalize transition",
                      on
                        ? "border-sky-400/50 bg-sky-500/15 text-sky-100"
                        : "border-white/12 bg-white/[0.04] text-white/65 hover:bg-white/[0.08]"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeFilterCount > 0 ? (
            <span className="rounded-full border border-sky-500/35 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-100">
              {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
            </span>
          ) : null}
          <button
            type="button"
            onClick={clearFilters}
            disabled={activeFilterCount === 0}
            className="inline-flex items-center gap-1 text-xs font-medium text-sky-300/90 underline-offset-4 hover:text-sky-200 hover:underline disabled:opacity-40"
          >
            <X className="h-3 w-3" aria-hidden />
            Clear filters
          </button>
          <span className="ml-auto text-xs text-white/45">{filtered.length} shown</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/35">
            <ListChecks className="h-7 w-7" aria-hidden />
          </div>
          <p className="mt-4 text-sm font-medium text-white/75">No matching assignments</p>
          <p className="mt-1 text-xs text-white/45">Try a different status tab or clear your filters.</p>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-sky-500/35 bg-sky-500/15 px-4 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/25"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear filters
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-sky-500/35 bg-sky-500/15 px-4 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/25"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              New Assignment
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((r) => (
              <AssignmentCard
                key={r.id}
                row={r}
                onSelect={() => setSelected(r)}
                onEdit={() => setEditFor(r)}
                onDelete={() => setDeleteFor(r)}
              />
            ))}
          </div>

          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            totalItems={filtered.length}
          />
        </>
      )}

      {createOpen ? (
        <GlassModal
          onClose={() => setCreateOpen(false)}
          title="New assignment"
          subtitle="Create work for a model to schedule and complete"
          className="md:max-w-lg"
        >
          <VaContentAssignmentForm
            models={models}
            embedded
            onSuccess={() => setCreateOpen(false)}
          />
        </GlassModal>
      ) : null}

      {editFor ? (
        <GlassModal
          onClose={() => !editSaving && setEditFor(null)}
          title="Edit assignment"
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
                className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/40"
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
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editSaving || !editTitle.trim()}
                className="rounded-xl border border-sky-500/40 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/30 disabled:opacity-45"
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
        title="Delete assignment?"
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
        title={selected?.title || "Assignment details"}
        subtitle={selected ? `${selected.model_name} · ${selected.content_type || "Content"}` : ""}
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
              <p className="text-xs font-semibold text-rose-300">Rejected by admin</p>
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
          <div className="flex justify-end">
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
