"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, ListChecks, StickyNote, X } from "lucide-react";
import { formatDateEuropean, formatDateTimeAthens } from "@/lib/format";
import { updateVaTaskStatusAction } from "@/app/actions/va-tasks";
import { selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import type { VaTaskRecord, VaTaskPriority, VaTaskStatus } from "@/types";
import { cn } from "@/lib/utils";

type Props = { tasks: VaTaskRecord[] };

function toLocalYmd(isoLike: string | null): string {
  if (!isoLike?.trim()) return "";
  const d = new Date(isoLike.trim());
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isPastDue(isoLike: string | null | undefined): boolean {
  if (!isoLike?.trim()) return false;
  const t = new Date(isoLike.trim()).getTime();
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
}

function PriorityBadge({ priority }: { priority: VaTaskPriority }) {
  const k = (priority || "normal").toLowerCase();
  const variant =
    k === "urgent"
      ? "border border-red-500/30 bg-red-500/20 text-red-300"
      : k === "high"
        ? "border border-amber-500/30 bg-amber-500/20 text-amber-300"
        : "border border-white/15 bg-white/10 text-white/65";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", variant)}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: VaTaskStatus }) {
  const k = (status || "").toLowerCase();
  const variant =
    k === "pending"
      ? "border border-amber-500/30 bg-amber-500/20 text-amber-300"
      : k === "done"
        ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
        : k === "skipped"
          ? "border border-red-500/30 bg-red-500/20 text-red-300"
          : "border border-sky-500/30 bg-sky-500/15 text-sky-200";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", variant)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const fieldMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
} as const;

export function VaTasksClient({ tasks: initialTasks }: Props) {
  const router = useRouter();
  const tasks = initialTasks;
  const [selected, setSelected] = React.useState<VaTaskRecord | null>(null);
  const [notes, setNotes] = React.useState("");
  const [statusPick, setStatusPick] = React.useState<VaTaskStatus>("done");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [completing, setCompleting] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [filterPriority, setFilterPriority] = React.useState("");

  const filteredTasks = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...tasks];
    if (q) {
      list = list.filter((t) => {
        const blob = `${t.title} ${t.description}`.toLowerCase();
        return blob.includes(q);
      });
    }
    if (filterStatus) list = list.filter((t) => t.status === filterStatus);
    if (filterPriority) list = list.filter((t) => t.priority === filterPriority);
    const dueMs = (t: VaTaskRecord) => (t.due_date ? new Date(t.due_date).getTime() : 0);
    const createdMs = (t: VaTaskRecord) => (t.created_at ? new Date(t.created_at).getTime() : 0);
    return list.sort((a, b) => {
      const da = dueMs(a);
      const db = dueMs(b);
      if (da && db && da !== db) return da - db;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return createdMs(b) - createdMs(a);
    });
  }, [tasks, search, filterStatus, filterPriority]);

  const openTask = (t: VaTaskRecord) => {
    setSelected(t);
    setNotes(t.completed_notes ?? "");
    setStatusPick(t.status === "in_progress" ? "in_progress" : "done");
    setErr(null);
  };

  const submit = async () => {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    const res = await updateVaTaskStatusAction({
      taskId: selected.id,
      status: statusPick,
      completed_notes: notes,
    });
    setBusy(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    setSelected(null);
    router.refresh();
  };

  async function handleMarkComplete(task: VaTaskRecord, e?: React.MouseEvent) {
    e?.stopPropagation();
    setCompleting(task.id);
    try {
      const res = await updateVaTaskStatusAction({
        taskId: task.id,
        status: "done",
        completed_notes: "",
      });
      if (!res.success) {
        setErr(res.error);
        return;
      }
      if (selected?.id === task.id) setSelected(null);
      router.refresh();
    } finally {
      setCompleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-purple-400/60">My work</p>
        <h1 className="mt-1 text-3xl font-bold text-white">VA tasks</h1>
        <p className="mt-1 text-sm text-white/40">Your assigned tasks and to-dos</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[10rem] flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-purple-500/50"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-11 min-w-[9rem] rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-purple-500/50"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
          <option value="skipped">Skipped</option>
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="h-11 min-w-[9rem] rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-purple-500/50"
        >
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </div>

      {err && !selected ? (
        <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
          {err}
        </div>
      ) : null}

      {filteredTasks.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-10 text-center text-sm text-white/50">
          No tasks match your filters.
        </p>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              role="button"
              tabIndex={0}
              onClick={() => openTask(task)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openTask(task);
                }
              }}
              className={cn(
                "relative cursor-pointer rounded-2xl border p-5 transition-all",
                task.status === "done"
                  ? "border-emerald-500/15 opacity-60"
                  : task.priority === "urgent"
                    ? "border-red-500/25 bg-red-500/[0.02]"
                    : task.priority === "high"
                      ? "border-amber-500/20"
                      : "border-white/8 hover:border-white/15"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                    {task.is_recurring ? (
                      <span className="inline-flex items-center rounded-full border border-purple-500/25 bg-purple-500/15 px-2 py-0.5 text-xs text-purple-400">
                        🔄{" "}
                        {task.recurrence_interval != null && task.recurrence_interval > 1
                          ? `Every ${task.recurrence_interval} ${
                              task.recurrence_type === "daily"
                                ? "days"
                                : task.recurrence_type === "weekly"
                                  ? "weeks"
                                  : task.recurrence_type === "monthly"
                                    ? "months"
                                    : "times"
                            }`
                          : task.recurrence_type || "recurring"}
                      </span>
                    ) : null}
                  </div>
                  <h3
                    className={cn(
                      "font-semibold",
                      task.status === "done" ? "text-white/40 line-through" : "text-white"
                    )}
                  >
                    {task.title}
                  </h3>
                  {task.description ? <p className="mt-1 text-sm text-white/40">{task.description}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/30">
                    {task.due_date ? (
                      <span className={isPastDue(task.due_date) && task.status !== "done" ? "text-red-400" : ""}>
                        {formatDateTimeAthens(task.due_date)}
                        {isPastDue(task.due_date) && task.status !== "done" ? " · Overdue" : ""}
                      </span>
                    ) : (
                      <span>No due date</span>
                    )}
                  </div>
                </div>
                {task.status !== "done" && task.status !== "skipped" ? (
                  <button
                    type="button"
                    onClick={(e) => void handleMarkComplete(task, e)}
                    disabled={completing === task.id}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                    {completing === task.id ? "Saving…" : "Done"}
                  </button>
                ) : (
                  <div className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    Completed
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight text-white">{selected.title}</h3>
                {selected.description ? (
                  <p className="mt-1 text-sm leading-relaxed text-white/55">{selected.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <form
              className="space-y-4 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              {err ? (
                <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">
                  {err}
                </div>
              ) : null}

              <motion.div {...fieldMotion}>
                <FormField label="Status" icon={<ListChecks />} htmlFor="va-task-status" staggerIndex={0}>
                  <FormSelect
                    id="va-task-status"
                    value={statusPick}
                    onChange={(e) => setStatusPick(e.target.value as VaTaskStatus)}
                  >
                    <option value="in_progress" className={selectOptionClass}>
                      In progress
                    </option>
                    <option value="done" className={selectOptionClass}>
                      Done
                    </option>
                    <option value="skipped" className={selectOptionClass}>
                      Skipped
                    </option>
                    <option value="pending" className={selectOptionClass}>
                      Pending
                    </option>
                  </FormSelect>
                </FormField>
              </motion.div>

              <motion.div {...fieldMotion} transition={{ ...fieldMotion.transition, delay: 0.05 }}>
                <FormField
                  label="Completion notes"
                  icon={<StickyNote />}
                  htmlFor="va-task-notes"
                  description="Optional — visible to admins on this task."
                  staggerIndex={1}
                >
                  <FormTextarea
                    id="va-task-notes"
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="What did you complete?"
                  />
                </FormField>
              </motion.div>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="order-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 sm:order-1"
                >
                  Cancel
                </button>
                <FormSubmitButton disabled={busy} loading={busy} className="order-1 sm:order-2 sm:min-w-[140px]">
                  Save update
                </FormSubmitButton>
              </div>
            </form>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
