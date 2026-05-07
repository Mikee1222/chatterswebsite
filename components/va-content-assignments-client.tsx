"use client";

import * as React from "react";
import { CalendarClock, Gauge, ListChecks, Search, Timer } from "lucide-react";
import { VaContentAssignmentForm } from "@/components/va-content-assignment-form";
import { BeautifulDetailModal } from "@/components/beautiful-detail-modal";
import { MobileCard } from "@/components/mobile-card";
import { FormInput } from "@/components/ui/form-input";
import { gradientClassForContentType } from "@/lib/detail-modal-gradients";
import { formatDateEuropean } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ModelRecord, VaContentAssignmentRecord } from "@/types";

export type VaAssignmentWithModel = VaContentAssignmentRecord & { model_name: string };

type StatusTab = "pending" | "scheduled" | "completed";

function statusKey(s: string): string {
  return (s || "").trim().toLowerCase();
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
  const visible = rows.filter((r) => statusKey(r.status) !== "cancelled");
  const [filter, setFilter] = React.useState<StatusTab>("pending");
  const [selected, setSelected] = React.useState<VaAssignmentWithModel | null>(null);
  const [search, setSearch] = React.useState("");
  const [modelId, setModelId] = React.useState<string>("all");
  const [prioritySet, setPrioritySet] = React.useState<Set<string>>(() => new Set());

  const modelOptions = React.useMemo(() => {
    return [...models].sort((a, b) => (a.model_name || "").localeCompare(b.model_name || ""));
  }, [models]);

  const counts = React.useMemo(() => {
    return {
      pending: visible.filter((r) => statusKey(r.status) === "pending").length,
      scheduled: visible.filter((r) => statusKey(r.status) === "scheduled").length,
      completed: visible.filter((r) => statusKey(r.status) === "completed").length,
      total: visible.length,
    };
  }, [visible]);

  const filtered = React.useMemo(() => {
    let list = visible.filter((r) => statusKey(r.status) === filter);
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
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">Pending</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{counts.pending}</p>
            <p className="text-xs text-white/50">awaiting model</p>
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
                  ["pending", "Pending", counts.pending],
                  ["scheduled", "Scheduled", counts.scheduled],
                  ["completed", "Completed", counts.completed],
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
              No matching {filter} assignments.
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
                        <td className="max-w-[220px] truncate px-4 py-3 text-white/85" title={r.title}>
                          {r.title || "—"}
                        </td>
                        <td className="px-4 py-3 text-white/65">{r.content_type || "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-white/70">{formatDateEuropean(r.deadline)}</td>
                        <td className="px-4 py-3 capitalize text-white/80">{statusKey(r.status) || "—"}</td>
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
                        <span className="shrink-0 text-[10px] uppercase text-white/40">{statusKey(r.status)}</span>
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
                    </div>
                  </MobileCard>
                ))}
              </div>
            </>
          )}
        </div>

        <VaContentAssignmentForm models={models} />
      </div>

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
                  value: selected.status,
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
