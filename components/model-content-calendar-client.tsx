"use client";

/**
 * Model content calendar — month grid (no `react-big-calendar` dependency).
 * Date placement:
 * - VA assignments: `scheduled_date` if set, else `deadline` (ISO / date → YYYY-MM-DD).
 * - Customs (admin accepted): `model_scheduled_date`, else `deadline_requested`.
 * - Tasks: `created_at` (no native due date on model_tasks).
 */

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarClock,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  ListChecks,
  Sparkles,
  Timer,
  User,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { BeautifulDetailModal } from "@/components/beautiful-detail-modal";
import {
  gradientClassForCalendarKind,
  gradientClassForContentType,
  gradientClassForCustomRequest,
} from "@/lib/detail-modal-gradients";
import type { CustomRequest, ModelTaskRecord, VaContentAssignmentRecord } from "@/types";

export type ContentCalendarEvent = {
  id: string;
  kind: "va" | "custom" | "task";
  title: string;
  dateYmd: string;
  status: string;
  sublabel: string;
  va?: VaContentAssignmentRecord;
  custom?: CustomRequest;
  task?: ModelTaskRecord;
};

function toYmd(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === "") return null;
  const t = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildEvents(
  assignments: VaContentAssignmentRecord[],
  customs: CustomRequest[],
  tasks: ModelTaskRecord[]
): ContentCalendarEvent[] {
  const out: ContentCalendarEvent[] = [];
  for (const a of assignments) {
    const dateYmd = toYmd(a.scheduled_date) ?? toYmd(a.deadline) ?? toYmd(a.updated_at);
    if (!dateYmd) continue;
    out.push({
      id: `va-${a.id}`,
      kind: "va",
      title: a.title || "VA assignment",
      dateYmd,
      status: a.status || "—",
      sublabel: a.content_type || "Content",
      va: a,
    });
  }
  for (const c of customs) {
    const dateYmd = toYmd(c.model_scheduled_date) ?? toYmd(c.deadline_requested) ?? toYmd(c.updated_at);
    if (!dateYmd) continue;
    out.push({
      id: `custom-${c.id}`,
      kind: "custom",
      title: c.request_title || "Custom",
      dateYmd,
      status: c.model_status,
      sublabel: c.fan_username || "Custom",
      custom: c,
    });
  }
  for (const t of tasks) {
    const dateYmd = toYmd(t.created_at);
    if (!dateYmd) continue;
    out.push({
      id: `task-${t.id}`,
      kind: "task",
      title: t.title || "Task",
      dateYmd,
      status: t.status,
      sublabel: t.type || "Task",
      task: t,
    });
  }
  return out;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function monthMatrix(year: number, monthIndex0: number): { ymd: string | null; inMonth: boolean }[][] {
  const first = new Date(year, monthIndex0, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const cells: { ymd: string | null; inMonth: boolean }[] = [];
  for (let i = 0; i < startPad; i++) {
    cells.push({ ymd: null, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const m = String(monthIndex0 + 1).padStart(2, "0");
    const day = String(d).padStart(2, "0");
    cells.push({ ymd: `${year}-${m}-${day}`, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ ymd: null, inMonth: false });
  }
  const rows: { ymd: string | null; inMonth: boolean }[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

const kindStyles: Record<ContentCalendarEvent["kind"], string> = {
  va: "border-violet-400/35 bg-violet-500/15 text-violet-100",
  custom: "border-amber-400/35 bg-amber-500/12 text-amber-100",
  task: "border-emerald-400/35 bg-emerald-500/12 text-emerald-100",
};

function detailHeaderGradient(ev: ContentCalendarEvent | null): string | undefined {
  if (!ev) return undefined;
  if (ev.kind === "custom" && ev.custom) return gradientClassForCustomRequest(ev.custom);
  if (ev.kind === "va" && ev.va) return gradientClassForContentType(ev.va.content_type);
  if (ev.kind === "task") return gradientClassForCalendarKind(ev.task?.type ?? "task");
  return undefined;
}

export type ModelContentCalendarClientProps = {
  assignments: VaContentAssignmentRecord[];
  customs: CustomRequest[];
  tasks: ModelTaskRecord[];
  modelName?: string;
};

export function ModelContentCalendarClient({
  assignments,
  customs,
  tasks,
  modelName,
}: ModelContentCalendarClientProps) {
  const reduceMotion = useReducedMotion();
  const [cursor, setCursor] = React.useState(() => new Date());
  const [typeFilter, setTypeFilter] = React.useState<"all" | "va" | "custom" | "task">("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [selected, setSelected] = React.useState<ContentCalendarEvent | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const allEvents = React.useMemo(
    () => buildEvents(assignments, customs, tasks),
    [assignments, customs, tasks]
  );

  const statusOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const e of allEvents) s.add(e.status);
    return ["all", ...[...s].sort()];
  }, [allEvents]);

  const events = React.useMemo(() => {
    return allEvents.filter((e) => {
      if (typeFilter !== "all" && e.kind !== typeFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      return true;
    });
  }, [allEvents, typeFilter, statusFilter]);

  const year = cursor.getFullYear();
  const monthIndex0 = cursor.getMonth();
  const matrix = React.useMemo(() => monthMatrix(year, monthIndex0), [year, monthIndex0]);

  const byDay = React.useMemo(() => {
    const m = new Map<string, ContentCalendarEvent[]>();
    for (const e of events) {
      const list = m.get(e.dateYmd) ?? [];
      list.push(e);
      m.set(e.dateYmd, list);
    }
    return m;
  }, [events]);

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  React.useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <div className="space-y-6 pb-8 md:space-y-8">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Content calendar</h1>
          {modelName ? (
            <p className="mt-1 text-sm text-white/50">
              {modelName} · VA assignments, approved customs, and tasks
            </p>
          ) : (
            <p className="mt-1 text-sm text-white/50">VA assignments, approved customs, and tasks</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "va", "custom", "task"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTypeFilter(k)}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                typeFilter === k
                  ? "bg-pink-500/25 text-pink-100 ring-1 ring-pink-400/40"
                  : "bg-white/[0.06] text-white/55 hover:bg-white/10 hover:text-white/85"
              )}
            >
              {k === "all" ? "All types" : k === "va" ? "VA" : k === "custom" ? "Customs" : "Tasks"}
            </button>
          ))}
          <label className="flex items-center gap-2 text-xs text-white/50">
            <span className="sr-only">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-medium text-white focus:border-pink-400/40 focus:outline-none"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All statuses" : s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </motion.div>

      {notice ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-center text-sm text-white/80">
          {notice}
        </p>
      ) : null}

      {events.length === 0 ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-dashed border-white/15 bg-black/30 px-6 py-16 text-center"
        >
          <p className="text-lg font-medium text-white/80">Nothing on the calendar</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
            {typeFilter !== "all" || statusFilter !== "all"
              ? "Try clearing filters, or check back when assignments and customs are scheduled."
              : "When VA assignments, accepted customs, or tasks have dates, they will appear here."}
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Previous month"
              onClick={() => setCursor(new Date(year, monthIndex0 - 1, 1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold capitalize tracking-wide text-white">{monthLabel}</span>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Next month"
              onClick={() => setCursor(new Date(year, monthIndex0 + 1, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-white/10 text-center text-[11px] font-semibold uppercase tracking-wider text-white/40">
            {WEEKDAYS.map((d) => (
              <div key={d} className="border-r border-white/5 py-2 last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          <div className="divide-y divide-white/10">
            {matrix.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7 divide-x divide-white/10">
                {row.map((cell, ci) => {
                  const dayEvents = cell.ymd ? byDay.get(cell.ymd) ?? [] : [];
                  return (
                    <div
                      key={ci}
                      className={cn(
                        "min-h-[100px] p-1.5 sm:min-h-[120px] sm:p-2",
                        !cell.inMonth && "bg-black/25",
                        cell.inMonth && "bg-transparent"
                      )}
                    >
                      {cell.ymd ? (
                        <>
                          <div
                            className={cn(
                              "mb-1 text-right text-xs font-medium tabular-nums",
                              cell.inMonth ? "text-white/70" : "text-white/25"
                            )}
                          >
                            {Number(cell.ymd.slice(8, 10))}
                          </div>
                          <ul className="space-y-1">
                            {dayEvents.slice(0, 3).map((ev) => (
                              <li key={ev.id}>
                                <button
                                  type="button"
                                  onClick={() => setSelected(ev)}
                                  className={cn(
                                    "w-full truncate rounded-lg border px-1.5 py-1 text-left text-[10px] font-medium leading-tight transition hover:brightness-110 sm:text-[11px]",
                                    kindStyles[ev.kind]
                                  )}
                                >
                                  {ev.title}
                                </button>
                              </li>
                            ))}
                            {dayEvents.length > 3 ? (
                              <li className="text-center text-[10px] text-white/40">+{dayEvents.length - 3} more</li>
                            ) : null}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <BeautifulDetailModal
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.title ?? "Details"}
        subtitle={selected ? `${selected.kind.toUpperCase()} · ${selected.dateYmd}` : ""}
        badge={selected?.kind === "custom" ? "Custom request" : selected?.kind === "va" ? "VA assignment" : "Task"}
        headerGradientClass={detailHeaderGradient(selected)}
        stats={
          selected?.kind === "va" && selected.va
            ? [
                {
                  label: "Status",
                  value: selected.va.status,
                  accent: "blue" as const,
                  icon: <ListChecks className="h-5 w-5" aria-hidden />,
                },
                {
                  label: "Priority",
                  value: selected.va.priority || "—",
                  accent: "purple" as const,
                  icon: <Gauge className="h-5 w-5" aria-hidden />,
                },
                {
                  label: "Deadline",
                  value: selected.va.deadline || "—",
                  accent: "amber" as const,
                  icon: <CalendarClock className="h-5 w-5" aria-hidden />,
                },
                {
                  label: "Scheduled",
                  value: selected.va.scheduled_date || "—",
                  accent: "pink" as const,
                  icon: <Timer className="h-5 w-5" aria-hidden />,
                },
              ]
            : selected?.kind === "custom" && selected.custom
              ? [
                  {
                    label: "Fan",
                    value: selected.custom.fan_username || "—",
                    accent: "pink" as const,
                    icon: <User className="h-5 w-5" aria-hidden />,
                  },
                  {
                    label: "Status",
                    value: selected.custom.model_status,
                    accent: "purple" as const,
                    icon: <Sparkles className="h-5 w-5" aria-hidden />,
                  },
                  {
                    label: "Scheduled date",
                    value: selected.custom.model_scheduled_date || "—",
                    accent: "amber" as const,
                    icon: <CalendarClock className="h-5 w-5" aria-hidden />,
                  },
                  {
                    label: "Price",
                    value: selected.custom.price || "—",
                    accent: "blue" as const,
                    icon: <CircleDollarSign className="h-5 w-5" aria-hidden />,
                  },
                ]
              : selected?.kind === "task" && selected.task
                ? [
                    {
                      label: "Status",
                      value: selected.task.status,
                      accent: "emerald" as const,
                      icon: <ListChecks className="h-5 w-5" aria-hidden />,
                    },
                    {
                      label: "Task type",
                      value: selected.task.type || "—",
                      accent: "slate" as const,
                      icon: <CheckSquare className="h-5 w-5" aria-hidden />,
                    },
                    {
                      label: "Date",
                      value: selected.dateYmd,
                      accent: "amber" as const,
                      icon: <CalendarClock className="h-5 w-5" aria-hidden />,
                    },
                  ]
                : []
        }
        description={
          selected?.kind === "va"
            ? selected.va?.description || undefined
            : selected?.kind === "custom"
              ? selected.custom?.request_details || undefined
              : selected?.task?.description || undefined
        }
        footer={
          <div className="flex flex-wrap gap-2">
            {selected?.kind === "custom" ? (
              <>
                <Link
                  href={ROUTES.model.customs}
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:border-pink-400/35 hover:bg-pink-500/10"
                >
                  View details
                </Link>
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-pink-400/30 bg-pink-500/15 px-4 py-2.5 text-sm font-medium text-pink-100 transition hover:bg-pink-500/25"
                  onClick={() => {
                    setSelected(null);
                    setNotice("Scheduling from the calendar is coming soon — use Customs to set dates.");
                  }}
                >
                  Mark as scheduled
                </button>
              </>
            ) : null}
            {selected?.kind === "va" ? (
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:border-pink-400/35 hover:bg-pink-500/10"
                onClick={() => {
                  setSelected(null);
                  setNotice("VA assignment updates from the calendar are coming soon.");
                }}
              >
                View details
              </button>
            ) : null}
            {selected?.kind === "task" ? (
              <Link
                href={ROUTES.model.tasks}
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:border-pink-400/35 hover:bg-pink-500/10"
              >
                View tasks
              </Link>
            ) : null}
          </div>
        }
      >
        {selected?.kind === "va" && selected.va?.file_url ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Upload info</p>
            <a href={selected.va.file_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-pink-300 underline">
              Open file URL
            </a>
          </section>
        ) : null}
      </BeautifulDetailModal>
    </div>
  );
}
