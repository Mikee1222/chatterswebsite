"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Gauge, ListChecks, Search, Timer } from "lucide-react";
import { VaContentAssignmentForm } from "@/components/va-content-assignment-form";
import { BeautifulDetailModal } from "@/components/beautiful-detail-modal";
import { MobileCard } from "@/components/mobile-card";
import { FormInput } from "@/components/ui/form-input";
import { Label } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GlassModal } from "@/components/ui/glass-modal";
import { gradientClassForContentType } from "@/lib/detail-modal-gradients";
import { formatDateEuropean } from "@/lib/format";
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

const PRIORITIES = ["urgent", "high", "normal", "low"] as const;

export type VaContentAssignmentsClientProps = {
  models: Pick<ModelRecord, "id" | "model_name">[];
  rows: VaAssignmentWithModel[];
};

export function VaContentAssignmentsClient({ models, rows }: VaContentAssignmentsClientProps) {
  const router = useRouter();
  const visible = rows.filter((r) => statusKey(r.status) !== "cancelled");
  const [filter, setFilter] = React.useState<StatusTab>("pending");
  const [selected, setSelected] = React.useState<VaAssignmentWithModel | null>(null);
  const [search, setSearch] = React.useState("");
  const [modelId, setModelId] = React.useState<string>("all");
  const [prioritySet, setPrioritySet] = React.useState<Set<string>>(() => new Set());

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
    <div className="space-y-8">
      <section className="rounded-3xl border border-sky-400/25 bg-gradient-to-br from-zinc-950 via-zinc-950 to-sky-950/25 p-6 shadow-[0_10px_40px_rgba(56,189,248,0.1)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Virtual assistant</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Content assignments</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/60">
          Create work for models and track progress. Rows here are linked to your VA user in Airtable; models schedule and
          complete them from their dashboard.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MobileCard padding="md" className="border-sky-500/20 bg-white/[0.04] ring-sky-500/10">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">Active total</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{counts.total}</p>
            <p className="text-xs text-white/50">excl. cancelled</p>
          </MobileCard>
          <MobileCard padding="md" className="border-amber-500/25 bg-amber-500/5 ring-amber-500/10">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">Awaiting action</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{counts.pendingAction}</p>
            <p className="text-xs text-white/50">admin approval or model</p>
          </MobileCard>
          <MobileCard padding="md" className="border-sky-500/25 bg-sky-500/5 ring-sky-500/10">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">Scheduled</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{counts.scheduled}</p>
            <p className="text-xs text-white/50">on calendar</p>
          </MobileCard>
          <MobileCard padding="md" className="border-emerald-500/25 bg-emerald-500/5 ring-emerald-500/10">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">Completed</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{counts.completed}</p>
            <p className="text-xs text-white/50">delivered</p>
          </MobileCard>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <div className="space-y-4">
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
                          on ? "border-sky-400/50 bg-sky-500/15 text-sky-100" : "border-white/12 bg-white/[0.04] text-white/65 hover:bg-white/[0.08]"
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
                className="text-xs font-medium text-sky-300/90 underline-offset-4 hover:text-sky-200 hover:underline disabled:opacity-40"
              >
                Clear filters
              </button>
              <span className="ml-auto text-xs text-white/45">
                {filtered.length} shown
              </span>
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-8 text-center text-sm text-white/55">
              No matching assignments for this filter.
            </p>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-white/10 md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-white/[0.04] text-white/65">
                    <tr>
                      <th className="w-1 p-0" aria-hidden />
                      <th className="px-4 py-3 font-medium">Model</th>
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Deadline</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Priority</th>
                      <th className="px-4 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr
                        key={r.id}
                        className="cursor-pointer border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]"
                        onClick={() => setSelected(r)}
                      >
                        <td className="p-0 align-stretch">
                          <div className={cn("h-full min-h-[48px] w-1 bg-gradient-to-b", gradientClassForContentType(r.content_type))} />
                        </td>
                        <td className="px-4 py-3 text-white/90">{r.model_name}</td>
                        <td className="max-w-[260px] px-4 py-3 text-white/85">
                          <div className="truncate font-medium" title={r.title}>
                            {r.title || "—"}
                          </div>
                          {statusKey(r.status) === "rejected" ? (
                            <div className="mt-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2">
                              <p className="text-[11px] font-semibold text-rose-300">Rejected by admin</p>
                              {(r.rejection_reason ?? "").trim() ? (
                                <p className="mt-0.5 text-[11px] text-white/55">{r.rejection_reason}</p>
                              ) : null}
                            </div>
                          ) : null}
                          {statusKey(r.status) === "pending_approval" ? (
                            <div className="mt-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2">
                              <p className="text-[11px] font-semibold text-sky-300">Waiting for admin approval</p>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-white/65">{r.content_type || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-white/70">{formatDateEuropean(r.deadline)}</td>
                        <td className="px-4 py-3 capitalize text-white/80">{statusLabelForList(r.status)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
                              priorityClass(r.priority)
                            )}
                          >
                            {r.priority || "normal"}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {statusKey(r.status) === "pending" || statusKey(r.status) === "pending_approval" ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditFor(r)}
                                className="rounded-lg border border-sky-500/35 bg-sky-500/15 px-3 py-1 text-xs font-medium text-sky-200 hover:bg-sky-500/25"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteFor(r)}
                                className="rounded-lg border border-red-500/35 bg-red-500/15 px-3 py-1 text-xs font-medium text-red-200 hover:bg-red-500/25"
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {filtered.map((r) => (
                  <MobileCard
                    key={r.id}
                    onClick={() => setSelected(r)}
                    padding="none"
                    className="flex overflow-hidden border-white/10 bg-zinc-950/80 ring-white/[0.06]"
                  >
                    <div
                      className={cn("w-1 shrink-0 bg-gradient-to-b", gradientClassForContentType(r.content_type))}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 space-y-1 p-4 text-left">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-medium text-white">{r.title || "—"}</p>
                        <span className="shrink-0 text-[10px] uppercase text-white/40">
                          {statusLabelForList(r.status)}
                        </span>
                      </div>
                      <p className="text-xs text-white/55">{r.model_name}</p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
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
                        <span className="text-[11px] text-white/45">Due {formatDateEuropean(r.deadline)}</span>
                      </div>
                      {statusKey(r.status) === "rejected" ? (
                        <div className="mt-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2">
                          <p className="text-[11px] font-semibold text-rose-300">Rejected by admin</p>
                          {(r.rejection_reason ?? "").trim() ? (
                            <p className="mt-0.5 text-[11px] text-white/55">{r.rejection_reason}</p>
                          ) : null}
                        </div>
                      ) : null}
                      {statusKey(r.status) === "pending_approval" ? (
                        <div className="mt-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2">
                          <p className="text-[11px] font-semibold text-sky-300">Waiting for admin approval</p>
                        </div>
                      ) : null}
                      {statusKey(r.status) === "pending" || statusKey(r.status) === "pending_approval" ? (
                        <div
                          className="flex gap-2 border-t border-white/10 p-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setEditFor(r)}
                            className="flex-1 rounded-lg border border-sky-500/35 bg-sky-500/15 py-2 text-xs font-medium text-sky-200"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteFor(r)}
                            className="flex-1 rounded-lg border border-red-500/35 bg-red-500/15 py-2 text-xs font-medium text-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </MobileCard>
                ))}
              </div>
            </>
          )}
        </div>

        <VaContentAssignmentForm models={models} />
      </div>

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
